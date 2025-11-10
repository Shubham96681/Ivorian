#!/bin/bash

echo "Reseeding database with test users..."

# Connect to MongoDB and clear existing data, then reseed
docker exec ivorian-mongodb mongosh -u admin -p password123 --authenticationDatabase admin ivorian_realty << 'EOF'
// Drop indexes first to avoid issues
db.users.dropIndexes();
db.properties.dropIndexes();

// Clear collections
db.users.deleteMany({});
db.properties.deleteMany({});

print("Database cleared successfully!");
EOF

echo "Database cleared. The API Gateway will reseed on next restart."
echo "Or you can manually trigger seeding by restarting the API Gateway service."
