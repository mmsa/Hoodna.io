"""
Recreate compounds table from scratch based on CSV schema.
This will delete all existing compounds and recreate the table.
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from scripts.utils import get_db_url

async def recreate_compounds_table():
    """Drop and recreate compounds table with CSV schema."""
    db_url = get_db_url()
    engine = create_async_engine(db_url, echo=True)
    
    async with engine.begin() as conn:
        print("🔄 Dropping existing compounds table...")
        
        # Drop foreign key constraints first
        await conn.execute(text("""
            ALTER TABLE IF EXISTS users 
            DROP CONSTRAINT IF EXISTS users_compound_id_fkey
        """))
        await conn.execute(text("""
            ALTER TABLE IF EXISTS posts 
            DROP CONSTRAINT IF EXISTS posts_compound_id_fkey
        """))
        await conn.execute(text("""
            ALTER TABLE IF EXISTS listings 
            DROP CONSTRAINT IF EXISTS listings_compound_id_fkey
        """))
        
        # Drop the table
        await conn.execute(text("DROP TABLE IF EXISTS compounds CASCADE"))
        
        print("✅ Dropped compounds table")
        
        print("🔄 Creating new compounds table...")
        
        # Create compounds table with CSV schema
        await conn.execute(text("""
            CREATE TABLE compounds (
                id SERIAL PRIMARY KEY,
                compound_id VARCHAR UNIQUE NOT NULL,
                name VARCHAR NOT NULL,
                area VARCHAR NOT NULL,
                sub_area VARCHAR,
                category VARCHAR,
                developer VARCHAR,
                status_2025 VARCHAR NOT NULL,
                delivery_notes TEXT,
                source_hint VARCHAR,
                last_verified_date DATE,
                lat NUMERIC(10, 7),
                lng NUMERIC(10, 7),
                city VARCHAR,
                country VARCHAR NOT NULL DEFAULT 'Egypt',
                is_public BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))
        
        print("✅ Created compounds table")
        
        # Create indexes
        print("🔄 Creating indexes...")
        await conn.execute(text("CREATE INDEX ix_compounds_id ON compounds(id)"))
        await conn.execute(text("CREATE UNIQUE INDEX ix_compounds_compound_id ON compounds(compound_id)"))
        await conn.execute(text("CREATE INDEX ix_compounds_name ON compounds(name)"))
        await conn.execute(text("CREATE INDEX ix_compounds_area ON compounds(area)"))
        await conn.execute(text("CREATE INDEX ix_compounds_sub_area ON compounds(sub_area)"))
        await conn.execute(text("CREATE INDEX ix_compounds_category ON compounds(category)"))
        await conn.execute(text("CREATE INDEX ix_compounds_developer ON compounds(developer)"))
        await conn.execute(text("CREATE INDEX ix_compounds_status_2025 ON compounds(status_2025)"))
        await conn.execute(text("CREATE INDEX ix_compounds_area_status ON compounds(area, status_2025)"))
        await conn.execute(text("CREATE INDEX ix_compounds_developer_status ON compounds(developer, status_2025)"))
        await conn.execute(text("CREATE INDEX ix_compounds_category_status ON compounds(category, status_2025)"))
        
        print("✅ Created indexes")
        
        # Recreate foreign key constraints
        print("🔄 Recreating foreign key constraints...")
        await conn.execute(text("""
            ALTER TABLE users 
            ADD CONSTRAINT users_compound_id_fkey 
            FOREIGN KEY (compound_id) REFERENCES compounds(id) ON DELETE SET NULL
        """))
        await conn.execute(text("""
            ALTER TABLE posts 
            ADD CONSTRAINT posts_compound_id_fkey 
            FOREIGN KEY (compound_id) REFERENCES compounds(id) ON DELETE CASCADE
        """))
        await conn.execute(text("""
            ALTER TABLE listings 
            ADD CONSTRAINT listings_compound_id_fkey 
            FOREIGN KEY (compound_id) REFERENCES compounds(id) ON DELETE CASCADE
        """))
        
        print("✅ Recreated foreign key constraints")
        
        print("\n✅ Compounds table recreated successfully!")
        print("   Now run: python scripts/seed_compounds.py")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(recreate_compounds_table())

