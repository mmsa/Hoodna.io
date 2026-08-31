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
    """Get user by phone number (Egyptian-aware country-code normalization)."""
    from app.models.user_compound_membership import UserCompoundMembership
    from app.utils.phone import normalize_phone, phone_lookup_candidates

    candidates = phone_lookup_candidates(phone)
    if not candidates:
        return None
    users = list(
        (await db.execute(select(User).where(User.phone.in_(candidates)))).scalars().all()
    )
    if not users:
        return None

    normalized = normalize_phone(phone)
    ids = [user.id for user in users]
    membership_rows = (
        await db.execute(
            select(
                UserCompoundMembership.user_id,
                UserCompoundMembership.verification_status,
                UserCompoundMembership.verification_source,
            ).where(UserCompoundMembership.user_id.in_(ids))
        )
    ).all()
    memberships_by_user: dict[int, list[tuple[str | None, str | None]]] = {}
    for user_id, status, source in membership_rows:
        memberships_by_user.setdefault(int(user_id), []).append((status, source))

    def score(user: User) -> tuple:
        mems = memberships_by_user.get(user.id, [])
        verified = any(status == "VERIFIED" for status, _ in mems)
        chat_import = any(source == "CHAT_IMPORT" for _, source in mems)
        return (
            1 if user.compound_id else 0,
            1 if verified else 0,
            1 if chat_import else 0,
            1 if (user.creation_source or "") == "CHAT_IMPORT" else 0,
            1 if normalized and user.phone == normalized else 0,
            -int(user.id),
        )

    winner = max(users, key=score)
    if (
        normalized
        and winner.phone != normalized
        and not any(other.phone == normalized and other.id != winner.id for other in users)
    ):
        winner.phone = normalized
    return winner


async def create_user_by_phone(
    db: AsyncSession,
    phone: str,
    name: str,
    *,
    creation_source: str = "PHONE_AUTH",
    creation_details: dict | None = None,
    creation_job_id: int | None = None,
) -> User:
    """Create a new user with phone number (no password)."""
    from app.utils.phone import normalize_phone

    phone_normalized = normalize_phone(phone)
    if not phone_normalized:
        raise ValueError("Invalid phone number")
    # Generate a dummy email for phone-only users
    dummy_email = f"phone_{phone_normalized}@hoodna.local"
    details = {"note": "Registered with phone"}
    if creation_details:
        details.update(creation_details)
    db_user = User(
        name=name,
        email=dummy_email,
        phone=phone_normalized,
        password_hash="",  # No password for phone auth users
        status=UserStatus.PENDING_VERIFICATION,
        phone_verified=True,
        email_verified=True,  # placeholder email — nothing to verify
        creation_source=creation_source,
        creation_details=details,
        creation_job_id=creation_job_id,
    )
    db.add(db_user)
    await db.flush()
    await db.refresh(db_user)
    return db_user


async def create_chat_import_user(
    db: AsyncSession,
    *,
    name: str,
    email: str,
    creation_details: dict | None = None,
    creation_job_id: int | None = None,
) -> User:
    """Create a chat-import user without a real phone (WhatsApp hid the number)."""
    details = {"note": "Imported from group chat (no phone in export)"}
    if creation_details:
        details.update(creation_details)
    db_user = User(
        name=name,
        email=email,
        phone=None,
        password_hash="",
        status=UserStatus.PENDING_VERIFICATION,
        phone_verified=True,  # no phone to verify
        email_verified=True,  # verified via invite/import flow
        creation_source="CHAT_IMPORT",
        creation_details=details,
        creation_job_id=creation_job_id,
    )
    db.add(db_user)
    await db.flush()
    await db.refresh(db_user)
    return db_user


async def find_chat_import_user_by_name(
    db: AsyncSession,
    *,
    name: str,
    email: str,
) -> User | None:
    """Find an existing chat-import identity by stable email or legacy synthetic phone."""
    by_email = await get_user_by_email(db, email)
    if by_email:
        return by_email
    # Legacy rows used fake 900… phones derived from the display name.
    result = await db.execute(
        select(User).where(
            User.creation_source == "CHAT_IMPORT",
            User.name == name,
            or_(User.phone.is_(None), User.phone.like("900%")),
        ).limit(1)
    )
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    """Get user by ID."""
    return await db.get(User, user_id)


