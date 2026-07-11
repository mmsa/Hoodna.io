#!/usr/bin/env bash
set -euo pipefail

# Run migrations then start the API (used by Render)
alembic upgrade head

# Seed Egypt compounds if the table is empty (idempotent; skips when data exists).
# Do not block API boot if seeding fails — log and continue.
if ! python -m scripts.seed_compounds; then
  echo "⚠️  Compound seed failed; continuing API startup"
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
