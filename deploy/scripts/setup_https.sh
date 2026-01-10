#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date -Is)] $*"; }

DEPLOY_DIR="${DEPLOY_DIR:-/home/ubuntu/eljiran}"
COMPOSE_FILE="${COMPOSE_FILE:-$DEPLOY_DIR/deploy/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$DEPLOY_DIR/.env}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-eljiran}"

LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
LETSENCRYPT_DOMAINS="${LETSENCRYPT_DOMAINS:-eljiran.com}"

if [ -z "$LETSENCRYPT_EMAIL" ]; then
  echo "ERROR: LETSENCRYPT_EMAIL is not set"
  exit 1
fi

CERTBOT_DIR="$DEPLOY_DIR/deploy/nginx/certbot"
CONF_DIR="$CERTBOT_DIR/conf"
WWW_DIR="$CERTBOT_DIR/www"
CERT_NAME="eljiran.com"
LIVE_DIR="$CONF_DIR/live/$CERT_NAME"
ARCHIVE_DIR="$CONF_DIR/archive/$CERT_NAME"
RENEWAL_CONF="$CONF_DIR/renewal/$CERT_NAME.conf"
SELF_SIGNED_MARKER="$LIVE_DIR/.selfsigned"

mkdir -p "$CONF_DIR" "$WWW_DIR" "$LIVE_DIR"

if [ ! -f "$LIVE_DIR/fullchain.pem" ] || [ ! -f "$LIVE_DIR/privkey.pem" ]; then
  log "Creating temporary self-signed certificate..."
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "$LIVE_DIR/privkey.pem" \
    -out "$LIVE_DIR/fullchain.pem" \
    -subj "/CN=eljiran.com" > /dev/null 2>&1
  touch "$SELF_SIGNED_MARKER"
fi

log "Ensuring nginx is running for ACME challenge..."
docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d nginx

log "Requesting Let's Encrypt certificate..."
DOMAIN_ARGS=()
for domain in $LETSENCRYPT_DOMAINS; do
  DOMAIN_ARGS+=("-d" "$domain")
done

if [ -f "$SELF_SIGNED_MARKER" ]; then
  log "Removing temporary self-signed certificate before certbot..."
  if command -v sudo >/dev/null 2>&1; then
    sudo rm -rf "$CONF_DIR/live/${CERT_NAME}"* \
      "$CONF_DIR/archive/${CERT_NAME}"* \
      "$CONF_DIR/renewal/${CERT_NAME}"*.conf
  else
    rm -rf "$CONF_DIR/live/${CERT_NAME}"* \
      "$CONF_DIR/archive/${CERT_NAME}"* \
      "$CONF_DIR/renewal/${CERT_NAME}"*.conf
  fi
fi

docker run --rm \
  -v "$CONF_DIR:/etc/letsencrypt" \
  -v "$WWW_DIR:/var/www/certbot" \
  certbot/certbot \
  certonly --webroot -w /var/www/certbot \
  --cert-name "$CERT_NAME" \
  --email "$LETSENCRYPT_EMAIL" --agree-tos --no-eff-email \
  "${DOMAIN_ARGS[@]}"

log "Reloading nginx..."
docker compose -p "$COMPOSE_PROJECT_NAME" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T nginx nginx -s reload

log "HTTPS setup complete."
