"""
Run migration 002 directly.
"""
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from scripts.utils import get_db_url

async def run_migration():
    """Run migration 002 to add CSV compound fields."""
    db_url = get_db_url()
    engine = create_async_engine(db_url, echo=True)
    
    async with engine.begin() as conn:
        # Check if columns already exist
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'compounds' AND column_name = 'compound_id'
        """))
        exists = result.scalar_one_or_none()
        
        if exists:
            print("✅ Migration already applied - compound_id column exists")
            return
        
        print("🔄 Running migration 002...")
        
        # Add new columns
        await conn.execute(text("ALTER TABLE compounds ADD COLUMN IF NOT EXISTS compound_id VARCHAR"))
        await conn.execute(text("ALTER TABLE compounds ADD COLUMN IF NOT EXISTS area VARCHAR"))
        await conn.execute(text("ALTER TABLE compounds ADD COLUMN IF NOT EXISTS sub_area VARCHAR"))
        await conn.execute(text("ALTER TABLE compounds ADD COLUMN IF NOT EXISTS category VARCHAR"))
        await conn.execute(text("ALTER TABLE compounds ADD COLUMN IF NOT EXISTS developer VARCHAR"))
        await conn.execute(text("ALTER TABLE compounds ADD COLUMN IF NOT EXISTS status_2025 VARCHAR"))
        await conn.execute(text("ALTER TABLE compounds ADD COLUMN IF NOT EXISTS delivery_notes TEXT"))
        await conn.execute(text("ALTER TABLE compounds ADD COLUMN IF NOT EXISTS source_hint VARCHAR"))
        await conn.execute(text("ALTER TABLE compounds ADD COLUMN IF NOT EXISTS last_verified_date DATE"))
        await conn.execute(text("ALTER TABLE compounds ADD COLUMN IF NOT EXISTS lat NUMERIC(10, 7)"))
        await conn.execute(text("ALTER TABLE compounds ADD COLUMN IF NOT EXISTS lng NUMERIC(10, 7)"))
        await conn.execute(text("ALTER TABLE compounds ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()"))
        
        # Make city nullable
        await conn.execute(text("ALTER TABLE compounds ALTER COLUMN city DROP NOT NULL"))
        
        # Create indexes
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_compounds_compound_id ON compounds(compound_id)"))
        await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_compounds_compound_id ON compounds(compound_id) WHERE compound_id IS NOT NULL"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_compounds_area ON compounds(area)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_compounds_sub_area ON compounds(sub_area)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_compounds_category ON compounds(category)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_compounds_developer ON compounds(developer)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_compounds_status_2025 ON compounds(status_2025)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_compounds_area_status ON compounds(area, status_2025)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_compounds_developer_status ON compounds(developer, status_2025)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_compounds_category_status ON compounds(category, status_2025)"))
        
        print("✅ Migration completed successfully!")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_migration())

