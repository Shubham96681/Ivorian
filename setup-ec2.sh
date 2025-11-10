#!/bin/bash

# EC2 First Time Setup Script
# Run this on your EC2 instance

set -e

echo "========================================="
echo "EC2 First Time Setup for Ivorian Realty"
echo "========================================="
echo ""

# Update system
echo "📦 Updating system packages..."
sudo yum update -y

# Install Docker
echo "🐳 Installing Docker..."
sudo yum install docker -y
sudo systemctl start docker
sudo systemctl enable docker

# Add ec2-user to docker group
echo "👤 Adding ec2-user to docker group..."
sudo usermod -aG docker ec2-user

# Install Docker Compose
echo "🔧 Installing Docker Compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
echo "📥 Installing Git..."
sudo yum install git -y

# Create deployment directories
echo "📁 Creating deployment directories..."
sudo mkdir -p /opt/ivorian-realty
sudo mkdir -p /opt/ivorian-realty/frontend
sudo mkdir -p /opt/ivorian-realty/backend/microservices/infrastructure/nginx
sudo mkdir -p /opt/ivorian-realty/logs

# Change ownership
echo "🔐 Setting directory permissions..."
sudo chown -R ec2-user:ec2-user /opt/ivorian-realty

# Clone repository
echo "📂 Cloning repository..."
cd ~
if [ -d "Ivorian" ]; then
    echo "Repository already exists, pulling latest changes..."
    cd Ivorian
    git pull
else
    git clone https://github.com/Shubham96681/Ivorian.git
    cd Ivorian/Ivorian_realty
fi

echo ""
echo "========================================="
echo "✅ Setup Complete!"
echo "========================================="
echo ""
echo "⚠️  IMPORTANT: Log out and log back in for docker group changes to take effect!"
echo ""
echo "Next steps:"
echo "1. Log out: exit"
echo "2. SSH back in: ssh -i 'Ivorian.pem' ec2-user@65.0.122.243"
echo "3. Test Docker: docker ps"
echo "4. Add GitHub Secrets for CI/CD deployment"
echo ""
echo "Repository location: ~/Ivorian/Ivorian_realty"
echo "Deployment directory: /opt/ivorian-realty"
echo ""

