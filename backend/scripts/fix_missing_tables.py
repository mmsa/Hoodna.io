"""
Fix missing database tables and columns.
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings


async def fix_database():
    """Add missing columns and tables."""
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        # Check if posts.category exists
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'posts' AND column_name = 'category'
        """))
        has_category = result.scalar_one_or_none()
        
        if not has_category:
            print("🔄 Adding category column to posts table...")
            # Create enum type if it doesn't exist
            await conn.execute(text("""
                DO $$ BEGIN
                    CREATE TYPE postcategory AS ENUM (
                        'GENERAL', 'HELP', 'LOST_FOUND', 'EVENT',
                        'MARKETPLACE', 'ANNOUNCEMENT', 'ALERT', 'DISCUSSION'
                    );
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))
            
            # Add category column
            await conn.execute(text("""
                ALTER TABLE posts 
                ADD COLUMN IF NOT EXISTS category postcategory NOT NULL DEFAULT 'GENERAL'
            """))
            
            # Add is_urgent column
            await conn.execute(text("""
                ALTER TABLE posts 
                ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT false
            """))
            
            # Create indexes
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_posts_category ON posts(category)"))
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_posts_is_urgent ON posts(is_urgent)"))
            print("✅ Added category and is_urgent columns to posts")
        else:
            print("✅ posts.category already exists")
        
        # Check if reviews table exists
        result = await conn.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'reviews'
        """))
        has_reviews = result.scalar_one_or_none()
        
        if not has_reviews:
            print("🔄 Creating reviews table...")
            await conn.execute(text("""
                CREATE TABLE reviews (
                    id SERIAL PRIMARY KEY,
                    listing_id INTEGER NOT NULL REFERENCES listings(id),
                    reviewer_id INTEGER NOT NULL REFERENCES users(id),
                    rating NUMERIC(2, 1) NOT NULL CHECK (rating >= 1.0 AND rating <= 5.0),
                    comment TEXT,
                    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                    UNIQUE(listing_id, reviewer_id)
                )
            """))
            
            # Create indexes
            await conn.execute(text("CREATE INDEX ix_reviews_id ON reviews(id)"))
            await conn.execute(text("CREATE INDEX ix_reviews_listing_id ON reviews(listing_id)"))
            await conn.execute(text("CREATE INDEX ix_reviews_reviewer_id ON reviews(reviewer_id)"))
            print("✅ Created reviews table")
        else:
            print("✅ reviews table already exists")
    
    await engine.dispose()
    print("\n✅ Database fixes completed!")


if __name__ == "__main__":
    asyncio.run(fix_database())

