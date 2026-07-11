"""
Seed compounds from CSV file (ONE-TIME INITIAL DATA POPULATION).

This script is for initial seeding only. After this, users request compounds
via POST /api/compounds/request, and admins complete the details via
PATCH /api/admin/compounds/{compound_id}.

Reads egypt_compounds_2025.csv and upserts compounds by compound_id.
"""
import asyncio
import csv
import os
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

# Import all models to ensure relationships are set up
from app.models import compound, user, post, listing, verification  # noqa
from app.models.compound import Compound
from app.models.enums import CompoundStatus2025
from scripts.utils import get_db_url



# Required CSV headers
REQUIRED_HEADERS = [
    "compound_id",
    "compound_name",
    "area",
    "sub_area",
    "category",
    "developer",
    "status_2025",
    "delivery_notes",
    "source_hint",
    "last_verified_date",
    "lat",
    "lng",
]

# Allowed status values
ALLOWED_STATUSES = {status.value for status in CompoundStatus2025}


def normalize_string(value: str) -> Optional[str]:
    """Trim whitespace and convert empty strings to None."""
    if not value:
        return None
    result = value.strip()
    return result if result else None


def normalize_float(value: str) -> Optional[Decimal]:
    """Convert string to Decimal, return None if empty or invalid."""
    if not value or not value.strip():
        return None
    try:
        return Decimal(value.strip())
    except (InvalidOperation, ValueError):
        return None


def normalize_date(value: str) -> Optional[datetime]:
    """Convert YYYY-MM-DD string to date, return None if empty or invalid."""
    if not value or not value.strip():
        return None
    try:
        return datetime.strptime(value.strip(), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def validate_status(status: str) -> str:
    """Validate status against allowed enum values."""
    normalized = normalize_string(status)
    if not normalized:
        raise ValueError(f"status_2025 cannot be empty")
    if normalized not in ALLOWED_STATUSES:
        raise ValueError(
            f"Invalid status_2025: '{normalized}'. Must be one of: {', '.join(ALLOWED_STATUSES)}"
        )
    return normalized


def validate_row(row: dict, row_num: int) -> dict:
    """Validate and normalize a CSV row."""
    errors = []
    
    # Check required fields
    compound_id = normalize_string(row.get("compound_id"))
    compound_name = normalize_string(row.get("compound_name"))
    area = normalize_string(row.get("area"))
    status_2025 = row.get("status_2025", "").strip()
    
    if not compound_id:
        errors.append("compound_id is required")
    if not compound_name:
        errors.append("compound_name is required")
    if not area:
        errors.append("area is required")
    if not status_2025:
        errors.append("status_2025 is required")
    
    if errors:
        raise ValueError(f"Row {row_num}: {', '.join(errors)}")
    
    # Validate status
    try:
        status_2025 = validate_status(status_2025)
    except ValueError as e:
        errors.append(str(e))
    
    if errors:
        raise ValueError(f"Row {row_num}: {', '.join(errors)}")
    
    # Normalize all fields
    return {
        "compound_id": compound_id,
        "name": compound_name,
        "area": area,
        "sub_area": normalize_string(row.get("sub_area")),
        "category": normalize_string(row.get("category")),
        "developer": normalize_string(row.get("developer")),
        "status_2025": status_2025,
        "delivery_notes": normalize_string(row.get("delivery_notes")),
        "source_hint": normalize_string(row.get("source_hint")),
        "last_verified_date": normalize_date(row.get("last_verified_date")),
        "lat": normalize_float(row.get("lat")),
        "lng": normalize_float(row.get("lng")),
        # Set city from area for backward compatibility
        "city": area,
        "country": "Egypt",
    }


async def seed_compounds_from_csv(csv_path: Path, db: AsyncSession) -> dict:
    """Read CSV and upsert compounds."""
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")
    
    inserted_count = 0
    updated_count = 0
    skipped_count = 0
    errors = []
    
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        
        # Validate headers
        if not reader.fieldnames:
            raise ValueError("CSV file is empty or has no headers")
        
        missing_headers = set(REQUIRED_HEADERS) - set(reader.fieldnames)
        if missing_headers:
            raise ValueError(f"Missing required headers: {', '.join(missing_headers)}")
        
        # Process rows
        rows_to_upsert = []
        for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
            try:
                normalized_row = validate_row(row, row_num)
                rows_to_upsert.append(normalized_row)
            except ValueError as e:
                skipped_count += 1
                errors.append(str(e))
                print(f"⚠️  {e}")
        
        if not rows_to_upsert:
            print("No valid rows to process")
            return {
                "inserted": 0,
                "updated": 0,
                "skipped": skipped_count,
                "errors": errors,
            }
        
        # Upsert compounds row by row (in a transaction for efficiency)
        for row_data in rows_to_upsert:
            compound_id = row_data["compound_id"]
            
            # Check if exists
            result = await db.execute(
                select(Compound).where(Compound.compound_id == compound_id)
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                # Update existing
                for key, value in row_data.items():
                    setattr(existing, key, value)
                existing.updated_at = datetime.utcnow()
                updated_count += 1
            else:
                # Insert new
                new_compound = Compound(**row_data)
                db.add(new_compound)
                inserted_count += 1
        
        await db.commit()
    
    return {
        "inserted": inserted_count,
        "updated": updated_count,
        "skipped": skipped_count,
        "errors": errors,
    }


async def main():
    """Main entry point.

    By default skips when compounds already exist (safe for Render startup).
    Set FORCE_SEED_COMPOUNDS=1 to upsert from CSV anyway.
    """
    # Determine CSV path
    csv_path_env = os.getenv("COMPOUNDS_CSV_PATH")
    if csv_path_env:
        csv_path = Path(csv_path_env)
    else:
        # Default: data/compounds/egypt_compounds_2025.csv relative to backend/
        backend_dir = Path(__file__).parent.parent
        csv_path = backend_dir / "data" / "compounds" / "egypt_compounds_2025.csv"
    
    print(f"📂 Reading CSV from: {csv_path}")
    
    # Setup database connection
    db_url = get_db_url()
    engine = create_async_engine(db_url, echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            force = os.getenv("FORCE_SEED_COMPOUNDS", "").strip() in {"1", "true", "yes"}
            if not force:
                existing_count = await session.scalar(select(func.count()).select_from(Compound))
                if existing_count and existing_count > 0:
                    print(f"⏭️  Compounds already present ({existing_count}); skipping seed.")
                    print("   Set FORCE_SEED_COMPOUNDS=1 to re-upsert from CSV.")
                    await engine.dispose()
                    return

            result = await seed_compounds_from_csv(csv_path, session)
            
            print(f"\n✅ Compounds seeded successfully!")
            print(f"   - Inserted: {result['inserted']} new compounds")
            print(f"   - Updated: {result['updated']} existing compounds")
            print(f"   - Skipped: {result['skipped']} invalid rows")
            
            if result["errors"]:
                print(f"\n⚠️  Errors encountered:")
                for error in result["errors"][:10]:  # Show first 10 errors
                    print(f"   {error}")
                if len(result["errors"]) > 10:
                    print(f"   ... and {len(result['errors']) - 10} more errors")
        
        except Exception as e:
            await session.rollback()
            print(f"\n❌ Error seeding compounds: {e}")
            raise
    
    await engine.dispose()



if __name__ == "__main__":
    asyncio.run(main())

