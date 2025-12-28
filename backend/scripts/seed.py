"""
Seed script to create initial admin user.

Note: For seeding compounds, use scripts/seed_compounds.py instead.
"""
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
# Import all models to ensure relationships are set up
from app.models import compound, user, post, listing, verification  # noqa
from app.models.user import User
from app.core.security import get_password_hash
from app.models.enums import UserRole, UserStatus
from scripts.utils import get_db_url


async def seed_admin():
    """Seed the database with admin user."""
    db_url = get_db_url()
    engine = create_async_engine(db_url, echo=True)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Create admin user
        admin_email = "admin@admin.com"
        result = await session.execute(
            select(User).where(User.email == admin_email)
        )
        admin_user = result.scalar_one_or_none()
        
        if not admin_user:
            admin_user = User(
                name="Admin User",
                email=admin_email,
                password_hash=get_password_hash("mmsammsa1234"),
                role=UserRole.ADMIN,
                status=UserStatus.APPROVED,
            )
            session.add(admin_user)
            await session.flush()
            print(f"✅ Created admin user: {admin_email} / mmsammsa1234")
        else:
            # Update existing admin user with new password
            admin_user.password_hash = get_password_hash("mmsammsa1234")
            admin_user.role = UserRole.ADMIN
            admin_user.status = UserStatus.APPROVED
            await session.flush()
            print(f"✅ Updated admin user: {admin_email} / mmsammsa1234")
        
        await session.commit()
        print("Admin user seeding completed!")


if __name__ == "__main__":
    asyncio.run(seed_admin())

