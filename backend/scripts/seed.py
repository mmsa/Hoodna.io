"""
Seed script to create/update the initial admin user.

Default credentials (override with ADMIN_EMAIL / ADMIN_PASSWORD env vars):
  admin@admin.com / mmsammsa
"""
import asyncio
import os

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select

# Import model modules so SQLAlchemy can resolve string relationships / FKs.
from app.models import (  # noqa: F401
    chat_import,
    compound,
    compound_moderator,
    listing,
    message,
    notification,
    post,
    report,
    review,
    saved_listing,
    saved_post,
    service_category,
    service_provider,
    user,
    user_compound_membership,
    verification,
)
from app.models.user import User
from app.core.security import get_password_hash
from app.models.enums import UserRole, UserStatus
from scripts.utils import get_db_url


async def seed_admin():
    """Seed the database with admin user."""
    admin_email = os.getenv("ADMIN_EMAIL", "admin@admin.com").strip().lower()
    admin_password = os.getenv("ADMIN_PASSWORD", "mmsammsa")
    admin_name = os.getenv("ADMIN_NAME", "Admin User")

    db_url = get_db_url()
    last_error: Exception | None = None
    for attempt in range(1, 6):
        engine = create_async_engine(db_url, echo=False)
        try:
            async_session = async_sessionmaker(
                engine, class_=AsyncSession, expire_on_commit=False
            )
            async with async_session() as session:
                result = await session.execute(select(User).where(User.email == admin_email))
                admin_user = result.scalar_one_or_none()

                if not admin_user:
                    admin_user = User(
                        name=admin_name,
                        email=admin_email,
                        password_hash=get_password_hash(admin_password),
                        role=UserRole.ADMIN,
                        status=UserStatus.APPROVED,
                        creation_source="SEED_ADMIN",
                        creation_details={"note": "Seeded admin account"},
                    )
                    session.add(admin_user)
                    await session.flush()
                    print(f"✅ Created admin user: {admin_email}")
                else:
                    admin_user.password_hash = get_password_hash(admin_password)
                    admin_user.role = UserRole.ADMIN
                    admin_user.status = UserStatus.APPROVED
                    if admin_name:
                        admin_user.name = admin_name
                    await session.flush()
                    print(f"✅ Updated admin user: {admin_email}")

                await session.commit()
                print("Admin user seeding completed!")
            return
        except OSError as exc:
            last_error = exc
            print(f"⚠️  Admin seed attempt {attempt}/5 failed to connect: {exc}")
            await asyncio.sleep(2 * attempt)
        finally:
            await engine.dispose()

    raise last_error or RuntimeError("Admin seed failed")


if __name__ == "__main__":
    asyncio.run(seed_admin())
