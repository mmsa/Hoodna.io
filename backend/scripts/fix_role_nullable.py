"""
Fix users.role column to allow NULL values.
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


async def fix_role_column():
    """Make users.role column nullable."""
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        # Check current constraint
        result = await conn.execute(text("""
            SELECT is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'role'
        """))
        is_nullable = result.scalar_one_or_none()
        
        print(f"Current role column nullable status: {is_nullable}")
        
        if is_nullable != 'YES':
            print("🔄 Making users.role column nullable...")
            await conn.execute(text("ALTER TABLE users ALTER COLUMN role DROP NOT NULL"))
            print("✅ users.role column is now nullable")
        else:
            print("✅ users.role column is already nullable")
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(fix_role_column())

