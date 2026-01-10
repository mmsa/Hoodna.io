#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date -Is)] $*"; }

DEPLOY_DIR="${DEPLOY_DIR:-/home/ubuntu/eljiran}"
COMPOSE_FILE="${COMPOSE_FILE:-$DEPLOY_DIR/deploy/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/.env}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-eljiran}"

LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
LETSENCRYPT_DOMAINS="${LETSENCRYPT_DOMAINS:-eljiran.com www.eljiran.com api.eljiran.com}"

if [ -z "$LETSENCRYPT_EMAIL" ]; then
  echo "ERROR: LETSENCRYPT_EMAIL is not set"
  exit 1
fi

CERTBOT_DIR="$DEPLOY_DIR/deploy/nginx/certbot"
CONF_DIR="$CERTBOT_DIR/conf"
WWW_DIR="$CERTBOT_DIR/www"

mkdir -p "$CONF_DIR" "$WWW_DIR"

log "Ensuring nginx is running for ACME challenge..."
docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d nginx

log "Requesting Let's Encrypt certificate..."
DOMAIN_ARGS=()
for domain in $LETSENCRYPT_DOMAINS; do
  DOMAIN_ARGS+=("-d" "$domain")
done

docker run --rm \
  -v "$CONF_DIR:/etc/letsencrypt" \
  -v "$WWW_DIR:/var/www/certbot" \
  certbot/certbot \
  certonly --webroot -w /var/www/certbot \
  --email "$LETSENCRYPT_EMAIL" --agree-tos --no-eff-email \
  "${DOMAIN_ARGS[@]}"

log "Reloading nginx..."
docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T nginx nginx -s reload

log "HTTPS setup complete."
