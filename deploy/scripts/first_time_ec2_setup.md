# First-Time EC2 Setup Guide

This guide walks through setting up a fresh EC2 instance for eljiran.com deployment.

## Prerequisites

- EC2 instance launched (Ubuntu 22.04 LTS recommended)
- Security group configured with ports: 22 (SSH), 80 (HTTP), 443 (HTTPS)
- SSH access to the instance

## Step 1: Initial Server Setup

### 1.1 Connect to EC2 Instance

```bash
ssh -i /path/to/your-key.pem ubuntu@your-ec2-ip
```

### 1.2 Update System Packages

```bash
sudo apt update
sudo apt upgrade -y
```

### 1.3 Install Required Software

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
sudo apt install -y git

# Install Nginx (if running on host, not in Docker)
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# Install other utilities
sudo apt install -y curl wget unzip
```

### 1.4 Logout and Login Again

```bash
exit
# Then SSH back in to apply docker group changes
```

## Step 2: Configure Firewall (UFW)

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

## Step 3: Clone Repository

```bash
# Create deployment directory
mkdir -p /home/ubuntu/eljiran
cd /home/ubuntu/eljiran

# Clone repository (replace with your repo URL)
git clone https://github.com/your-org/eljiran.git .

# Or if using SSH:
# git clone git@github.com:your-org/eljiran.git .
```

## Step 4: Create Environment File

```bash
cd /home/ubuntu/eljiran
nano .env
```

Add all required environment variables (see `docs/deploy-plan.md` for full list):

```env
# Database
DATABASE_URL=postgresql+asyncpg://hoodna:YOUR_SECURE_PASSWORD@postgres:5432/hoodna
POSTGRES_USER=hoodna
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD
POSTGRES_DB=hoodna

# JWT
SECRET_KEY=your-secret-key-generate-with-openssl-rand-hex-32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30

# CORS
CORS_ORIGINS=["https://eljiran.com","https://www.eljiran.com"]

# AWS S3
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=eljiran-uploads-prod
S3_ENDPOINT_URL=

# Stripe
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_PUBLISHABLE_KEY=pk_live_your_publishable_key

# AWS SES
SES_FROM_EMAIL=noreply@eljiran.com
SES_FROM_NAME=eljiran.com

# App
ENVIRONMENT=production
FRONTEND_URL=https://eljiran.com

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# Next.js
NEXT_PUBLIC_API_URL=https://api.eljiran.com
```

Save and exit (Ctrl+X, then Y, then Enter).

## Step 5: Set Up SSL Certificates (Let's Encrypt)

### 5.1 Point DNS to EC2 IP

Before running Certbot, ensure your domain DNS records point to your EC2 instance:
- `eljiran.com` → EC2 IP
- `www.eljiran.com` → EC2 IP
- `api.eljiran.com` → EC2 IP

### 5.2 Obtain SSL Certificates

```bash
# If using Nginx on host (not in Docker)
sudo certbot --nginx -d eljiran.com -d www.eljiran.com -d api.eljiran.com

# If using Nginx in Docker, use standalone mode
sudo certbot certonly --standalone -d eljiran.com -d www.eljiran.com -d api.eljiran.com
```

### 5.3 Update Nginx Configuration

If using Nginx in Docker, update `deploy/nginx/eljiran.conf` with certificate paths:

```nginx
ssl_certificate /etc/letsencrypt/live/eljiran.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/eljiran.com/privkey.pem;
```

And mount the certificates in `docker-compose.prod.yml`:

```yaml
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro
```

### 5.4 Set Up Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot automatically sets up a cron job, but verify:
sudo systemctl status certbot.timer
```

## Step 6: Configure Nginx (If Running on Host)

If you prefer to run Nginx on the host instead of in Docker:

```bash
# Copy Nginx config
sudo cp /home/ubuntu/eljiran/deploy/nginx/eljiran.conf /etc/nginx/sites-available/eljiran
sudo ln -s /etc/nginx/sites-available/eljiran /etc/nginx/sites-enabled/

# Remove default config
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Step 7: Test Deployment

```bash
cd /home/ubuntu/eljiran

# Make deployment script executable
chmod +x deploy/scripts/remote_deploy.sh

# Run deployment script manually
./deploy/scripts/remote_deploy.sh
```

## Step 8: Set Up GitHub Actions SSH Key

### 8.1 Generate SSH Key Pair (on your local machine)

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/eljiran_deploy
```

### 8.2 Add Public Key to EC2

```bash
# Copy public key to EC2
ssh-copy-id -i ~/.ssh/eljiran_deploy.pub ubuntu@your-ec2-ip
```

### 8.3 Add Private Key to GitHub Secrets

```bash
# Display private key (copy this)
cat ~/.ssh/eljiran_deploy

# Add to GitHub Secrets → EC2_SSH_KEY
```

### 8.4 Add Other GitHub Secrets

Add all secrets listed in `docs/deploy-plan.md` to GitHub Settings → Secrets and variables → Actions.

## Step 9: Verify Deployment

### 9.1 Check Services

```bash
cd /home/ubuntu/eljiran
docker-compose -f deploy/docker-compose.prod.yml ps
docker-compose -f deploy/docker-compose.prod.yml logs -f
```

### 9.2 Test Endpoints

```bash
# Backend health check
curl http://localhost:8000/health

# Frontend (if health endpoint exists)
curl http://localhost:3000/health
```

### 9.3 Test from Browser

- Visit `https://eljiran.com` (should show Next.js app)
- Visit `https://api.eljiran.com/health` (should return "healthy")
- Visit `https://api.eljiran.com/docs` (should show FastAPI docs)

## Step 10: Set Up Monitoring (Optional)

### 10.1 Install Monitoring Tools

```bash
# Install htop for process monitoring
sudo apt install -y htop

# Install Docker stats monitoring
# Already included with Docker
```

### 10.2 Set Up Log Rotation

```bash
# Docker logs are managed by Docker, but you can set up log rotation
sudo nano /etc/docker/daemon.json
```

Add:

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

Restart Docker:

```bash
sudo systemctl restart docker
```

## Troubleshooting

### Docker Permission Denied

```bash
sudo usermod -aG docker $USER
# Logout and login again
```

### Port Already in Use

```bash
# Check what's using the port
sudo lsof -i :80
sudo lsof -i :443

# Stop conflicting services
sudo systemctl stop apache2  # If Apache is running
sudo systemctl stop nginx     # If Nginx is running on host
```

### SSL Certificate Issues

```bash
# Check certificate status
sudo certbot certificates

# Renew manually if needed
sudo certbot renew
```

### Database Connection Issues

```bash
# Check database logs
docker-compose -f deploy/docker-compose.prod.yml logs postgres

# Test database connection
docker-compose -f deploy/docker-compose.prod.yml exec postgres psql -U hoodna -d hoodna
```

## Next Steps

After completing this setup:

1. Test GitHub Actions deployment workflow
2. Set up automated backups for PostgreSQL
3. Configure CloudWatch or similar monitoring
4. Set up alerts for service failures
5. Review security best practices

## Security Checklist

- [ ] Firewall (UFW) configured
- [ ] SSH key-based authentication only (disable password auth)
- [ ] Strong database password set
- [ ] JWT secret key is secure and random
- [ ] AWS credentials have minimal required permissions
- [ ] SSL certificates installed and auto-renewal configured
- [ ] Regular security updates enabled
- [ ] Database backups configured
- [ ] Logs are monitored
- [ ] Access logs are reviewed regularly

