#!/bin/bash

echo "Clearing and reseeding database..."

# Connect to MongoDB and clear collections
docker exec ivorian-mongodb mongosh -u admin -p password123 --authenticationDatabase admin ivorian_realty --eval "
  db.users.deleteMany({});
  db.properties.deleteMany({});
  print('Database cleared successfully!');
"

echo "Database cleared. Restarting API Gateway to trigger seeding..."
echo "The API Gateway will automatically seed the database on startup."

echo ""
echo "Test users that will be created:"
echo "- john.doe@example.com (buyer) - Password: password123"
echo "- buyer@example.com (buyer) - Password: password123"
echo "- jane.smith@example.com (seller) - Password: password123"
echo "- seller@example.com (seller) - Password: password123"
echo "- ahmed.traore@example.com (agent) - Password: password123"
echo "- admin@example.com (admin) - Password: password123"

