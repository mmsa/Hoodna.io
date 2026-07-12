from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, and_
from app.models.user import User
from app.schemas.user import UserCreate
from app.core.security import get_password_hash
from app.models.enums import ModeratorStatus, UserStatus, UserRole
from app.models.compound_moderator import CompoundModeratorProfile
from typing import List, Optional


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


async def get_compound_moderators_and_admins(
    db: AsyncSession, compound_id: Optional[int]
) -> List[User]:
    """Get global admins and moderators assigned to the target compound."""
    role_conditions = [User.role == UserRole.ADMIN]
    if compound_id is not None:
        role_conditions.extend(
            [
                and_(
                    User.role == UserRole.MODERATOR,
                    User.compound_id == compound_id,
                ),
            ]
        )
    result = await db.execute(
        select(User).where(
            User.status != UserStatus.BANNED,
            or_(*role_conditions),
        )
    )
    users = list(result.scalars().all())
    if compound_id is not None:
        moderator_result = await db.execute(
            select(User)
            .join(
                CompoundModeratorProfile,
                CompoundModeratorProfile.user_id == User.id,
            )
            .where(
                User.role == UserRole.COMPOUND_MOD,
                User.status != UserStatus.BANNED,
                CompoundModeratorProfile.compound_id == compound_id,
                CompoundModeratorProfile.moderator_status == ModeratorStatus.APPROVED,
            )
        )
        users.extend(moderator_result.scalars().all())
    return list({user.id: user for user in users}.values())


async def list_users(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 50,
    search: str | None = None,
    role: UserRole | None = None,
    status: UserStatus | None = None,
    compound_id: int | None = None,
    sort_by: str = "created_at_desc",
) -> tuple[list[User], int]:
    """List users with optional filters, search, sort, and pagination."""
    filters = []
    if search:
        term = search.strip()
        if term.isdigit():
            filters.append(User.id == int(term))
        else:
            like = f"%{term}%"
            filters.append(
                or_(
                    User.name.ilike(like),
                    User.email.ilike(like),
                    User.phone.ilike(like),
                )
            )
    if role:
        filters.append(User.role == role)
    if status:
        filters.append(User.status == status)
    if compound_id:
        filters.append(User.compound_id == compound_id)

    base = select(User)
    count_stmt = select(func.count()).select_from(User)
    if filters:
        condition = and_(*filters)
        base = base.where(condition)
        count_stmt = count_stmt.where(condition)

    sort_map = {
        "created_at_desc": User.created_at.desc(),
        "created_at_asc": User.created_at.asc(),
        "name_asc": User.name.asc(),
        "name_desc": User.name.desc(),
        "email_asc": User.email.asc(),
        "email_desc": User.email.desc(),
    }
    order = sort_map.get(sort_by, User.created_at.desc())

    total = (await db.execute(count_stmt)).scalar_one()
    result = await db.execute(base.order_by(order).offset(skip).limit(limit))
    return list(result.scalars().all()), total


async def get_user_activity_counts(db: AsyncSession, user_id: int) -> dict[str, int]:
    """Count user-related records across the platform."""
    from sqlalchemy import inspect
    from app.models.post import Post, Comment
    from app.models.listing import Listing
    from app.models.saved_listing import SavedListing
    from app.models.saved_post import SavedPost
    from app.models.message import Message, Conversation
    from app.models.notification import Notification
    from app.models.review import Review
    from app.models.report import Report

    connection = await db.connection()
    table_names = set(
        await connection.run_sync(lambda conn: inspect(conn).get_table_names())
    )

    async def count(model, column):
        if model.__tablename__ not in table_names:
            return 0
        stmt = select(func.count()).select_from(model).where(column == user_id)
        return (await db.execute(stmt)).scalar_one()

    conversations = 0
    if Conversation.__tablename__ in table_names:
        conv_stmt = select(func.count()).select_from(Conversation).where(
            or_(Conversation.user1_id == user_id, Conversation.user2_id == user_id)
        )
        conversations = (await db.execute(conv_stmt)).scalar_one()

    return {
        "posts": await count(Post, Post.author_id),
        "comments": await count(Comment, Comment.author_id),
        "listings": await count(Listing, Listing.owner_id),
        "saved_listings": await count(SavedListing, SavedListing.user_id),
        "saved_posts": await count(SavedPost, SavedPost.user_id),
        "messages_sent": await count(Message, Message.sender_id),
        "notifications": await count(Notification, Notification.user_id),
        "reviews": await count(Review, Review.reviewer_id),
        "reports_filed": await count(Report, Report.reporter_id),
        "conversations": conversations,
    }

