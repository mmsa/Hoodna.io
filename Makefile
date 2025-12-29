.PHONY: help seed-compounds recreate-compounds migrate test start-backend start-frontend start-mobile start-all

help:
	@echo "Available targets:"
	@echo "  start-backend     - Start FastAPI backend server"
	@echo "  start-frontend    - Start Next.js frontend server"
	@echo "  start-mobile      - Start Expo mobile dev server"
	@echo "  start-all         - Start backend, frontend, and mobile (in background)"
	@echo "  seed-compounds    - Seed compounds from CSV file"
	@echo "  recreate-compounds - Drop and recreate compounds table from CSV schema, then seed"
	@echo "  migrate           - Run database migrations"
	@echo "  test              - Run tests"

start-backend:
	@echo "🚀 Starting backend server..."
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

start-frontend:
	@echo "🚀 Starting frontend server..."
	cd frontend && npm run dev

start-mobile:
	@echo "🚀 Starting mobile dev server..."
	cd mobile && npx expo start

start-all:
	@echo "🚀 Starting all services..."
	@echo "Backend: http://localhost:8000"
	@echo "Frontend: http://localhost:3000"
	@echo "Mobile: Scan QR code from terminal"
	@echo ""
	@echo "Starting backend in background..."
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
	@sleep 2
	@echo "Starting frontend in background..."
	cd frontend && npm run dev &
	@sleep 2
	@echo "Starting mobile..."
	cd mobile && npx expo start

seed-compounds:
	@echo "Seeding compounds from CSV..."
	cd backend && PYTHONPATH=$$(pwd):$$PYTHONPATH python3 scripts/seed_compounds.py

recreate-compounds:
	@echo "Recreating compounds table and seeding from CSV..."
	cd backend && PYTHONPATH=$$(pwd):$$PYTHONPATH python3 scripts/recreate_compounds_table.py
	cd backend && PYTHONPATH=$$(pwd):$$PYTHONPATH python3 scripts/seed_compounds.py

migrate:
	@echo "Running database migrations..."
	cd backend && python3 -m alembic upgrade head

test:
	@echo "Running tests..."
	cd backend && python3 -m pytest tests/ -v

