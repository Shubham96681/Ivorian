# EC2 First Time Setup Guide

## Option 1: Automatic CI/CD Deployment (Recommended)

**You DON'T need to clone the repository!** GitHub Actions will automatically deploy when you push to master.

Just follow these steps:

### Step 1: Setup EC2 Server (One-time)

SSH into your EC2 instance:
```bash
ssh -i "C:\Users\shubh\Downloads\Ivorian.pem" ec2-user@65.0.122.243
```

Run these commands on EC2:
```bash
# Update system
sudo yum update -y

# Install Docker
sudo yum install docker -y
sudo systemctl start docker
sudo systemctl enable docker

# Add ec2-user to docker group
sudo usermod -aG docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create deployment directories
sudo mkdir -p /opt/ivorian-realty
sudo mkdir -p /opt/ivorian-realty/frontend
sudo mkdir -p /opt/ivorian-realty/backend/microservices/infrastructure/nginx
sudo mkdir -p /opt/ivorian-realty/logs

# Change ownership
sudo chown -R ec2-user:ec2-user /opt/ivorian-realty

# Log out and back in for docker group to work
exit
```

SSH back in:
```bash
ssh -i "C:\Users\shubh\Downloads\Ivorian.pem" ec2-user@65.0.122.243
docker ps  # Should work without sudo
```

### Step 2: Add GitHub Secrets

1. Go to: https://github.com/Shubham96681/Ivorian/settings/secrets/actions
2. Add these secrets:
   - `SSH_PRIVATE_KEY` → Content of your `Ivorian.pem` file
   - `SSH_USER` → `ec2-user`
   - `SERVER_HOST` → `65.0.122.243`

### Step 3: Push Code (Triggers Auto-Deployment)

From your local machine:
```bash
git push origin master
```

GitHub Actions will automatically:
- Build Docker images
- Copy files to EC2
- Deploy all services

**That's it!** No need to clone on EC2.

---

## Option 2: Manual Clone (For Testing/Debugging)

If you want to clone the repository on EC2 for manual operations:

### Step 1: Setup Git on EC2

```bash
ssh -i "C:\Users\shubh\Downloads\Ivorian.pem" ec2-user@65.0.122.243

# Install Git
sudo yum install git -y

# Configure Git (optional)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### Step 2: Clone Repository

```bash
# Navigate to home directory
cd ~

# Clone the repository
git clone https://github.com/Shubham96681/Ivorian.git

# Navigate into the repository
cd Ivorian/Ivorian_realty
```

### Step 3: Manual Setup (If Needed)

```bash
# Install Docker (if not already installed)
sudo yum install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in
exit
```

SSH back in:
```bash
ssh -i "C:\Users\shubh\Downloads\Ivorian.pem" ec2-user@65.0.122.243
cd ~/Ivorian/Ivorian_realty
```

### Step 4: Manual Deployment (Optional)

If you want to deploy manually instead of using CI/CD:

```bash
# Copy docker-compose file
cp backend/microservices/infrastructure/docker-compose.prod.yml /opt/ivorian-realty/docker-compose.yml

# Copy nginx config
mkdir -p /opt/ivorian-realty/backend/microservices/infrastructure/nginx
cp backend/microservices/infrastructure/nginx/nginx.conf /opt/ivorian-realty/backend/microservices/infrastructure/nginx/

# Build and start services
cd /opt/ivorian-realty
docker-compose up -d
```

---

## Which Option Should You Use?

### Use Option 1 (CI/CD) if:
- ✅ You want automatic deployments
- ✅ You want to deploy from GitHub Actions
- ✅ You want the easiest setup
- ✅ You want deployments triggered by git push

### Use Option 2 (Manual Clone) if:
- ✅ You want to test things manually
- ✅ You want to debug on the server
- ✅ You want to make changes directly on EC2
- ✅ You want to run commands manually

## Recommended: Use Both!

1. **Setup EC2** (Option 1, Step 1) - Install Docker, create directories
2. **Use CI/CD** (Option 1) - For automatic deployments
3. **Clone repo** (Option 2) - For debugging and manual operations when needed

This way you get:
- Automatic deployments via CI/CD
- Ability to debug/manually test when needed

---

## Quick Start (Recommended Path)

```bash
# 1. SSH into EC2
ssh -i "C:\Users\shubh\Downloads\Ivorian.pem" ec2-user@65.0.122.243

# 2. Install Docker and setup (one-time)
sudo yum update -y
sudo yum install docker git -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo mkdir -p /opt/ivorian-realty/{frontend,backend/microservices/infrastructure/nginx,logs}
sudo chown -R ec2-user:ec2-user /opt/ivorian-realty

# 3. Clone repo (for manual access)
cd ~
git clone https://github.com/Shubham96681/Ivorian.git

# 4. Log out and back in
exit
```

```bash
# SSH back in
ssh -i "C:\Users\shubh\Downloads\Ivorian.pem" ec2-user@65.0.122.243

# Verify Docker works
docker ps

# Now you have:
# - Docker installed and ready
# - Directories created for deployment
# - Repository cloned for manual access
# - Ready for CI/CD deployments!
```

Then add GitHub Secrets and push code - CI/CD will handle the rest!

