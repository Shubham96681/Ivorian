#!/bin/bash

echo "========================================="
echo "Debugging Login Issue"
echo "========================================="

# Check if API Gateway is running
echo "1. Checking API Gateway status..."
if pgrep -f "node.*api-gateway.*dist/server.js" > /dev/null; then
    echo "✓ API Gateway is running"
    API_GATEWAY_PID=$(pgrep -f "node.*api-gateway.*dist/server.js" | head -1)
    echo "  PID: $API_GATEWAY_PID"
else
    echo "⚠ API Gateway is NOT running!"
    exit 1
fi

# Check database users
echo ""
echo "2. Checking database users..."
docker exec ivorian-mongodb mongosh -u admin -p password123 --authenticationDatabase admin ivorian_realty --eval "
const userCount = db.users.countDocuments({});
print('Total users: ' + userCount);

if (userCount > 0) {
  print('\nAll users:');
  db.users.find({}, { email: 1, role: 1, password: 1 }).forEach(u => {
    const hasPassword = u.password ? 'Yes (length: ' + u.password.length + ')' : 'No';
    print('  - ' + u.email + ' (' + u.role + ') - Password: ' + hasPassword);
  });
  
  const buyer = db.users.findOne({ email: 'buyer@example.com' });
  if (buyer) {
    print('\n✓ buyer@example.com found!');
    print('  Role: ' + buyer.role);
    print('  Has password: ' + (buyer.password ? 'Yes' : 'No'));
    if (buyer.password) {
      print('  Password hash length: ' + buyer.password.length);
    }
  } else {
    print('\n⚠ buyer@example.com NOT found!');
  }
} else {
  print('\n⚠ No users in database!');
  print('Database needs to be seeded.');
}
"

# Check API Gateway logs for errors
echo ""
echo "3. Checking API Gateway logs for errors..."
if [ -f /tmp/api-gateway.log ]; then
    echo "Recent errors from API Gateway:"
    tail -50 /tmp/api-gateway.log | grep -i -E "(error|fail|seed|login)" || echo "No errors found in recent logs"
else
    echo "⚠ No log file found"
fi

# Test login and show detailed error
echo ""
echo "4. Testing login API..."
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer@example.com","password":"password123"}' \
  -v 2>&1 | grep -E "(< HTTP|success|message|error)"

echo ""
echo "========================================="
echo "If no users found, run: ./fix-database-on-ec2.sh"
echo "========================================="

