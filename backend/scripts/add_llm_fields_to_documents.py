"""
Add LLM verification fields to provider and moderator document tables.
This script runs the migration 012 directly.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from scripts.utils import get_db_url

async def run_migration():
    """Add LLM fields to service_provider_documents and compound_moderator_documents tables."""
    db_url = get_db_url()
    engine = create_async_engine(db_url, echo=True)
    
    async with engine.begin() as conn:
        # Check if columns already exist
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'service_provider_documents' AND column_name = 'llm_verified'
        """))
        exists = result.scalar_one_or_none()
        
        if exists:
            print("✅ Migration already applied - llm_verified column exists")
            return
        
        print("🔄 Running migration 012 - Adding LLM fields to document tables...")
        
        # Add LLM fields to service_provider_documents
        await conn.execute(text("""
            ALTER TABLE service_provider_documents 
            ADD COLUMN IF NOT EXISTS llm_verified INTEGER
        """))
        await conn.execute(text("""
            ALTER TABLE service_provider_documents 
            ADD COLUMN IF NOT EXISTS llm_confidence DOUBLE PRECISION
        """))
        await conn.execute(text("""
            ALTER TABLE service_provider_documents 
            ADD COLUMN IF NOT EXISTS llm_recommendation VARCHAR
        """))
        await conn.execute(text("""
            ALTER TABLE service_provider_documents 
            ADD COLUMN IF NOT EXISTS llm_reasoning TEXT
        """))
        await conn.execute(text("""
            ALTER TABLE service_provider_documents 
            ADD COLUMN IF NOT EXISTS llm_issues JSONB
        """))
        await conn.execute(text("""
            ALTER TABLE service_provider_documents 
            ADD COLUMN IF NOT EXISTS llm_extracted_info JSONB
        """))
        await conn.execute(text("""
            ALTER TABLE service_provider_documents 
            ADD COLUMN IF NOT EXISTS llm_verified_at TIMESTAMP WITH TIME ZONE
        """))
        
        # Add LLM fields to compound_moderator_documents
        await conn.execute(text("""
            ALTER TABLE compound_moderator_documents 
            ADD COLUMN IF NOT EXISTS llm_verified INTEGER
        """))
        await conn.execute(text("""
            ALTER TABLE compound_moderator_documents 
            ADD COLUMN IF NOT EXISTS llm_confidence DOUBLE PRECISION
        """))
        await conn.execute(text("""
            ALTER TABLE compound_moderator_documents 
            ADD COLUMN IF NOT EXISTS llm_recommendation VARCHAR
        """))
        await conn.execute(text("""
            ALTER TABLE compound_moderator_documents 
            ADD COLUMN IF NOT EXISTS llm_reasoning TEXT
        """))
        await conn.execute(text("""
            ALTER TABLE compound_moderator_documents 
            ADD COLUMN IF NOT EXISTS llm_issues JSONB
        """))
        await conn.execute(text("""
            ALTER TABLE compound_moderator_documents 
            ADD COLUMN IF NOT EXISTS llm_extracted_info JSONB
        """))
        await conn.execute(text("""
            ALTER TABLE compound_moderator_documents 
            ADD COLUMN IF NOT EXISTS llm_verified_at TIMESTAMP WITH TIME ZONE
        """))
        
        print("✅ Migration completed successfully!")
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(run_migration())

