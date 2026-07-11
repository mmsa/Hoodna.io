"""
Reset a user's password by email (for ops / support).

Usage:
  RESET_USER_EMAIL=mmsa12@gmail.com RESET_USER_PASSWORD='newpass' python -m scripts.reset_user_password

On Render, set those env vars on the web service and redeploy once (remove after).
"""
import asyncio
import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import (  # noqa: F401
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
from scripts.utils import get_db_url


async def reset_user_password() -> None:
    email = os.getenv("RESET_USER_EMAIL", "").strip().lower()
    password = os.getenv("RESET_USER_PASSWORD", "")
    if not email or not password:
        print("Set RESET_USER_EMAIL and RESET_USER_PASSWORD")
        raise SystemExit(1)

    db_url = get_db_url()
    engine = create_async_engine(db_url, echo=False)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        result = await session.execute(select(User).where(User.email.ilike(email)))
        target = result.scalar_one_or_none()
        if not target:
            print(f"❌ No user found for email: {email}")
            raise SystemExit(1)

        target.password_hash = get_password_hash(password)
        await session.commit()
        print(f"✅ Password updated for user id={target.id} email={target.email}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(reset_user_password())
