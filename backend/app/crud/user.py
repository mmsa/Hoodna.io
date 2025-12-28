from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash
from app.models.enums import UserStatus


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Get user by email (case-insensitive)."""
    # Normalize email to lowercase for lookup
    email_lower = email.lower().strip()
    result = await db.execute(select(User).where(User.email.ilike(email_lower)))
    return result.scalar_one_or_none()


async def create_user(db: AsyncSession, user_data: UserCreate) -> User:
    """Create a new user."""
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        password_hash=hashed_password,
        status=UserStatus.PENDING_VERIFICATION,
    )
    db.add(db_user)
    await db.flush()
    await db.refresh(db_user)
    return db_user


async def update_user_status(
    db: AsyncSession,
    user_id: int,
    status: UserStatus,
    reviewer_id: int | None = None
) -> User:
    """Update user status."""
    user = await db.get(User, user_id)
    if not user:
        raise ValueError("User not found")
    user.status = status
    await db.flush()
    await db.refresh(user)
    return user

