.PHONY: help seed-compounds recreate-compounds migrate test

help:
	@echo "Available targets:"
	@echo "  seed-compounds     - Seed compounds from CSV file"
	@echo "  recreate-compounds - Drop and recreate compounds table from CSV schema, then seed"
	@echo "  migrate           - Run database migrations"
	@echo "  test              - Run tests"

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

