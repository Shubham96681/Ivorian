#!/bin/bash

echo "========================================="
echo "Fixing Database - Reseeding Users"
echo "========================================="

# Step 1: Check if API Gateway is running
echo "Checking API Gateway status..."
if pgrep -f "node.*api-gateway.*dist/server.js" > /dev/null; then
    echo "✓ API Gateway is running"
    API_GATEWAY_PID=$(pgrep -f "node.*api-gateway.*dist/server.js" | head -1)
    echo "  PID: $API_GATEWAY_PID"
else
    echo "⚠ API Gateway is not running"
fi

# Step 2: Check recent logs
echo ""
echo "Checking API Gateway logs..."
if [ -f /tmp/api-gateway.log ]; then
    echo "Last 30 lines of API Gateway log:"
    tail -30 /tmp/api-gateway.log
else
    echo "⚠ No log file found at /tmp/api-gateway.log"
fi

# Step 3: Clear the database
echo ""
echo "Clearing database..."
docker exec ivorian-mongodb mongosh -u admin -p password123 --authenticationDatabase admin ivorian_realty << 'EOF'
// Drop indexes first
try {
  db.users.dropIndexes();
  db.properties.dropIndexes();
} catch(e) {
  print("Note: Some indexes may not exist");
}

// Clear collections
db.users.deleteMany({});
db.properties.deleteMany({});

print("✓ Database cleared successfully!");
print("Total users: " + db.users.countDocuments({}));
print("Total properties: " + db.properties.countDocuments({}));
EOF

# Step 4: Restart API Gateway to trigger seeding
echo ""
echo "Restarting API Gateway to trigger seeding..."

# Stop existing API Gateway
pkill -f "node.*api-gateway.*dist/server.js" || true
sleep 2

# Start API Gateway
cd /opt/ivorian-realty/backend/microservices/api-gateway
NODE_ENV=production PORT=3000 MONGODB_URI="mongodb://admin:password123@localhost:27017/ivorian_realty?authSource=admin" REDIS_HOST=localhost REDIS_PORT=6379 JWT_SECRET="your-secret-key-change-in-production" AUTH_SERVICE_URL="http://localhost:3001" PROPERTY_SERVICE_URL="http://localhost:3002" npm start > /tmp/api-gateway.log 2>&1 &
API_GATEWAY_PID=$!

echo "✓ API Gateway restarted (PID: $API_GATEWAY_PID)"
echo "  Waiting for seeding to complete..."

# Wait a bit for seeding
sleep 5

# Step 5: Check if users were created
echo ""
echo "Verifying database seeding..."
docker exec ivorian-mongodb mongosh -u admin -p password123 --authenticationDatabase admin ivorian_realty << 'EOF'
const userCount = db.users.countDocuments({});
print("Total users in database: " + userCount);

if (userCount > 0) {
  print("\n✓ Users found! Listing all users:");
  db.users.find({}, { email: 1, role: 1, _id: 0 }).forEach(u => {
    print("  - " + u.email + " (" + u.role + ")");
  });
  
  // Check specifically for buyer@example.com
  const buyer = db.users.findOne({ email: 'buyer@example.com' });
  if (buyer) {
    print("\n✓ buyer@example.com exists!");
  } else {
    print("\n⚠ buyer@example.com NOT found!");
  }
} else {
  print("\n⚠ No users found! Seeding may have failed.");
  print("Check /tmp/api-gateway.log for errors.");
}
EOF

# Step 6: Show recent logs
echo ""
echo "Recent API Gateway logs (last 20 lines):"
tail -20 /tmp/api-gateway.log

echo ""
echo "========================================="
echo "Done! Try logging in with:"
echo "  Email: buyer@example.com"
echo "  Password: password123"
echo "========================================="

