# eljiran.com EC2 Deployment Plan

## Architecture Overview

### Services
- **Web (Next.js)**: Server-side rendered Next.js app on port 3000
- **Backend API (FastAPI)**: REST API on port 8000
- **Database (PostgreSQL)**: PostgreSQL 15 on port 5432 (internal)
- **Nginx**: Reverse proxy on ports 80/443

### Domains & Ports
- **Production Domain**: `eljiran.com` (or your domain)
- **API Domain**: `api.eljiran.com` (or `eljiran.com/api`)
- **Web Port**: 3000 (internal)
- **API Port**: 8000 (internal)
- **Nginx Ports**: 80 (HTTP), 443 (HTTPS)

### Deployment Architecture

```
Internet
   ↓
Nginx (80/443) - SSL termination
   ├─→ eljiran.com → Next.js (3000)
   └─→ api.eljiran.com → FastAPI (8000)
        ↓
   PostgreSQL (5432, internal)
   AWS S3 (external, presigned URLs)
```

## Docker Compose Services

### Production Stack (`deploy/docker-compose.prod.yml`)

1. **postgres**
   - Image: `postgres:15-alpine`
   - Port: 5432 (internal only)
   - Volumes: `postgres_data:/var/lib/postgresql/data`
   - Environment: From `.env` file

2. **backend**
   - Build: `./backend`
   - Port: 8000 (internal)
   - Environment: All backend env vars from `.env`
   - Depends on: `postgres`
   - Command: Run migrations + start uvicorn

3. **frontend**
   - Build: `./frontend`
   - Port: 3000 (internal)
   - Environment: `NEXT_PUBLIC_API_URL` (points to backend)
   - Depends on: `backend`

4. **nginx** (optional, can run on host)
   - Image: `nginx:alpine`
   - Ports: 80, 443
   - Volumes: Config + SSL certs
   - Depends on: `frontend`, `backend`

## Nginx Routing Plan

### Routes
- `/` → `http://frontend:3000` (Next.js)
- `/api/*` → `http://backend:8000/api/*` (FastAPI)
- Static files → Served by Next.js or Nginx

### SSL Plan
- **Certbot**: Use Let's Encrypt for SSL certificates
- **Auto-renewal**: Certbot cron job for renewal
- **HTTP → HTTPS**: Redirect all HTTP traffic to HTTPS

## Required GitHub Secrets

Add these in GitHub Settings → Secrets and variables → Actions:

### AWS Credentials
- `AWS_ACCESS_KEY_ID`: AWS access key for S3/SES
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for S3/SES
- `AWS_REGION`: AWS region (e.g., `us-east-1`)

### EC2 Deployment
- `EC2_HOST`: EC2 instance IP or domain (e.g., `ec2-xx-xx-xx-xx.compute-1.amazonaws.com`)
- `EC2_USER`: SSH user (usually `ubuntu` or `ec2-user`)
- `EC2_SSH_KEY`: Private SSH key for EC2 (base64 encoded or raw)
- `EC2_SSH_KEY_PASSPHRASE`: (Optional) Passphrase for SSH key

### Application Secrets
- `SECRET_KEY`: JWT secret key (generate with `openssl rand -hex 32`)
- `DATABASE_URL`: PostgreSQL connection string (production)
- `STRIPE_SECRET_KEY`: Stripe secret key
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook secret
- `OPENAI_API_KEY`: OpenAI API key (for LLM verification)

### S3 Configuration
- `S3_BUCKET_NAME`: S3 bucket name (e.g., `eljiran-uploads-prod`)

### Email Configuration
- `SES_FROM_EMAIL`: Verified SES sender email
- `SES_FROM_NAME`: Sender name

### Frontend Configuration
- `NEXT_PUBLIC_API_URL`: Public API URL (e.g., `https://api.eljiran.com`)

## Required EC2 Environment Variables

Create `/home/ubuntu/eljiran/.env` on EC2 with:

```env
# Database
DATABASE_URL=postgresql+asyncpg://hoodna:PASSWORD@postgres:5432/hoodna

# JWT
SECRET_KEY=your-production-secret-key-here
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

## S3 Plan

### Current Implementation
- ✅ S3 already implemented in `backend/app/services/s3.py`
- ✅ Presigned URLs for uploads
- ✅ Supports AWS S3 and S3-compatible services

### Required Setup

1. **Create S3 Bucket**:
   - Name: `eljiran-uploads-prod` (or your preferred name)
   - Region: Match `AWS_REGION`
   - Public access: Block public access (files accessed via presigned URLs)

2. **IAM User/Role Policy**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:DeleteObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::eljiran-uploads-prod",
           "arn:aws:s3:::eljiran-uploads-prod/*"
         ]
       }
     ]
   }
   ```

3. **CORS Configuration** (if needed):
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
       "AllowedOrigins": ["https://eljiran.com", "https://www.eljiran.com"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

4. **Environment Variables**:
   - `AWS_ACCESS_KEY_ID`: IAM user access key
   - `AWS_SECRET_ACCESS_KEY`: IAM user secret key
   - `AWS_REGION`: S3 bucket region
   - `S3_BUCKET_NAME`: Bucket name
   - `S3_ENDPOINT_URL`: Leave empty for AWS S3

## Deployment Flow

1. **GitHub Actions Trigger**:
   - Push to `main` branch OR manual `workflow_dispatch`
   - CI workflow runs first (lint + tests)
   - If CI passes, deploy workflow runs

2. **Deployment Steps**:
   - SSH to EC2 instance
   - Pull latest code from GitHub
   - Build Docker images
   - Run database migrations
   - Restart services via docker-compose
   - Health check

3. **Rollback**:
   - SSH to EC2
   - `git checkout <previous-commit>`
   - Run `remote_deploy.sh` again

## Next Steps (Step 2)

After Step 1 is complete:

1. **Set up EC2 instance**:
   - Launch EC2 instance (Ubuntu 22.04 LTS recommended)
   - Configure security groups (ports 22, 80, 443)
   - Run `first_time_ec2_setup.md` commands

2. **Configure GitHub Secrets**:
   - Add all required secrets listed above

3. **Set up domain & SSL**:
   - Point DNS to EC2 IP
   - Run Certbot to get SSL certificates
   - Update Nginx config with domain names

4. **Create S3 bucket**:
   - Create bucket in AWS
   - Configure IAM user with S3 permissions
   - Add credentials to GitHub Secrets

5. **Test deployment**:
   - Trigger deployment workflow
   - Verify services are running
   - Test API endpoints
   - Test file uploads

6. **Monitor**:
   - Set up CloudWatch or similar monitoring
   - Configure log aggregation
   - Set up alerts

## Notes

- **Database Migrations**: Run automatically on backend startup via `alembic upgrade head`
- **Static Files**: Next.js handles static assets, S3 handles user uploads
- **SSL**: Use Let's Encrypt (free) via Certbot
- **Backups**: Set up automated PostgreSQL backups
- **Monitoring**: Consider CloudWatch, DataDog, or similar
- **Scaling**: Current setup is single-instance; consider ECS/EKS for scaling

