#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date -Is)] $*"; }

: "${IMAGE_TAG:?IMAGE_TAG is required}"
ENV_FILE="${ENV_FILE:-/home/ubuntu/eljiran/.env}"
IMAGE_REPO_FRONTEND="${IMAGE_REPO_FRONTEND:-ghcr.io/${GITHUB_REPOSITORY_OWNER:-${GITHUB_REPOSITORY:-unknown}}/eljiran-frontend}"
NEW_IMAGE="${IMAGE_REPO_FRONTEND}:${IMAGE_TAG}"
COMPOSE_PROJECT_NAME="eljiran"
NETWORK_NAME="${COMPOSE_PROJECT_NAME}_eljiran-network"
PREV_IMAGE="$(docker ps --filter name=eljiran-frontend --format '{{.Image}}' | head -n1 || true)"

# If image not present locally, attempt to pull (when creds provided). If already loaded (from docker load), skip pull.
if ! docker image inspect "${NEW_IMAGE}" >/dev/null 2>&1; then
  if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_TOKEN:-}" ]]; then
    echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin
    log "Pulling frontend image ${NEW_IMAGE}"
    docker pull "${NEW_IMAGE}"
  else
    log "Image ${NEW_IMAGE} not present locally and no registry credentials provided; assuming image was loaded via docker load."
  fi
else
  log "Image ${NEW_IMAGE} already present locally; skipping pull."
fi

log "Using env file: ${ENV_FILE}"
log "Deploying frontend with image ${NEW_IMAGE}"
FRONTEND_IMAGE="${NEW_IMAGE}" docker compose -p "${COMPOSE_PROJECT_NAME}" --env-file "${ENV_FILE}" -f deploy/docker-compose.prod.yml up -d --no-deps frontend

log "Running frontend health checks..."
health_ok=true
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-http://eljiran-frontend:3000/health}"
for attempt in {1..12}; do
  if docker run --rm --network "${NETWORK_NAME}" curlimages/curl:8.5.0 -fsS "${FRONTEND_HEALTH_URL}" > /dev/null; then
    health_ok=true
    break
  fi
  health_ok=false
  sleep 5
done

# Optional external check; warn but do not block rollback decision
if ! docker run --rm curlimages/curl:8.5.0 -fsSI https://eljiran.com | head -n1 | grep "200" > /dev/null; then
  log "Warning: external https://eljiran.com check failed; proceeding based on internal health."
fi

if [[ "${health_ok}" != "true" ]]; then
  log "Health check FAILED. Rolling back to previous image: ${PREV_IMAGE:-<none>}"
  if [[ -n "${PREV_IMAGE}" ]]; then
    if ! docker image inspect "${PREV_IMAGE}" >/dev/null 2>&1; then
      docker pull "${PREV_IMAGE}" || true
    fi
    FRONTEND_IMAGE="${PREV_IMAGE}" docker compose -p "${COMPOSE_PROJECT_NAME}" --env-file "${ENV_FILE}" -f deploy/docker-compose.prod.yml up -d --no-deps frontend
  else
    log "No previous image recorded; skipping rollback."
  fi
  exit 1
fi

log "Frontend deployment successful."
