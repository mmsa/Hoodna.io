#!/usr/bin/env bash
set -euo pipefail

log() { echo "[$(date -Is)] $*"; }

: "${IMAGE_TAG:?IMAGE_TAG is required}"
IMAGE_REPO_BACKEND="${IMAGE_REPO_BACKEND:-ghcr.io/${GITHUB_REPOSITORY_OWNER:-${GITHUB_REPOSITORY:-unknown}}/eljiran-backend}"
NEW_IMAGE="${IMAGE_REPO_BACKEND}:${IMAGE_TAG}"
PREV_IMAGE="$(docker ps --filter name=eljiran-backend --format '{{.Image}}' | head -n1 || true)"

if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  echo "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin
fi

log "Pulling backend image ${NEW_IMAGE}"
docker pull "${NEW_IMAGE}"

log "Deploying backend with image ${NEW_IMAGE}"
BACKEND_IMAGE="${NEW_IMAGE}" docker compose -f deploy/docker-compose.prod.yml up -d backend

log "Running backend health check..."
if ! docker run --rm --network deploy_eljiran-network curlimages/curl:8.5.0 -fsS https://eljiran.com/api/health > /dev/null; then
  log "Health check FAILED. Rolling back to previous image: ${PREV_IMAGE:-<none>}"
  if [[ -n "${PREV_IMAGE}" ]]; then
    docker pull "${PREV_IMAGE}" || true
    BACKEND_IMAGE="${PREV_IMAGE}" docker compose -f deploy/docker-compose.prod.yml up -d backend
  else
    log "No previous image recorded; skipping rollback."
  fi
  exit 1
fi

log "Backend deployment successful."
