#!/bin/bash

echo "========================================="
echo "Starting All Services"
echo "========================================="

# Check if MongoDB and Redis are running
echo "1. Checking infrastructure services..."
if docker ps | grep -q ivorian-mongodb; then
    echo "✓ MongoDB is running"
else
    echo "⚠ MongoDB is not running, starting..."
    cd /opt/ivorian-realty
    docker-compose -f docker-compose.infrastructure.yml up -d
    sleep 5
fi

if docker ps | grep -q ivorian-redis; then
    echo "✓ Redis is running"
else
    echo "⚠ Redis is not running, starting..."
    cd /opt/ivorian-realty
    docker-compose -f docker-compose.infrastructure.yml up -d
    sleep 5
fi

# Stop any existing services
echo ""
echo "2. Stopping existing Node.js services..."
pkill -9 -f "node.*dist/server.js" || true
pkill -9 -f "node.*api-gateway" || true
pkill -9 -f "node.*auth-service" || true
pkill -9 -f "node.*property-service" || true
sleep 2

# Make sure ports are free
echo "3. Checking ports..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3002 | xargs kill -9 2>/dev/null || true
sleep 2

# Start Auth Service
echo ""
echo "4. Starting Auth Service..."
cd /opt/ivorian-realty/backend/microservices/auth-service
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    npm install --omit=dev --ignore-scripts --no-save || true
fi
NODE_ENV=production PORT=3001 MONGODB_URI="mongodb://admin:password123@localhost:27017/ivorian_realty?authSource=admin" JWT_SECRET="your-secret-key-change-in-production" npm start > /tmp/auth-service.log 2>&1 &
AUTH_PID=$!
echo "  ✓ Auth Service started (PID: $AUTH_PID)"

# Start Property Service
echo ""
echo "5. Starting Property Service..."
cd /opt/ivorian-realty/backend/microservices/property-service
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    npm install --omit=dev --ignore-scripts --no-save || true
fi
NODE_ENV=production PORT=3002 MONGODB_URI="mongodb://admin:password123@localhost:27017/ivorian_realty?authSource=admin" npm start > /tmp/property-service.log 2>&1 &
PROPERTY_PID=$!
echo "  ✓ Property Service started (PID: $PROPERTY_PID)"

# Start API Gateway
echo ""
echo "6. Starting API Gateway..."
cd /opt/ivorian-realty/backend/microservices/api-gateway
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    npm install --omit=dev --ignore-scripts --no-save || true
fi
NODE_ENV=production PORT=3000 MONGODB_URI="mongodb://admin:password123@localhost:27017/ivorian_realty?authSource=admin" REDIS_HOST=localhost REDIS_PORT=6379 JWT_SECRET="your-secret-key-change-in-production" AUTH_SERVICE_URL="http://localhost:3001" PROPERTY_SERVICE_URL="http://localhost:3002" npm start > /tmp/api-gateway.log 2>&1 &
GATEWAY_PID=$!
echo "  ✓ API Gateway started (PID: $GATEWAY_PID)"

# Wait for services to start
echo ""
echo "7. Waiting for services to initialize..."
sleep 8

# Check service status
echo ""
echo "8. Checking service status..."
if pgrep -f "node.*auth-service.*dist/server.js" > /dev/null; then
    echo "  ✓ Auth Service is running"
else
    echo "  ⚠ Auth Service is NOT running"
    echo "    Check logs: tail -20 /tmp/auth-service.log"
fi

if pgrep -f "node.*property-service.*dist/server.js" > /dev/null; then
    echo "  ✓ Property Service is running"
else
    echo "  ⚠ Property Service is NOT running"
    echo "    Check logs: tail -20 /tmp/property-service.log"
fi

if pgrep -f "node.*api-gateway.*dist/server.js" > /dev/null; then
    echo "  ✓ API Gateway is running"
else
    echo "  ⚠ API Gateway is NOT running"
    echo "    Check logs: tail -20 /tmp/api-gateway.log"
fi

# Check database seeding
echo ""
echo "9. Checking database..."
sleep 3
docker exec ivorian-mongodb mongosh -u admin -p password123 --authenticationDatabase admin ivorian_realty --eval "
const userCount = db.users.countDocuments({});
print('Total users: ' + userCount);
if (userCount > 0) {
  print('✓ Database has users');
  const buyer = db.users.findOne({ email: 'buyer@example.com' });
  if (buyer) {
    print('✓ buyer@example.com exists');
  }
} else {
  print('⚠ No users found - check API Gateway logs for seeding messages');
}
"

# Show recent API Gateway logs
echo ""
echo "10. Recent API Gateway logs:"
tail -15 /tmp/api-gateway.log

echo ""
echo "========================================="
echo "Services started!"
echo "========================================="
echo ""
echo "Test login with:"
echo "  curl -X POST http://localhost:3000/api/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"buyer@example.com\",\"password\":\"password123\"}'"
echo ""
echo "Or visit: http://13.126.156.163"
echo ""

