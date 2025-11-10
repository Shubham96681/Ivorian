#!/bin/bash

echo "========================================="
echo "Checking Deployment Status"
echo "========================================="

# Check if services are running
echo "1. Checking if services are running..."
if pgrep -f "node.*api-gateway.*dist/server.js" > /dev/null; then
    echo "✓ API Gateway is running"
    API_PID=$(pgrep -f "node.*api-gateway.*dist/server.js" | head -1)
    echo "  PID: $API_PID"
else
    echo "⚠ API Gateway is NOT running!"
fi

if pgrep -f "node.*auth-service.*dist/server.js" > /dev/null; then
    echo "✓ Auth Service is running"
else
    echo "⚠ Auth Service is NOT running!"
fi

if pgrep -f "node.*property-service.*dist/server.js" > /dev/null; then
    echo "✓ Property Service is running"
else
    echo "⚠ Property Service is NOT running!"
fi

# Check database
echo ""
echo "2. Checking database..."
docker exec ivorian-mongodb mongosh -u admin -p password123 --authenticationDatabase admin ivorian_realty --eval "
const userCount = db.users.countDocuments({});
print('Total users: ' + userCount);

if (userCount > 0) {
  print('\nAll users:');
  db.users.find({}, { email: 1, role: 1, _id: 0 }).forEach(u => {
    print('  - ' + u.email + ' (' + u.role + ')');
  });
  
  const buyer = db.users.findOne({ email: 'buyer@example.com' });
  if (buyer) {
    print('\n✓ buyer@example.com found');
    print('  Role: ' + buyer.role);
    print('  Has password: ' + (buyer.password ? 'Yes (length: ' + buyer.password.length + ')' : 'No'));
  } else {
    print('\n⚠ buyer@example.com NOT found');
  }
} else {
  print('\n⚠ NO USERS IN DATABASE!');
  print('Database needs to be seeded.');
}
"

# Check API Gateway logs
echo ""
echo "3. Checking API Gateway logs..."
if [ -f /tmp/api-gateway.log ]; then
    echo "Last 30 lines:"
    tail -30 /tmp/api-gateway.log
    echo ""
    echo "Seeding messages:"
    grep -i "seed\|user\|Created" /tmp/api-gateway.log | tail -10 || echo "No seeding messages found"
else
    echo "⚠ No log file found at /tmp/api-gateway.log"
fi

# Test login with detailed output
echo ""
echo "4. Testing login API..."
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer@example.com","password":"password123"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  2>&1

echo ""
echo "========================================="

