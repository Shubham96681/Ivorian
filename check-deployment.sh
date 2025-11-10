#!/bin/bash

echo "=== Checking EC2 Deployment Status ==="
echo ""
echo "1. Checking Docker containers..."
ssh -i "C:\Users\shubh\Downloads\Ivorian.pem" ec2-user@65.0.122.243 "docker ps"

echo ""
echo "2. Checking if nginx is running..."
ssh -i "C:\Users\shubh\Downloads\Ivorian.pem" ec2-user@65.0.122.243 "docker ps | grep nginx"

echo ""
echo "3. Checking docker-compose status..."
ssh -i "C:\Users\shubh\Downloads\Ivorian.pem" ec2-user@65.0.122.243 "cd /opt/ivorian-realty && docker compose ps 2>/dev/null || docker-compose ps 2>/dev/null || echo 'docker-compose.yml not found or services not running'"

echo ""
echo "4. Checking if port 80 is listening..."
ssh -i "C:\Users\shubh\Downloads\Ivorian.pem" ec2-user@65.0.122.243 "sudo netstat -tlnp | grep :80 || sudo ss -tlnp | grep :80 || echo 'Port 80 not listening'"

echo ""
echo "5. Checking nginx logs (if exists)..."
ssh -i "C:\Users\shubh\Downloads\Ivorian.pem" ec2-user@65.0.122.243 "docker logs ivorian-nginx --tail 20 2>/dev/null || echo 'Nginx container not found'"

