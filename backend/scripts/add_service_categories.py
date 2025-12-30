"""
Add new service categories to the database.
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


async def add_service_categories():
    """Add new service categories."""
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        # New categories to add
        new_categories = [
            ("Personal Services", "Personal care and grooming services", "💆", 19),
            ("Laundry Services", "Laundry, dry cleaning, and ironing services", "👔", 20),
        ]
        
        print("🔄 Adding new service categories...")
        for name, description, icon, order in new_categories:
            # Check if category already exists
            result = await conn.execute(
                text("SELECT COUNT(*) FROM service_categories WHERE name = :name"),
                {"name": name}
            )
            exists = result.scalar_one() > 0
            
            if not exists:
                await conn.execute(text("""
                    INSERT INTO service_categories (name, description, icon, display_order, is_active)
                    VALUES (:name, :description, :icon, :order, TRUE)
                """), {"name": name, "description": description, "icon": icon, "order": order})
                print(f"✅ Added category: {name}")
            else:
                print(f"☑️ Category already exists: {name}")
        
        # Verify final count
        result = await conn.execute(text("SELECT COUNT(*) FROM service_categories WHERE is_active = TRUE"))
        count = result.scalar_one()
        print(f"✅ Total active categories: {count}")


if __name__ == "__main__":
    asyncio.run(add_service_categories())

