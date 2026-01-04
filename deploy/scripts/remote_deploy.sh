#!/bin/bash
# Remote deployment script for EC2
# This script is executed on the EC2 instance via GitHub Actions

set -e  # Exit on error

echo "=========================================="
echo "eljiran.com Deployment Script"
echo "=========================================="
echo "Timestamp: $(date)"
echo ""

# Configuration
DEPLOY_DIR="/home/ubuntu/eljiran"
COMPOSE_FILE="$DEPLOY_DIR/deploy/docker-compose.prod.yml"
ENV_FILE="$DEPLOY_DIR/.env"

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: .env file not found at $ENV_FILE"
    echo "Please create the .env file with all required environment variables."
    exit 1
fi

# Navigate to deployment directory
cd "$DEPLOY_DIR" || {
    echo "ERROR: Cannot access deployment directory: $DEPLOY_DIR"
    exit 1
}

echo "Current directory: $(pwd)"
echo "Git commit: $(git rev-parse HEAD)"
echo "Git branch: $(git branch --show-current)"
echo ""

# Pull latest changes
echo "=========================================="
echo "Step 1: Pulling latest changes from Git"
echo "=========================================="
export GIT_SSH_COMMAND="ssh -i ~/.ssh/github_deploy -o StrictHostKeyChecking=yes"
git fetch origin
git reset --hard origin/main  # or origin/master, adjust as needed
# Preserve environment/secrets and certbot/ssl folders; clean everything else.
git clean -fd -e .env -e ".env.*" -e deploy/nginx/certbot -e deploy/nginx/ssl
echo "✓ Git pull complete"
echo ""

# Build and deploy
echo "=========================================="
echo "Step 2: Building and deploying services"
echo "=========================================="

# Stop existing containers (if any)
echo "Stopping existing containers..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" down || true

# Pull latest images (if using pre-built images)
# docker-compose -f "$COMPOSE_FILE" pull || true

# Build images
echo "Building Docker images..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build

# Start services
echo "Starting services..."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
sleep 10

# Check service health
echo "=========================================="
echo "Step 3: Health checks"
echo "=========================================="

# Check backend health
echo "Checking backend health..."
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health || echo "000")
if [ "$BACKEND_HEALTH" = "200" ]; then
    echo "✓ Backend is healthy"
else
    echo "✗ Backend health check failed (HTTP $BACKEND_HEALTH)"
    echo "Backend logs:"
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=50 backend
    exit 1
fi

# Check frontend health
echo "Checking frontend health..."
FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
if [ "$FRONTEND_HEALTH" = "200" ]; then
    echo "✓ Frontend is healthy"
else
    echo "⚠ Frontend health check returned HTTP $FRONTEND_HEALTH (may be expected)"
fi

# Check database connection
echo "Checking database connection..."
DB_CHECK=$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres pg_isready -U hoodna 2>/dev/null || echo "not ready")
if echo "$DB_CHECK" | grep -q "accepting connections"; then
    echo "✓ Database is ready"
else
    echo "✗ Database is not ready"
    exit 1
fi

# Show running containers
echo ""
echo "=========================================="
echo "Step 4: Service status"
echo "=========================================="
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

# Cleanup old images (optional)
echo ""
echo "=========================================="
echo "Step 5: Cleanup"
echo "=========================================="
echo "Removing unused Docker images..."
docker image prune -f || true

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
echo "Services are running at:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend: http://localhost:8000"
echo "  - Database: localhost:5432"
echo ""
echo "View logs with:"
echo "  docker-compose -f $COMPOSE_FILE logs -f"
echo ""