async def create_user(
    db: AsyncSession,
    user_data: UserCreate,
    role: UserRole | None = None,
    *,
    creation_source: str = "EMAIL_SIGNUP",
    creation_details: dict | None = None,
    phone_verified: bool = True,
    email_verified: bool = True,
) -> User:
    """Create a new user."""
    hashed_password = get_password_hash(user_data.password)
    details = {"note": "Registered with email"}
    if creation_details:
        details.update(creation_details)
    db_user = User(
        name=user_data.name,
        email=user_data.email,
        phone=user_data.phone,
        password_hash=hashed_password,
        role=role,
        status=UserStatus.PENDING_VERIFICATION,
        phone_verified=phone_verified,
        email_verified=email_verified,
        creation_source=creation_source,
        creation_details=details,
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
        like = f"%{term}%"
        search_parts = [
            User.name.ilike(like),
            User.email.ilike(like),
            User.phone.ilike(like),
        ]
        # Numeric terms used to match only user id — also match phone fragments
        # (e.g. "3391" in "+2010…3391…") and exact id when the whole term is digits.
        digits = "".join(ch for ch in term if ch.isdigit())
        if term.isdigit():
            try:
                search_parts.append(User.id == int(term))
            except ValueError:
                pass
        if digits:
            phone_digits = func.regexp_replace(User.phone, r"[^0-9]", "", "g")
            search_parts.append(phone_digits.like(f"%{digits}%"))
        filters.append(or_(*search_parts))
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


async def delete_user(db: AsyncSession, user_id: int) -> dict:
    """Permanently delete a user and their owned content.

    Raises ValueError if missing, PermissionError if the user is an admin.
    """
    from sqlalchemy import delete, or_, update
    from app.models.post import Post, Comment, PostReaction
    from app.models.listing import Listing, Promotion
    from app.models.saved_listing import SavedListing
    from app.models.saved_post import SavedPost
    from app.models.message import Message, Conversation
    from app.models.notification import Notification
    from app.models.review import Review
    from app.models.report import Report
    from app.models.verification import VerificationDocument
    from app.models.user_compound_membership import UserCompoundMembership
    from app.models.compound import Compound

    user = await db.get(User, user_id)
    if not user:
        raise ValueError("User not found")
    if user.role == UserRole.ADMIN:
        raise PermissionError("Cannot delete admin accounts")

    email = user.email
    user.creation_job_id = None

    post_ids = list(
        (
            await db.execute(select(Post.id).where(Post.author_id == user_id))
        ).scalars().all()
    )
    listing_ids = list(
        (
            await db.execute(select(Listing.id).where(Listing.owner_id == user_id))
        ).scalars().all()
    )

    if post_ids:
        await db.execute(delete(SavedPost).where(SavedPost.post_id.in_(post_ids)))
        await db.execute(delete(PostReaction).where(PostReaction.post_id.in_(post_ids)))
        await db.execute(delete(Comment).where(Comment.post_id.in_(post_ids)))
    await db.execute(delete(SavedPost).where(SavedPost.user_id == user_id))
    await db.execute(delete(PostReaction).where(PostReaction.user_id == user_id))
    await db.execute(delete(Comment).where(Comment.author_id == user_id))
    await db.execute(delete(Post).where(Post.author_id == user_id))

    if listing_ids:
        await db.execute(delete(SavedListing).where(SavedListing.listing_id.in_(listing_ids)))
        await db.execute(delete(Review).where(Review.listing_id.in_(listing_ids)))
        await db.execute(delete(Promotion).where(Promotion.listing_id.in_(listing_ids)))
    await db.execute(delete(SavedListing).where(SavedListing.user_id == user_id))
    await db.execute(delete(Review).where(Review.reviewer_id == user_id))

    conversation_filters = [
        Conversation.user1_id == user_id,
        Conversation.user2_id == user_id,
    ]
    if listing_ids:
        conversation_filters.append(Conversation.listing_id.in_(listing_ids))
    conversation_ids = list(
        (
            await db.execute(select(Conversation.id).where(or_(*conversation_filters)))
        ).scalars().all()
    )
    if conversation_ids:
        await db.execute(delete(Message).where(Message.conversation_id.in_(conversation_ids)))
        await db.execute(delete(Conversation).where(Conversation.id.in_(conversation_ids)))
    await db.execute(delete(Message).where(Message.sender_id == user_id))

    if listing_ids:
        await db.execute(delete(Listing).where(Listing.id.in_(listing_ids)))

    await db.execute(
        delete(UserCompoundMembership).where(UserCompoundMembership.user_id == user_id)
    )
    await db.execute(delete(Notification).where(Notification.user_id == user_id))
    await db.execute(delete(Report).where(Report.reporter_id == user_id))
    await db.execute(
        update(Report).where(Report.reviewed_by_id == user_id).values(reviewed_by_id=None)
    )
    await db.execute(delete(VerificationDocument).where(VerificationDocument.user_id == user_id))
    await db.execute(
        update(VerificationDocument)
        .where(VerificationDocument.reviewer_id == user_id)
        .values(reviewer_id=None)
    )
    await db.execute(
        update(Compound).where(Compound.moderator_id == user_id).values(moderator_id=None)
    )

    await db.delete(user)
    await db.flush()
    return {"id": user_id, "email": email}

