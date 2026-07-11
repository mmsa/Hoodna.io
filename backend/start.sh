#!/usr/bin/env bash
set -euo pipefail

# Run migrations then start the API (used by Render)
alembic upgrade head

# Seed Egypt compounds if the table is empty (idempotent; skips when data exists)
python -m scripts.seed_compounds

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
