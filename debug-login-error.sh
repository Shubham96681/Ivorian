#!/bin/bash

echo "========================================="
echo "Debugging Login Error"
echo "========================================="

# Check API Gateway logs for recent login errors
echo "1. Checking API Gateway logs for login errors..."
tail -50 /tmp/api-gateway.log | grep -A 5 -B 5 -i "login\|error\|fail" | tail -30

# Test login and capture full response
echo ""
echo "2. Testing login API..."
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"buyer@example.com","password":"password123"}' \
  -v 2>&1 | grep -E "(< HTTP|success|message|error|token)"

# Check if user exists and verify password hash
echo ""
echo "3. Checking user in database..."
docker exec ivorian-mongodb mongosh -u admin -p password123 --authenticationDatabase admin ivorian_realty --eval "
const user = db.users.findOne({ email: 'buyer@example.com' });
if (user) {
  print('User found:');
  print('  Email: ' + user.email);
  print('  Role: ' + user.role);
  print('  Password hash: ' + (user.password ? user.password.substring(0, 20) + '...' : 'MISSING'));
  print('  Password hash length: ' + (user.password ? user.password.length : 0));
  print('  Password hash starts with: ' + (user.password ? user.password.substring(0, 7) : 'N/A'));
} else {
  print('User NOT found!');
}
"

# Test password hash manually
echo ""
echo "4. Testing password hash comparison..."
docker exec ivorian-mongodb mongosh -u admin -p password123 --authenticationDatabase admin ivorian_realty --eval "
const user = db.users.findOne({ email: 'buyer@example.com' });
if (user && user.password) {
  print('Password hash format check:');
  print('  Starts with \$2a\$: ' + user.password.startsWith('\$2a\$'));
  print('  Starts with \$2b\$: ' + user.password.startsWith('\$2b\$'));
  print('  Starts with \$2y\$: ' + user.password.startsWith('\$2y\$'));
  print('  Valid bcrypt format: ' + /^\$2[aby]\$/.test(user.password));
} else {
  print('Cannot check password hash - user or password missing');
}
"

echo ""
echo "========================================="

