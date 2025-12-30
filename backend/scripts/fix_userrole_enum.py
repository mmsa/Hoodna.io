"""
Fix the userrole enum to include SERVICE_PROVIDER and COMPOUND_MOD.
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


async def fix_userrole_enum():
    """Add missing enum values to userrole."""
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        # Check current enum values
        result = await conn.execute(text("""
            SELECT enumlabel 
            FROM pg_enum 
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole')
            ORDER BY enumsortorder
        """))
        current_values = [row[0] for row in result.fetchall()]
        print(f"Current userrole enum values: {current_values}")
        
        # Add SERVICE_PROVIDER if it doesn't exist
        if 'SERVICE_PROVIDER' not in current_values:
            print("🔄 Adding SERVICE_PROVIDER to userrole enum...")
            await conn.execute(text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'SERVICE_PROVIDER'"))
            print("✅ Added SERVICE_PROVIDER to userrole enum.")
        else:
            print("☑️ SERVICE_PROVIDER already exists in userrole enum.")
        
        # Add COMPOUND_MOD if it doesn't exist
        if 'COMPOUND_MOD' not in current_values:
            print("🔄 Adding COMPOUND_MOD to userrole enum...")
            await conn.execute(text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'COMPOUND_MOD'"))
            print("✅ Added COMPOUND_MOD to userrole enum.")
        else:
            print("☑️ COMPOUND_MOD already exists in userrole enum.")
        
        # Add RESIDENT if it doesn't exist
        if 'RESIDENT' not in current_values:
            print("🔄 Adding RESIDENT to userrole enum...")
            await conn.execute(text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'RESIDENT'"))
            print("✅ Added RESIDENT to userrole enum.")
        else:
            print("☑️ RESIDENT already exists in userrole enum.")
        
        # Verify final state
        result = await conn.execute(text("""
            SELECT enumlabel 
            FROM pg_enum 
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'userrole')
            ORDER BY enumsortorder
        """))
        final_values = [row[0] for row in result.fetchall()]
        print(f"Final userrole enum values: {final_values}")


if __name__ == "__main__":
    asyncio.run(fix_userrole_enum())

