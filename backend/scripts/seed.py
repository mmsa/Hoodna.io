"""
Seed script to create initial data:
- Sample compounds
- Admin user
"""
import asyncio
import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.db.base import Base
# Import all models to ensure relationships are set up
from app.models import compound, user, post, listing, verification  # noqa
from app.models.compound import Compound
from app.models.user import User
from app.core.security import get_password_hash
from app.core.config import settings
from app.models.enums import UserRole, UserStatus


async def seed_data():
    """Seed the database with initial data."""
    # Use localhost:5433 for local development, settings.DATABASE_URL for Docker
    db_url = os.getenv("DATABASE_URL", settings.DATABASE_URL)
    if "postgres:5432" in db_url:
        db_url = db_url.replace("postgres:5432", "localhost:5433")
    engine = create_async_engine(db_url, echo=True)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Create comprehensive list of Egyptian compounds
        compounds_data = [
            # New Cairo Compounds
            {"name": "Madinaty", "city": "New Cairo", "country": "Egypt"},
            {"name": "New Cairo Compound", "city": "New Cairo", "country": "Egypt"},
            {"name": "Rehab City", "city": "New Cairo", "country": "Egypt"},
            {"name": "Al Rehab", "city": "New Cairo", "country": "Egypt"},
            {"name": "El Shorouk City", "city": "New Cairo", "country": "Egypt"},
            {"name": "Cairo Festival City", "city": "New Cairo", "country": "Egypt"},
            {"name": "Al Tagamoa Al Khames", "city": "New Cairo", "country": "Egypt"},
            {"name": "Al Tagamoa Al Awal", "city": "New Cairo", "country": "Egypt"},
            {"name": "Al Tagamoa Al Tany", "city": "New Cairo", "country": "Egypt"},
            {"name": "Al Tagamoa Al Rabaa", "city": "New Cairo", "country": "Egypt"},
            {"name": "New Capital City", "city": "New Cairo", "country": "Egypt"},
            {"name": "Mostakbal City", "city": "New Cairo", "country": "Egypt"},
            {"name": "Sodic Eastown", "city": "New Cairo", "country": "Egypt"},
            {"name": "Al Rabwa", "city": "New Cairo", "country": "Egypt"},
            
            # 6th October City Compounds
            {"name": "6th October City", "city": "6th October", "country": "Egypt"},
            {"name": "Dreamland", "city": "6th October", "country": "Egypt"},
            {"name": "Beverly Hills", "city": "6th October", "country": "Egypt"},
            {"name": "Zahraa Al Maadi", "city": "6th October", "country": "Egypt"},
            {"name": "Al Yasmine", "city": "6th October", "country": "Egypt"},
            {"name": "Al Rehab 6th October", "city": "6th October", "country": "Egypt"},
            {"name": "Al Motamayez", "city": "6th October", "country": "Egypt"},
            {"name": "Al Hadaba", "city": "6th October", "country": "Egypt"},
            {"name": "Al Shorouk 6th October", "city": "6th October", "country": "Egypt"},
            {"name": "Al Safwa", "city": "6th October", "country": "Egypt"},
            
            # Sheikh Zayed City Compounds
            {"name": "Sheikh Zayed City", "city": "Sheikh Zayed", "country": "Egypt"},
            {"name": "Zayed Gardens", "city": "Sheikh Zayed", "country": "Egypt"},
            {"name": "Al Rabwa Sheikh Zayed", "city": "Sheikh Zayed", "country": "Egypt"},
            {"name": "Al Yasmine Sheikh Zayed", "city": "Sheikh Zayed", "country": "Egypt"},
            {"name": "Al Rehab Sheikh Zayed", "city": "Sheikh Zayed", "country": "Egypt"},
            {"name": "Al Motamayez Sheikh Zayed", "city": "Sheikh Zayed", "country": "Egypt"},
            
            # Maadi Compounds
            {"name": "Maadi Heights", "city": "Maadi", "country": "Egypt"},
            {"name": "Maadi Park", "city": "Maadi", "country": "Egypt"},
            {"name": "Degla Maadi", "city": "Maadi", "country": "Egypt"},
            {"name": "New Maadi", "city": "Maadi", "country": "Egypt"},
            {"name": "Zahraa Maadi", "city": "Maadi", "country": "Egypt"},
            
            # Nasr City Compounds
            {"name": "Nasr City", "city": "Nasr City", "country": "Egypt"},
            {"name": "Heliopolis", "city": "Nasr City", "country": "Egypt"},
            {"name": "New Heliopolis", "city": "Nasr City", "country": "Egypt"},
            {"name": "Al Obour City", "city": "Nasr City", "country": "Egypt"},
            
            # Giza Compounds
            {"name": "Pyramids Gardens", "city": "Giza", "country": "Egypt"},
            {"name": "Al Haram", "city": "Giza", "country": "Egypt"},
            {"name": "Dokki", "city": "Giza", "country": "Egypt"},
            {"name": "Mohandessin", "city": "Giza", "country": "Egypt"},
            {"name": "Zamalek", "city": "Giza", "country": "Egypt"},
            {"name": "Agouza", "city": "Giza", "country": "Egypt"},
            
            # North Coast Compounds
            {"name": "Marina El Alamein", "city": "North Coast", "country": "Egypt"},
            {"name": "Hacienda Bay", "city": "North Coast", "country": "Egypt"},
            {"name": "Marassi", "city": "North Coast", "country": "Egypt"},
            {"name": "Sidi Abdel Rahman", "city": "North Coast", "country": "Egypt"},
            {"name": "Sahl Hasheesh", "city": "North Coast", "country": "Egypt"},
            
            # Alexandria Compounds
            {"name": "San Stefano", "city": "Alexandria", "country": "Egypt"},
            {"name": "Montaza", "city": "Alexandria", "country": "Egypt"},
            {"name": "Stanley", "city": "Alexandria", "country": "Egypt"},
            {"name": "Gleem", "city": "Alexandria", "country": "Egypt"},
            
            # Other Major Compounds
            {"name": "Palm Hills", "city": "6th October", "country": "Egypt"},
            {"name": "Allegria", "city": "New Cairo", "country": "Egypt"},
            {"name": "Westown", "city": "6th October", "country": "Egypt"},
            {"name": "Mivida", "city": "New Cairo", "country": "Egypt"},
            {"name": "La Verde", "city": "New Cairo", "country": "Egypt"},
            {"name": "Bloomfields", "city": "New Cairo", "country": "Egypt"},
            {"name": "Hyde Park", "city": "New Cairo", "country": "Egypt"},
            {"name": "Uptown Cairo", "city": "New Cairo", "country": "Egypt"},
            {"name": "Waterway", "city": "New Cairo", "country": "Egypt"},
            {"name": "Vinci", "city": "New Cairo", "country": "Egypt"},
        ]
        
        compounds = []
        created_count = 0
        existing_count = 0
        
        for comp_data in compounds_data:
            # Check if compound exists
            from sqlalchemy import select
            result = await session.execute(
                select(Compound).where(Compound.name == comp_data["name"])
            )
            existing = result.scalar_one_or_none()
            
            if not existing:
                compound = Compound(**comp_data)
                session.add(compound)
                compounds.append(compound)
                created_count += 1
            else:
                compounds.append(existing)
                existing_count += 1
        
        await session.flush()
        
        print(f"\n✅ Compounds seeded:")
        print(f"   - Created: {created_count} new compounds")
        print(f"   - Already existed: {existing_count} compounds")
        print(f"   - Total: {len(compounds_data)} compounds")
        
        # Create admin user
        admin_email = "admin@hoodna.io"
        from sqlalchemy import select
        result = await session.execute(
            select(User).where(User.email == admin_email)
        )
        admin_user = result.scalar_one_or_none()
        
        if not admin_user:
            admin_user = User(
                name="Admin User",
                email=admin_email,
                password_hash=get_password_hash("admin123"),
                role=UserRole.ADMIN,
                status=UserStatus.APPROVED,
                compound_id=compounds[0].id if compounds else None,
            )
            session.add(admin_user)
            await session.flush()
            print(f"Created admin user: {admin_email} / admin123")
        else:
            print(f"Admin user already exists: {admin_email}")
        
        await session.commit()
        print("Seed data created successfully!")


if __name__ == "__main__":
    asyncio.run(seed_data())

