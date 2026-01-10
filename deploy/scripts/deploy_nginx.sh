#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date -Is)] $*"; }

CONFIG_PATH="$(pwd)/deploy/nginx/eljiran.conf"
CERTBOT_DIR="$(pwd)/deploy/nginx/certbot"
CERTBOT_CONF="${CERTBOT_DIR}/conf"
CERTBOT_WWW="${CERTBOT_DIR}/www"
ENV_FILE="${ENV_FILE:-/home/ubuntu/eljiran/.env}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-eljiran}"
NETWORK_NAME="${COMPOSE_PROJECT_NAME}_eljiran-network"

mkdir -p "${CERTBOT_CONF}" "${CERTBOT_WWW}"

log "Validating nginx configuration..."
docker run --rm \
  --network "${NETWORK_NAME}" \
  -v "${CONFIG_PATH}:/etc/nginx/conf.d/default.conf:ro" \
  -v "${CERTBOT_CONF}:/etc/letsencrypt:ro" \
  -v "${CERTBOT_WWW}:/var/www/certbot" \
  nginx:alpine nginx -t

log "Deploying nginx..."
docker compose -p "${COMPOSE_PROJECT_NAME}" --env-file "${ENV_FILE}" -f deploy/docker-compose.prod.yml up -d nginx

log "Running nginx health check..."
if ! docker run --rm --network "${NETWORK_NAME}" curlimages/curl:8.5.0 -fsS http://nginx/nginx-health > /dev/null; then
  log "Health check FAILED for nginx. Please inspect nginx logs and configuration."
  exit 1
fi

log "Nginx deployment successful."
