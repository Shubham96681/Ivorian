#!/bin/bash

set -e

echo "Starting deployment (No Docker)..."

# Determine docker compose command for infrastructure only
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo "Error: docker-compose not found"
    exit 1
fi

echo "Using: $DOCKER_COMPOSE"

# Ensure proper permissions
echo "Setting up directories and permissions..."
sudo mkdir -p /opt/ivorian-realty
sudo mkdir -p /opt/ivorian-realty/frontend
sudo mkdir -p /opt/ivorian-realty/backend/microservices/{shared-lib,api-gateway,auth-service,property-service}
sudo mkdir -p /opt/ivorian-realty/backend/microservices/infrastructure/nginx
sudo mkdir -p /opt/ivorian-realty/logs
sudo chown -R ec2-user:ec2-user /opt/ivorian-realty
sudo chmod -R 755 /opt/ivorian-realty

# Stop existing containers if they exist
echo "Stopping existing containers..."
cd /opt/ivorian-realty
$DOCKER_COMPOSE -f docker-compose.infrastructure.yml down 2>/dev/null || true
docker stop ivorian-mongodb ivorian-redis 2>/dev/null || true
docker rm ivorian-mongodb ivorian-redis 2>/dev/null || true

# Start infrastructure services (MongoDB, Redis) with Docker
echo "Starting MongoDB and Redis..."
cd /opt/ivorian-realty

# Create docker-compose for just infrastructure
cat > docker-compose.infrastructure.yml << 'EOF'
services:
  mongodb:
    image: mongo:7.0
    container_name: ivorian-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password123
      MONGO_INITDB_DATABASE: ivorian_realty
    volumes:
      - mongodb_data:/data/db
  redis:
    image: redis:7.2-alpine
    container_name: ivorian-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
volumes:
  mongodb_data:
EOF

$DOCKER_COMPOSE -f docker-compose.infrastructure.yml up -d

# Wait for MongoDB
echo "Waiting for MongoDB to be ready..."
timeout=60
counter=0
until docker exec ivorian-mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
    sleep 2
    counter=$((counter + 2))
    if [ $counter -ge $timeout ]; then
        echo "MongoDB failed to start within $timeout seconds"
        exit 1
    fi
done
echo "✓ MongoDB is ready"

# Wait for Redis
echo "Waiting for Redis to be ready..."
timeout=30
counter=0
until docker exec ivorian-redis redis-cli ping > /dev/null 2>&1; do
    sleep 2
    counter=$((counter + 2))
    if [ $counter -ge $timeout ]; then
        echo "Redis failed to start within $timeout seconds"
        exit 1
    fi
done
echo "✓ Redis is ready"

# Stop existing Node.js services
echo "Stopping existing services..."
pkill -f "node.*dist/server.js" || true
sleep 2

# Install dependencies in each service
echo "Installing production dependencies..."

# Install shared-lib dependencies first (skip scripts since dist is already built)
cd /opt/ivorian-realty/backend/microservices/shared-lib
if [ -d "node_modules" ]; then
    rm -rf node_modules
fi
if [ -f "package.json" ]; then
    # Skip scripts since we already have the built dist folder
    npm install --omit=dev --ignore-scripts --no-save || npm install --production --ignore-scripts --no-save
fi

# Install service dependencies
cd /opt/ivorian-realty/backend/microservices/auth-service
if [ -d "node_modules" ]; then
    rm -rf node_modules
fi
if [ -f "package.json" ]; then
    npm install --omit=dev --ignore-scripts --no-save || npm install --production --ignore-scripts --no-save
fi

cd /opt/ivorian-realty/backend/microservices/property-service
if [ -d "node_modules" ]; then
    rm -rf node_modules
fi
if [ -f "package.json" ]; then
    npm install --omit=dev --ignore-scripts --no-save || npm install --production --ignore-scripts --no-save
fi

cd /opt/ivorian-realty/backend/microservices/api-gateway
if [ -d "node_modules" ]; then
    rm -rf node_modules
fi
if [ -f "package.json" ]; then
    npm install --omit=dev --ignore-scripts --no-save || npm install --production --ignore-scripts --no-save
fi

# Stop any existing services first
echo "Stopping any existing Node.js services..."
pkill -9 -f "node.*dist/server.js" || true
pkill -9 -f "node.*api-gateway" || true
pkill -9 -f "node.*auth-service" || true
pkill -9 -f "node.*property-service" || true
sleep 2

# Make sure ports are free
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3002 | xargs kill -9 2>/dev/null || true
sleep 2

