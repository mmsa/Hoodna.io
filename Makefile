.PHONY: help seed-compounds migrate test

help:
	@echo "Available targets:"
	@echo "  seed-compounds  - Seed compounds from CSV file"
	@echo "  migrate        - Run database migrations"
	@echo "  test           - Run tests"

seed-compounds:
	@echo "Seeding compounds from CSV..."
	cd backend && python3 scripts/seed_compounds.py

migrate:
	@echo "Running database migrations..."
	cd backend && python3 -m alembic upgrade head

test:
	@echo "Running tests..."
	cd backend && python3 -m pytest tests/ -v

