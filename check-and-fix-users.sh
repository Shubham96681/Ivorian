#!/bin/bash

echo "Checking and fixing database users..."

# Check if user exists and verify password hash
docker exec ivorian-mongodb mongosh -u admin -p password123 --authenticationDatabase admin ivorian_realty << 'EOF'
// Check if buyer@example.com exists
const user = db.users.findOne({ email: 'buyer@example.com' });
if (user) {
  print("User found:");
  print("Email: " + user.email);
  print("Role: " + user.role);
  print("Has password: " + (user.password ? "Yes" : "No"));
  print("Password length: " + (user.password ? user.password.length : 0));
} else {
  print("User buyer@example.com NOT FOUND!");
  print("Database needs to be reseeded.");
}

// Count total users
const userCount = db.users.countDocuments({});
print("\nTotal users in database: " + userCount);

// List all user emails
print("\nAll users:");
db.users.find({}, { email: 1, role: 1, _id: 0 }).forEach(u => {
  print("- " + u.email + " (" + u.role + ")");
});
EOF

echo ""
echo "If the user doesn't exist, you need to reseed the database."
echo "The API Gateway should reseed on restart, or you can manually trigger it."

