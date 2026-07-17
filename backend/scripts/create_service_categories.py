"""
Create service categories table and seed initial categories.
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


async def create_service_categories():
    """Create service_categories table and seed initial categories."""
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    
    async with engine.begin() as conn:
        # Check if table exists
        result = await conn.execute(text("""
            SELECT to_regclass('public.service_categories')
        """))
        table_exists = result.scalar_one_or_none()

        if not table_exists:
            print("🔄 Creating service_categories table...")
            await conn.execute(text("""
                CREATE TABLE service_categories (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR NOT NULL UNIQUE,
                    description VARCHAR,
                    icon VARCHAR,
                    is_active BOOLEAN DEFAULT TRUE NOT NULL,
                    display_order INTEGER DEFAULT 0 NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
                );
            """))
            await conn.execute(text("CREATE INDEX ix_service_categories_id ON service_categories (id);"))
            await conn.execute(text("CREATE INDEX ix_service_categories_name ON service_categories (name);"))
            await conn.execute(text("CREATE INDEX ix_service_categories_is_active ON service_categories (is_active);"))
            print("✅ Created service_categories table.")
        else:
            print("☑️ service_categories table already exists.")

        # Check if categories already exist
        result = await conn.execute(text("SELECT COUNT(*) FROM service_categories"))
        count = result.scalar_one()
        
        if count == 0:
            print("🔄 Seeding initial service categories...")
            categories = [
                ("Plumbing", "Plumbing services and repairs", "🔧", 1),
                ("Electrical", "Electrical work and repairs", "⚡", 2),
                ("Cleaning", "House cleaning and maintenance", "🧹", 3),
                ("Painting", "Interior and exterior painting", "🎨", 4),
                ("Carpentry", "Woodwork and furniture", "🪚", 5),
                ("AC & HVAC", "Air conditioning and heating", "❄️", 6),
                ("Landscaping", "Garden and landscaping services", "🌳", 7),
                ("Security", "Security systems and services", "🔒", 8),
                ("Moving", "Moving and relocation services", "📦", 9),
                ("Catering", "Food and catering services", "🍽️", 10),
                ("Photography", "Photography and videography", "📸", 11),
                ("Tutoring", "Education and tutoring", "📚", 12),
                ("Pet Care", "Pet sitting and grooming", "🐾", 13),
                ("Beauty & Salon", "Hair, beauty, and salon services", "💇", 14),
                ("Fitness & Training", "Personal training and fitness", "💪", 15),
                ("IT & Tech Support", "Computer and tech support", "💻", 16),
                ("Legal Services", "Legal consultation and services", "⚖️", 17),
                ("Accounting", "Accounting and financial services", "💰", 18),
                ("Personal Services", "Personal care and grooming services", "💆", 19),
                ("Laundry Services", "Laundry, dry cleaning, and ironing services", "👔", 20),
                ("Other", "Other services", "🔧", 99),
            ]
            
            for name, description, icon, order in categories:
                await conn.execute(text("""
                    INSERT INTO service_categories (name, description, icon, display_order, is_active)
                    SELECT :name, :description, :icon, :order, TRUE
                    WHERE NOT EXISTS (
                        SELECT 1 FROM service_categories WHERE name = :name
                    )
                """), {"name": name, "description": description, "icon": icon, "order": order})
            
            print(f"✅ Seeded {len(categories)} service categories.")
        else:
            print(f"☑️ Service categories already exist ({count} categories).")


if __name__ == "__main__":
    asyncio.run(create_service_categories())

