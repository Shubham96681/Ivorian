#!/bin/bash

set -e

echo "========================================="
echo "Manual Deployment Script for Ivorian Realty"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js not found. Installing Node.js 20...${NC}"
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs
    echo -e "${GREEN}✓ Node.js installed${NC}"
    echo ""
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js 18+ required. Current version: $(node -v)${NC}"
    exit 1
fi

echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"
echo ""

# Check if we're in the right directory
if [ ! -d "backend/microservices" ]; then
    echo -e "${RED}Error: Please run this script from the repository root${NC}"
    echo "Expected: Ivorian/Ivorian_realty/"
    echo "Current directory: $(pwd)"
    exit 1
fi

REPO_DIR=$(pwd)
DEPLOY_DIR="/opt/ivorian-realty"

echo -e "${YELLOW}Step 1: Building shared library...${NC}"
cd backend/microservices/shared-lib
npm ci
npm run build
echo -e "${GREEN}✓ Shared library built${NC}"
echo ""

echo -e "${YELLOW}Step 2: Building Docker images...${NC}"
cd "$REPO_DIR/backend/microservices"

# Build API Gateway
echo "Building API Gateway..."
docker build -f api-gateway/Dockerfile -t ivorian-realty/api-gateway:latest --build-arg BUILDKIT_INLINE_CACHE=1 .
echo -e "${GREEN}✓ API Gateway image built${NC}"

# Build Auth Service
echo "Building Auth Service..."
docker build -f auth-service/Dockerfile -t ivorian-realty/auth-service:latest --build-arg BUILDKIT_INLINE_CACHE=1 .
echo -e "${GREEN}✓ Auth Service image built${NC}"

# Build Property Service
echo "Building Property Service..."
docker build -f property-service/Dockerfile -t ivorian-realty/property-service:latest --build-arg BUILDKIT_INLINE_CACHE=1 .
echo -e "${GREEN}✓ Property Service image built${NC}"
echo ""

echo -e "${YELLOW}Step 3: Building frontend...${NC}"
cd "$REPO_DIR/frontend"
npm ci
VITE_API_URL="http://65.0.122.243/api" npm run build
echo -e "${GREEN}✓ Frontend built${NC}"
echo ""

echo -e "${YELLOW}Step 4: Setting up deployment directory...${NC}"
sudo mkdir -p "$DEPLOY_DIR/frontend"
sudo mkdir -p "$DEPLOY_DIR/backend/microservices/infrastructure/nginx"
sudo mkdir -p "$DEPLOY_DIR/logs"
sudo mkdir -p "$DEPLOY_DIR/backend/microservices/infrastructure/nginx/ssl"

# Copy frontend build
echo "Copying frontend build..."
sudo cp -r dist/* "$DEPLOY_DIR/frontend/"
echo -e "${GREEN}✓ Frontend copied${NC}"

# Copy docker-compose and nginx config
echo "Copying configuration files..."
sudo cp "$REPO_DIR/backend/microservices/infrastructure/docker-compose.prod.yml" "$DEPLOY_DIR/docker-compose.yml"
sudo cp "$REPO_DIR/backend/microservices/infrastructure/nginx/nginx.conf" "$DEPLOY_DIR/backend/microservices/infrastructure/nginx/nginx.conf"
echo -e "${GREEN}✓ Configuration files copied${NC}"
echo ""

echo -e "${YELLOW}Step 5: Starting services...${NC}"
cd "$DEPLOY_DIR"

# Determine docker compose command and if sudo is needed
if docker ps &> /dev/null; then
    DOCKER_CMD="docker"
    DOCKER_SUDO=""
elif sudo docker ps &> /dev/null; then
    DOCKER_CMD="sudo docker"
    DOCKER_SUDO="sudo "
else
    echo -e "${RED}Error: Docker is not accessible${NC}"
    exit 1
fi

if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    echo -e "${RED}Error: docker-compose not found${NC}"
    exit 1
fi

# Check if sudo is needed for docker compose
if $DOCKER_COMPOSE version &> /dev/null; then
    DOCKER_COMPOSE_CMD="$DOCKER_COMPOSE"
else
    DOCKER_COMPOSE_CMD="sudo $DOCKER_COMPOSE"
fi

echo "Using: $DOCKER_COMPOSE_CMD"

# Stop existing containers
echo "Stopping existing containers..."
$DOCKER_COMPOSE_CMD -f docker-compose.yml down || true

# Start infrastructure services
echo "Starting MongoDB and Redis..."
$DOCKER_COMPOSE_CMD -f docker-compose.yml up -d mongodb redis

# Wait for MongoDB
echo "Waiting for MongoDB to be ready..."
timeout=60
counter=0
until $DOCKER_CMD exec ivorian-mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
    sleep 2
    counter=$((counter + 2))
    if [ $counter -ge $timeout ]; then
        echo -e "${RED}MongoDB failed to start within $timeout seconds${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✓ MongoDB is ready${NC}"

# Wait for Redis
echo "Waiting for Redis to be ready..."
timeout=30
counter=0
until $DOCKER_CMD exec ivorian-redis redis-cli ping > /dev/null 2>&1; do
    sleep 2
    counter=$((counter + 2))
    if [ $counter -ge $timeout ]; then
        echo -e "${RED}Redis failed to start within $timeout seconds${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✓ Redis is ready${NC}"

# Start application services
echo "Starting application services..."
$DOCKER_COMPOSE_CMD -f docker-compose.yml up -d api-gateway auth-service property-service

# Wait a bit for services to start
echo "Waiting for services to initialize..."
sleep 15

# Start Nginx
echo "Starting Nginx..."
$DOCKER_COMPOSE_CMD -f docker-compose.yml up -d nginx

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Services status:"
$DOCKER_COMPOSE_CMD -f docker-compose.yml ps
echo ""
echo "Your website should be accessible at:"
echo -e "${GREEN}http://65.0.122.243${NC}"
echo ""
echo "Health check:"
echo "curl http://65.0.122.243/health"
echo ""

