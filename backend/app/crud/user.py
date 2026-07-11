from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash
from app.models.enums import UserStatus, UserRole
from typing import List


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Get user by email (case-insensitive)."""
    # Normalize email to lowercase for lookup
    email_lower = email.lower().strip()
    result = await db.execute(select(User).where(User.email.ilike(email_lower)))
    return result.scalar_one_or_none()


async def get_user_by_phone(db: AsyncSession, phone: str) -> User | None:
    """Get user by phone number."""
    # Normalize phone (remove spaces, dashes, etc.)
    phone_normalized = phone.strip().replace(" ", "").replace("-", "").replace("+", "")
    result = await db.execute(select(User).where(User.phone == phone_normalized))
    return result.scalar_one_or_none()


async def create_user_by_phone(db: AsyncSession, phone: str, name: str) -> User:
    """Create a new user with phone number (no password)."""
    phone_normalized = phone.strip().replace(" ", "").replace("-", "").replace("+", "")
    # Generate a dummy email for phone-only users
    dummy_email = f"phone_{phone_normalized}@hoodna.local"
    db_user = User(
        name=name,
        email=dummy_email,
        phone=phone_normalized,
        password_hash="",  # No password for phone auth users
        status=UserStatus.PENDING_VERIFICATION,
    )
    db.add(db_user)
    await db.flush()
    await db.refresh(db_user)
    return db_user


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    """Get user by ID."""
    return await db.get(User, user_id)


async def create_user(db: AsyncSession, user_data: UserCreate, role: UserRole | None = None) -> User:
    """Create a new user."""
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        password_hash=hashed_password,
        role=role,
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


async def get_compound_moderators_and_admins(db: AsyncSession, compound_id: int) -> List[User]:
    """Get all moderators and admins for a compound."""
    result = await db.execute(
        select(User).where(
            User.compound_id == compound_id,
            or_(
                User.role == UserRole.MODERATOR,
                User.role == UserRole.ADMIN
            )
        )
    )
    return list(result.scalars().all())


async def list_users(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    role: UserRole | None = None,
    status: UserStatus | None = None,
) -> tuple[list[User], int]:
    """List users with optional filters and pagination."""
    filters = []
    if search:
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                User.name.ilike(term),
                User.email.ilike(term),
                User.phone.ilike(term),
            )
        )
    if role:
        filters.append(User.role == role)
    if status:
        filters.append(User.status == status)

    base = select(User)
    count_stmt = select(func.count()).select_from(User)
    if filters:
        from sqlalchemy import and_
        condition = and_(*filters)
        base = base.where(condition)
        count_stmt = count_stmt.where(condition)

    total = (await db.execute(count_stmt)).scalar_one()
    result = await db.execute(
        base.order_by(User.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all()), total

