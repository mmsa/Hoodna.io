"""
Seed script to create initial data:
- Sample compounds
- Admin user
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.db.base import Base
from app.models.compound import Compound
from app.models.user import User
from app.core.security import get_password_hash
from app.core.config import settings
from app.models.enums import UserRole, UserStatus


async def seed_data():
    """Seed the database with initial data."""
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Create sample compounds
        compounds_data = [
            {"name": "New Cairo Compound", "city": "Cairo", "country": "Egypt"},
            {"name": "Maadi Heights", "city": "Cairo", "country": "Egypt"},
            {"name": "Zayed Gardens", "city": "Giza", "country": "Egypt"},
            {"name": "6th October Compound", "city": "Giza", "country": "Egypt"},
        ]
        
        compounds = []
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
            else:
                compounds.append(existing)
        
        await session.flush()
        
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

