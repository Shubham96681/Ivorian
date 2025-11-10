#!/bin/bash

set -e

echo "========================================="
echo "Starting Ivorian Realty Services (Direct)"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

REPO_DIR=$(pwd)
if [ ! -d "backend/microservices" ]; then
    echo -e "${RED}Error: Please run from repository root${NC}"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Installing Node.js...${NC}"
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs
fi

# Start MongoDB and Redis with Docker (lightweight)
echo -e "${YELLOW}Starting MongoDB and Redis...${NC}"
cd "$REPO_DIR/backend/microservices/infrastructure"

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

docker compose -f docker-compose.infrastructure.yml up -d || docker-compose -f docker-compose.infrastructure.yml up -d

# Wait for MongoDB
echo "Waiting for MongoDB..."
timeout=60
counter=0
until docker exec ivorian-mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
    sleep 2
    counter=$((counter + 2))
    if [ $counter -ge $timeout ]; then
        echo -e "${RED}MongoDB failed to start${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✓ MongoDB ready${NC}"

# Wait for Redis
echo "Waiting for Redis..."
timeout=30
counter=0
until docker exec ivorian-redis redis-cli ping > /dev/null 2>&1; do
    sleep 2
    counter=$((counter + 2))
    if [ $counter -ge $timeout ]; then
        echo -e "${RED}Redis failed to start${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✓ Redis ready${NC}"

# Build shared library
echo -e "${YELLOW}Building shared library...${NC}"
cd "$REPO_DIR/backend/microservices/shared-lib"
npm ci
npm run build
echo -e "${GREEN}✓ Shared library built${NC}"

# Start Auth Service
echo -e "${YELLOW}Starting Auth Service...${NC}"
cd "$REPO_DIR/backend/microservices/auth-service"
npm ci
NODE_ENV=production PORT=3001 MONGODB_URI="mongodb://admin:password123@localhost:27017/ivorian_realty?authSource=admin" JWT_SECRET="your-secret-key-change-in-production" npm start > /tmp/auth-service.log 2>&1 &
AUTH_PID=$!
echo "Auth Service PID: $AUTH_PID"

# Start Property Service
echo -e "${YELLOW}Starting Property Service...${NC}"
cd "$REPO_DIR/backend/microservices/property-service"
npm ci
NODE_ENV=production PORT=3002 MONGODB_URI="mongodb://admin:password123@localhost:27017/ivorian_realty?authSource=admin" npm start > /tmp/property-service.log 2>&1 &
PROPERTY_PID=$!
echo "Property Service PID: $PROPERTY_PID"

# Start API Gateway
echo -e "${YELLOW}Starting API Gateway...${NC}"
cd "$REPO_DIR/backend/microservices/api-gateway"
npm ci
NODE_ENV=production PORT=3000 MONGODB_URI="mongodb://admin:password123@localhost:27017/ivorian_realty?authSource=admin" REDIS_HOST=localhost REDIS_PORT=6379 JWT_SECRET="your-secret-key-change-in-production" AUTH_SERVICE_URL="http://localhost:3001" PROPERTY_SERVICE_URL="http://localhost:3002" npm start > /tmp/api-gateway.log 2>&1 &
GATEWAY_PID=$!
echo "API Gateway PID: $GATEWAY_PID"

# Build and serve frontend
echo -e "${YELLOW}Building frontend...${NC}"
cd "$REPO_DIR/frontend"
npm ci
VITE_API_URL="http://13.126.156.163/api" npm run build

# Start Nginx for frontend
echo -e "${YELLOW}Starting Nginx for frontend...${NC}"
sudo mkdir -p /opt/ivorian-realty/frontend
sudo cp -r dist/* /opt/ivorian-realty/frontend/

# Create simple nginx config
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
}
EOF

# Install nginx if not installed
if ! command -v nginx &> /dev/null; then
    sudo yum install -y nginx
fi

sudo systemctl start nginx
sudo systemctl enable nginx

# Wait a bit
sleep 5

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Services started!${NC}"
echo -e "${GREEN}=========================================${NC}"
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
echo "To stop services:"
echo "  kill $AUTH_PID $PROPERTY_PID $GATEWAY_PID"
echo ""

