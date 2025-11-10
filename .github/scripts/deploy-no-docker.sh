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

# Start infrastructure services (MongoDB, Redis) with Docker
echo "Starting MongoDB and Redis..."
cd /opt/ivorian-realty

# Create docker-compose for just infrastructure
cat > docker-compose.infrastructure.yml << 'EOF'
version: '3.8'
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

# Install dependencies in each service (if needed)
echo "Installing production dependencies..."

cd /opt/ivorian-realty/backend/microservices/shared-lib
if [ -f "package.json" ]; then
    npm ci --only=production || npm install --only=production
fi

cd /opt/ivorian-realty/backend/microservices/auth-service
if [ -f "package.json" ]; then
    npm ci --only=production || npm install --only=production
fi

cd /opt/ivorian-realty/backend/microservices/property-service
if [ -f "package.json" ]; then
    npm ci --only=production || npm install --only=production
fi

cd /opt/ivorian-realty/backend/microservices/api-gateway
if [ -f "package.json" ]; then
    npm ci --only=production || npm install --only=production
fi

# Start Auth Service
echo "Starting Auth Service..."
cd /opt/ivorian-realty/backend/microservices/auth-service
NODE_ENV=production PORT=3001 MONGODB_URI="mongodb://admin:password123@localhost:27017/ivorian_realty?authSource=admin" JWT_SECRET="your-secret-key-change-in-production" npm start > /tmp/auth-service.log 2>&1 &
AUTH_PID=$!
echo "Auth Service PID: $AUTH_PID"

# Start Property Service
echo "Starting Property Service..."
cd /opt/ivorian-realty/backend/microservices/property-service
NODE_ENV=production PORT=3002 MONGODB_URI="mongodb://admin:password123@localhost:27017/ivorian_realty?authSource=admin" npm start > /tmp/property-service.log 2>&1 &
PROPERTY_PID=$!
echo "Property Service PID: $PROPERTY_PID"

# Start API Gateway
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

# Wait a bit for services to start
echo "Waiting for services to initialize..."
sleep 10

# Check service health
echo "Checking service health..."
for service in api-gateway auth-service property-service; do
    if ps aux | grep -q "node.*$service.*dist/server.js"; then
        echo "✓ $service is running"
    else
        echo "⚠ WARNING: $service is not running"
        tail -10 /tmp/${service}.log || true
    fi
done

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

