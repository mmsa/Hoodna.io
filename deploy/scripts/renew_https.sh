#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date -Is)] $*"; }

DEPLOY_DIR="${DEPLOY_DIR:-/home/ubuntu/eljiran}"
COMPOSE_FILE="${COMPOSE_FILE:-$DEPLOY_DIR/deploy/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/.env}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-eljiran}"

CERTBOT_DIR="$DEPLOY_DIR/deploy/nginx/certbot"
CONF_DIR="$CERTBOT_DIR/conf"
WWW_DIR="$CERTBOT_DIR/www"

mkdir -p "$CONF_DIR" "$WWW_DIR"

log "Renewing Let's Encrypt certificates (if needed)..."
docker run --rm \
  -v "$CONF_DIR:/etc/letsencrypt" \
  -v "$WWW_DIR:/var/www/certbot" \
  certbot/certbot \
  renew --webroot -w /var/www/certbot

log "Reloading nginx..."
docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T nginx nginx -s reload

log "Renewal complete."
