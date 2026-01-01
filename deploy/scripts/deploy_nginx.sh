#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date -Is)] $*"; }

CONFIG_PATH="$(pwd)/deploy/nginx/eljiran.conf"
CERTBOT_WWW="$(pwd)/deploy/nginx/certbot/www"

log "Validating nginx configuration..."
docker run --rm \
  --network deploy_eljiran-network \
  -v "${CONFIG_PATH}:/etc/nginx/conf.d/default.conf:ro" \
  -v /etc/letsencrypt:/etc/letsencrypt:ro \
  -v "${CERTBOT_WWW}:/var/www/certbot" \
  nginx:alpine nginx -t

log "Deploying nginx..."
docker compose -f deploy/docker-compose.prod.yml up -d nginx

log "Running nginx health check..."
if ! docker run --rm curlimages/curl:8.5.0 -fsS https://eljiran.com/nginx-health > /dev/null; then
  log "Health check FAILED for nginx. Please inspect nginx logs and configuration."
  exit 1
fi

log "Nginx deployment successful."