# Start Auth Service
echo "Starting Auth Service..."
cd /opt/ivorian-realty/backend/microservices/auth-service
NODE_ENV=production PORT=3001 MONGODB_URI="mongodb://admin:password123@localhost:27017/ivorian_realty?authSource=admin" JWT_SECRET="your-secret-key-change-in-production" npm start > /tmp/auth-service.log 2>&1 &
AUTH_PID=$!
echo "Auth Service PID: $AUTH_PID"
sleep 2

# Start Property Service
echo "Starting Property Service..."
cd /opt/ivorian-realty/backend/microservices/property-service
# Force PORT=3002 to override any port manager assignment
NODE_ENV=production PORT=3002 MONGODB_URI="mongodb://admin:password123@localhost:27017/ivorian_realty?authSource=admin" npm start > /tmp/property-service.log 2>&1 &
PROPERTY_PID=$!
echo "Property Service PID: $PROPERTY_PID"
sleep 3

# Start API Gateway (this will also seed the database)
echo "Starting API Gateway..."
cd /opt/ivorian-realty/backend/microservices/api-gateway
NODE_ENV=production PORT=3000 MONGODB_URI="mongodb://admin:password123@localhost:27017/ivorian_realty?authSource=admin" REDIS_HOST=localhost REDIS_PORT=6379 JWT_SECRET="your-secret-key-change-in-production" AUTH_SERVICE_URL="http://localhost:3001" PROPERTY_SERVICE_URL="http://localhost:3002" npm start > /tmp/api-gateway.log 2>&1 &
GATEWAY_PID=$!
echo "API Gateway PID: $GATEWAY_PID"

# Setup Nginx
echo "Setting up Nginx..."
sudo mkdir -p /etc/nginx/conf.d

sudo tee /etc/nginx/conf.d/ivorian.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name _;
    
    root /opt/ivorian-realty/frontend;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
EOF

# Install nginx if not installed
if ! command -v nginx &> /dev/null; then
    sudo yum install -y nginx
fi

sudo systemctl restart nginx
sudo systemctl enable nginx

# Wait for services to start and database to seed
echo "Waiting for services to initialize and database to seed..."
sleep 15

# Check service health
echo "Checking service health..."
# Check by port instead of process name (more reliable)
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "✓ API Gateway is running on port 3000"
else
    echo "⚠ WARNING: API Gateway is not running on port 3000"
    tail -10 /tmp/api-gateway.log || true
fi

if lsof -ti:3001 > /dev/null 2>&1; then
    echo "✓ Auth Service is running on port 3001"
else
    echo "⚠ WARNING: Auth Service is not running on port 3001"
    tail -10 /tmp/auth-service.log || true
fi

if lsof -ti:3002 > /dev/null 2>&1; then
    echo "✓ Property Service is running on port 3002"
else
    echo "⚠ WARNING: Property Service is not running on port 3002"
    tail -10 /tmp/property-service.log || true
fi

# Verify database seeding
echo ""
echo "Verifying database seeding..."
sleep 5
docker exec ivorian-mongodb mongosh -u admin -p password123 --authenticationDatabase admin ivorian_realty --eval "
const userCount = db.users.countDocuments({});
print('Total users in database: ' + userCount);
if (userCount > 0) {
  print('✓ Database seeded successfully');
  const buyer = db.users.findOne({ email: 'buyer@example.com' });
  if (buyer) {
    print('✓ buyer@example.com exists - ready for login');
  } else {
    print('⚠ buyer@example.com not found');
  }
} else {
  print('⚠ No users found - check API Gateway logs for seeding errors');
  print('Check: tail -30 /tmp/api-gateway.log');
}
" || echo "⚠ Could not verify database - MongoDB may not be ready"

# Check API Gateway logs for seeding messages
echo ""
echo "Checking API Gateway logs for seeding status..."
if grep -q "Seeding database" /tmp/api-gateway.log 2>/dev/null; then
    echo "✓ Seeding process detected in logs"
    grep -i "seed\|user\|Created" /tmp/api-gateway.log | tail -5
else
    echo "⚠ No seeding messages found in logs"
    echo "  Last 10 lines of API Gateway log:"
    tail -10 /tmp/api-gateway.log
fi

echo ""
echo "========================================="
echo "Deployment completed successfully!"
echo "========================================="
echo ""
echo "Services running:"
echo "  - MongoDB: localhost:27017"
echo "  - Redis: localhost:6379"
echo "  - Auth Service: localhost:3001 (PID: $AUTH_PID)"
echo "  - Property Service: localhost:3002 (PID: $PROPERTY_PID)"
echo "  - API Gateway: localhost:3000 (PID: $GATEWAY_PID)"
echo "  - Frontend: http://13.126.156.163"
echo ""
echo "Logs:"
echo "  - Auth Service: tail -f /tmp/auth-service.log"
echo "  - Property Service: tail -f /tmp/property-service.log"
echo "  - API Gateway: tail -f /tmp/api-gateway.log"
echo ""

