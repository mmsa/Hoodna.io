"""
Add change request fields to service_provider_profiles table.
"""
import asyncio
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from scripts.utils import get_db_url


async def add_change_request_fields():
    """Add change request fields to service_provider_profiles."""
    db_url = get_db_url()
    engine = create_async_engine(db_url, echo=True)
    
    async with engine.begin() as conn:
        # Check if column already exists
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='service_provider_profiles' AND column_name='category_change_request'
        """))
        exists = result.scalar_one_or_none() is not None
        
        if exists:
            print("✅ Change request fields already exist")
        else:
            print("🔄 Adding change request fields...")
            
            # Add columns
            await conn.execute(text("""
                ALTER TABLE service_provider_profiles
                ADD COLUMN category_change_request INTEGER,
                ADD COLUMN compounds_change_request INTEGER[],
                ADD COLUMN change_request_reason TEXT,
                ADD COLUMN change_request_status VARCHAR,
                ADD COLUMN change_request_reviewed_at TIMESTAMP WITH TIME ZONE,
                ADD COLUMN change_request_reviewed_by INTEGER
            """))
            
            # Add foreign key constraint for category_change_request
            await conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint 
                        WHERE conname = 'fk_provider_category_change_request'
                    ) THEN
                        ALTER TABLE service_provider_profiles
                        ADD CONSTRAINT fk_provider_category_change_request
                        FOREIGN KEY (category_change_request) 
                        REFERENCES service_categories(id);
                    END IF;
                END $$;
            """))
            
            # Add foreign key constraint for change_request_reviewed_by
            await conn.execute(text("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint 
                        WHERE conname = 'fk_provider_change_request_reviewed_by'
                    ) THEN
                        ALTER TABLE service_provider_profiles
                        ADD CONSTRAINT fk_provider_change_request_reviewed_by
                        FOREIGN KEY (change_request_reviewed_by) 
                        REFERENCES users(id);
                    END IF;
                END $$;
            """))
            
            print("✅ Added change request fields")
    
    await engine.dispose()
    print("✅ Migration complete!")


if __name__ == "__main__":
    asyncio.run(add_change_request_fields())

