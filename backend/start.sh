#!/usr/bin/env bash
set -euo pipefail

# Postgres on Render can refuse connections for a few seconds after a restart.
# Alembic is required (schema), so retry instead of failing the whole deploy.
max_attempts="${ALEMBIC_MAX_ATTEMPTS:-8}"
delay_seconds="${ALEMBIC_RETRY_DELAY:-5}"
attempt=1
until alembic upgrade head; do
  if [ "${attempt}" -ge "${max_attempts}" ]; then
    echo "❌ alembic upgrade head failed after ${max_attempts} attempts"
    exit 1
  fi
  echo "⚠️  alembic failed (attempt ${attempt}/${max_attempts}); retrying in ${delay_seconds}s"
  attempt=$((attempt + 1))
  sleep "${delay_seconds}"
done

# Seed Egypt compounds if the table is empty (idempotent; skips when data exists).
# Do not block API boot if seeding fails — log and continue.
if ! python -m scripts.seed_compounds; then
  echo "⚠️  Compound seed failed; continuing API startup"
fi

# Keep provider onboarding reference categories available on every environment.
if ! python -m scripts.create_service_categories; then
  echo "⚠️  Service category seed failed; continuing API startup"
fi

# Ensure admin account exists (idempotent upsert)
if ! python -m scripts.seed; then
  echo "⚠️  Admin seed failed; continuing API startup"
fi

# Optional one-off user password reset (set RESET_USER_EMAIL + RESET_USER_PASSWORD on Render)
if [ -n "${RESET_USER_EMAIL:-}" ] && [ -n "${RESET_USER_PASSWORD:-}" ]; then
  if ! python -m scripts.reset_user_password; then
    echo "⚠️  User password reset failed; continuing API startup"
  fi
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
