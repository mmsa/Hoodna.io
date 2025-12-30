"""
Add max_listings column to service_provider_profiles table.
"""
import asyncio
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from scripts.utils import get_db_url


async def add_max_listings_column():
    """Add max_listings column to service_provider_profiles."""
    db_url = get_db_url()
    engine = create_async_engine(db_url, echo=True)
    
    async with engine.begin() as conn:
        # Check if column already exists
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='service_provider_profiles' AND column_name='max_listings'
        """))
        exists = result.scalar_one_or_none() is not None
        
        if exists:
            print("✅ Column max_listings already exists")
        else:
            print("🔄 Adding max_listings column...")
            # Add the column
            await conn.execute(text("""
                ALTER TABLE service_provider_profiles 
                ADD COLUMN max_listings INTEGER DEFAULT 3
            """))
            # Set default to 3 for existing providers
            await conn.execute(text("""
                UPDATE service_provider_profiles 
                SET max_listings = 3 
                WHERE max_listings IS NULL
            """))
            print("✅ Added max_listings column with default value 3")
    
    await engine.dispose()
    print("✅ Migration complete!")


if __name__ == "__main__":
    asyncio.run(add_max_listings_column())

