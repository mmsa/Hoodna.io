from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.models.compound import Compound
from app.schemas.compound import CompoundCreate
from typing import Optional


async def get_compounds(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    area: Optional[str] = None,
    q: Optional[str] = None,
    status: Optional[str] = None,
    developer: Optional[str] = None,
    category: Optional[str] = None,
) -> tuple[list[Compound], int]:
    """Get compounds with optional filters. Returns (compounds, total_count)."""
    query = select(Compound)
    count_query = select(func.count(Compound.id))
    
    # Always filter out compounds with NULL required fields
    base_conditions = [
        Compound.compound_id.isnot(None),
        Compound.area.isnot(None),
        Compound.status_2025.isnot(None),
    ]
    
    # Apply filters
    conditions = base_conditions.copy()
    
    if area:
        conditions.append(Compound.area.ilike(f"%{area}%"))
    
    if status:
        conditions.append(Compound.status_2025 == status)
    
    if developer:
        conditions.append(Compound.developer.ilike(f"%{developer}%"))
    
    if category:
        conditions.append(Compound.category.ilike(f"%{category}%"))
    
    if q:
        # Search in name or compound_id
        search_condition = or_(
            Compound.name.ilike(f"%{q}%"),
            Compound.compound_id.ilike(f"%{q}%"),
        )
        conditions.append(search_condition)
    
    # Apply all conditions
    for condition in conditions:
        query = query.where(condition)
        count_query = count_query.where(condition)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination and execute
    query = query.order_by(Compound.name).offset(skip).limit(limit)
    result = await db.execute(query)
    compounds = list(result.scalars().all())
    
    return compounds, total


async def get_compound_by_id(db: AsyncSession, compound_id: int) -> Compound | None:
    """Get compound by database ID."""
    return await db.get(Compound, compound_id)


async def get_compound_by_slug(db: AsyncSession, compound_id: str) -> Compound | None:
    """Get compound by compound_id slug."""
    result = await db.execute(
        select(Compound).where(Compound.compound_id == compound_id)
    )
    return result.scalar_one_or_none()


async def create_compound(db: AsyncSession, compound_data: CompoundCreate) -> Compound:
    """Create a new compound."""
    db_compound = Compound(**compound_data.model_dump())
    db.add(db_compound)
    await db.flush()
    await db.refresh(db_compound)
    return db_compound


async def get_all_compounds(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    q: Optional[str] = None,
) -> tuple[list[Compound], int]:
    """Get all compounds including incomplete ones (admin use)."""
    query = select(Compound)
    count_query = select(func.count(Compound.id))

    if q:
        search = or_(
            Compound.name.ilike(f"%{q}%"),
            Compound.compound_id.ilike(f"%{q}%"),
            Compound.area.ilike(f"%{q}%"),
            Compound.developer.ilike(f"%{q}%"),
        )
        query = query.where(search)
        count_query = count_query.where(search)
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination and execute
    query = query.order_by(Compound.name).offset(skip).limit(limit)
    result = await db.execute(query)
    compounds = list(result.scalars().all())
    
    return compounds, total


async def update_compound(
    db: AsyncSession,
    compound_id: int,
    update_data: dict
) -> Compound | None:
    """Update compound details (admin use)."""
    compound = await get_compound_by_id(db, compound_id)
    if not compound:
        return None
    
    for key, value in update_data.items():
        if value is not None:
            setattr(compound, key, value)
    
    await db.flush()
    await db.refresh(compound)
    return compound


async def _bulk_delete_posts_for_compound(db: AsyncSession, compound_id: int) -> None:
    from sqlalchemy import delete, select
    from app.models.post import Comment, PollVote, Post, PostReaction
    from app.models.report import Report
    from app.models.saved_post import SavedPost

    post_ids = select(Post.id).where(Post.compound_id == compound_id)
    await db.execute(delete(PollVote).where(PollVote.post_id.in_(post_ids)))
    await db.execute(delete(PostReaction).where(PostReaction.post_id.in_(post_ids)))
    await db.execute(delete(SavedPost).where(SavedPost.post_id.in_(post_ids)))
    await db.execute(delete(Comment).where(Comment.post_id.in_(post_ids)))
    await db.execute(
        delete(Report).where(
            Report.reported_type == "POST",
            Report.reported_id.in_(post_ids),
        )
    )
    await db.execute(delete(Post).where(Post.compound_id == compound_id))


async def _bulk_delete_listings_for_compound(db: AsyncSession, compound_id: int) -> None:
    from sqlalchemy import delete, or_, select
    from app.models.listing import Listing, Promotion
    from app.models.message import Conversation, Message
    from app.models.report import Report
    from app.models.review import Review
    from app.models.saved_listing import SavedListing

    listing_ids = select(Listing.id).where(Listing.compound_id == compound_id)
    conversation_ids = select(Conversation.id).where(
        Conversation.listing_id.in_(listing_ids)
    )
    await db.execute(delete(Message).where(Message.conversation_id.in_(conversation_ids)))
    await db.execute(
        delete(Conversation).where(Conversation.listing_id.in_(listing_ids))
    )
    await db.execute(delete(Promotion).where(Promotion.listing_id.in_(listing_ids)))
    await db.execute(delete(SavedListing).where(SavedListing.listing_id.in_(listing_ids)))
    await db.execute(delete(Review).where(Review.listing_id.in_(listing_ids)))
    await db.execute(
        delete(Report).where(
            Report.reported_type == "LISTING",
            Report.reported_id.in_(listing_ids),
        )
    )
    await db.execute(delete(Listing).where(Listing.compound_id == compound_id))


async def _bulk_delete_users(db: AsyncSession, user_ids: list[int]) -> int:
    if not user_ids:
        return 0
    from sqlalchemy import delete, or_, select, update
    from app.models.enums import UserRole
    from app.models.listing import Listing, Promotion
    from app.models.message import Conversation, Message
    from app.models.notification import Notification
    from app.models.post import Comment, PollVote, Post, PostReaction
    from app.models.report import Report
    from app.models.review import Review
    from app.models.saved_listing import SavedListing
    from app.models.saved_post import SavedPost
    from app.models.user import User
    from app.models.user_compound_membership import UserCompoundMembership
    from app.models.verification import VerificationDocument

    ids = list(
        (
            await db.execute(
                select(User.id).where(
                    User.id.in_(user_ids),
                    or_(User.role.is_(None), User.role != UserRole.ADMIN),
                )
            )
        ).scalars().all()
    )
    if not ids:
        return 0

    post_ids = select(Post.id).where(Post.author_id.in_(ids))
    listing_ids = select(Listing.id).where(Listing.owner_id.in_(ids))
    conversation_ids = select(Conversation.id).where(
        or_(
            Conversation.user1_id.in_(ids),
            Conversation.user2_id.in_(ids),
            Conversation.listing_id.in_(listing_ids),
        )
    )

    await db.execute(update(User).where(User.id.in_(ids)).values(creation_job_id=None))
    await db.execute(delete(PollVote).where(PollVote.post_id.in_(post_ids)))
    await db.execute(delete(PostReaction).where(PostReaction.post_id.in_(post_ids)))
    await db.execute(delete(SavedPost).where(SavedPost.post_id.in_(post_ids)))
    await db.execute(delete(Comment).where(Comment.post_id.in_(post_ids)))
    await db.execute(delete(SavedPost).where(SavedPost.user_id.in_(ids)))
    await db.execute(delete(PostReaction).where(PostReaction.user_id.in_(ids)))
    await db.execute(delete(PollVote).where(PollVote.user_id.in_(ids)))
    await db.execute(delete(Comment).where(Comment.author_id.in_(ids)))
    await db.execute(delete(Post).where(Post.author_id.in_(ids)))

    await db.execute(delete(Message).where(Message.conversation_id.in_(conversation_ids)))
    await db.execute(delete(Conversation).where(Conversation.id.in_(conversation_ids)))
    await db.execute(delete(Message).where(Message.sender_id.in_(ids)))
    await db.execute(delete(Promotion).where(Promotion.listing_id.in_(listing_ids)))
    await db.execute(delete(SavedListing).where(SavedListing.listing_id.in_(listing_ids)))
    await db.execute(delete(Review).where(Review.listing_id.in_(listing_ids)))
    await db.execute(delete(SavedListing).where(SavedListing.user_id.in_(ids)))
    await db.execute(delete(Review).where(Review.reviewer_id.in_(ids)))
    await db.execute(delete(Listing).where(Listing.owner_id.in_(ids)))

    await db.execute(
        delete(UserCompoundMembership).where(UserCompoundMembership.user_id.in_(ids))
    )
    await db.execute(delete(Notification).where(Notification.user_id.in_(ids)))
    await db.execute(delete(Report).where(Report.reporter_id.in_(ids)))
    await db.execute(
        update(Report).where(Report.reviewed_by_id.in_(ids)).values(reviewed_by_id=None)
    )
    await db.execute(delete(VerificationDocument).where(VerificationDocument.user_id.in_(ids)))
    await db.execute(
        update(VerificationDocument)
        .where(VerificationDocument.reviewer_id.in_(ids))
        .values(reviewer_id=None)
    )
    await db.execute(
        update(Compound).where(Compound.moderator_id.in_(ids)).values(moderator_id=None)
    )
    result = await db.execute(delete(User).where(User.id.in_(ids)))
    return result.rowcount or 0


async def delete_compound(
    db: AsyncSession,
    compound_id: int,
    *,
    force: bool = False,
) -> dict:
    """
    Delete a compound.

    By default refuses when users, posts, listings, or chat imports still reference it.
    With force=True:
      - deletes chat-import jobs/items (+ local upload dirs)
      - deletes published compound posts/listings (and nested comments, etc.)
      - deletes CHAT_IMPORT-only users created for this compound (no other memberships)
      - clears remaining user.compound_id pointers and memberships
      - deletes the compound row
    """
    import shutil
    from pathlib import Path

    from sqlalchemy import delete, func, or_, select, update
    from app.models.user import User
    from app.models.post import Post
    from app.models.listing import Listing
    from app.models.user_compound_membership import UserCompoundMembership
    from app.models.chat_import import ChatImportJob, ChatImportItem
    from app.services.storage import LOCAL_STORAGE_DIR

    compound = await get_compound_by_id(db, compound_id)
    if not compound:
        raise ValueError("Compound not found")

    users_count = (
        await db.execute(
            select(func.count()).select_from(User).where(User.compound_id == compound_id)
        )
    ).scalar() or 0
    memberships_count = (
        await db.execute(
            select(func.count())
            .select_from(UserCompoundMembership)
            .where(UserCompoundMembership.compound_id == compound_id)
        )
    ).scalar() or 0
    posts_count = (
        await db.execute(
            select(func.count()).select_from(Post).where(Post.compound_id == compound_id)
        )
    ).scalar() or 0
    listings_count = (
        await db.execute(
            select(func.count())
            .select_from(Listing)
            .where(Listing.compound_id == compound_id)
        )
    ).scalar() or 0

    jobs_result = await db.execute(
        select(ChatImportJob).where(ChatImportJob.compound_id == compound_id)
    )
    jobs = list(jobs_result.scalars().all())
    job_ids = [job.id for job in jobs]
    import_jobs_count = len(job_ids)
    storage_paths = [job.storage_path for job in jobs if job.storage_path]

    stats = {
        "users": users_count,
        "memberships": memberships_count,
        "posts": posts_count,
        "listings": listings_count,
        "chat_import_jobs": import_jobs_count,
        "imported_users_deleted": 0,
    }
    has_content = any(
        [
            users_count,
            memberships_count,
            posts_count,
            listings_count,
            import_jobs_count,
        ]
    )
    if has_content and not force:
        raise PermissionError(
            "Compound still has linked data. Pass force=true to delete anyway "
            "(this also removes chat imports and import-created users). "
            f"users={users_count}, memberships={memberships_count}, "
            f"posts={posts_count}, listings={listings_count}, "
            f"chat_import_jobs={import_jobs_count}"
        )

    # Collect chat-import-created users before jobs/items are removed
    import_user_ids: set[int] = set()
    if job_ids:
        item_rows = await db.execute(
            select(
                ChatImportItem.matched_user_id,
                ChatImportItem.published_entity_type,
                ChatImportItem.published_entity_id,
            ).where(ChatImportItem.job_id.in_(job_ids))
        )
        for matched_user_id, entity_type, entity_id in item_rows.all():
            if matched_user_id:
                import_user_ids.add(int(matched_user_id))
            if entity_type == "USER" and entity_id:
                import_user_ids.add(int(entity_id))

        job_user_rows = await db.execute(
            select(User.id).where(
                User.creation_source == "CHAT_IMPORT",
                User.creation_job_id.in_(job_ids),
            )
        )
        import_user_ids.update(int(uid) for uid in job_user_rows.scalars().all())

    try:
        detail_user_rows = await db.execute(
            select(User.id).where(
                User.creation_source == "CHAT_IMPORT",
                User.creation_details.isnot(None),
                or_(
                    User.creation_details["compound_id"].as_integer() == compound_id,
                    User.creation_details["compound_id"].as_string() == str(compound_id),
                ),
            )
        )
        import_user_ids.update(int(uid) for uid in detail_user_rows.scalars().all())
    except Exception:
        # SQLite tests (and some JSON columns) cannot use JSON path operators.
        pass

    membership_import_rows = await db.execute(
        select(UserCompoundMembership.user_id).where(
            UserCompoundMembership.compound_id == compound_id,
            UserCompoundMembership.verification_source == "CHAT_IMPORT",
        )
    )
    import_user_ids.update(int(uid) for uid in membership_import_rows.scalars().all())

    compound_import_rows = await db.execute(
        select(User.id).where(
            User.compound_id == compound_id,
            User.creation_source == "CHAT_IMPORT",
        )
    )
    import_user_ids.update(int(uid) for uid in compound_import_rows.scalars().all())

    # Delete published content with set-based SQL. ORM cascade on thousands of
    # imported posts times out the HTTP request (client sees 400, server keeps going).
    await _bulk_delete_posts_for_compound(db, compound_id)
    await _bulk_delete_listings_for_compound(db, compound_id)

    from app.models.business import IndependentBusiness
    from app.models.compound_moderator import CompoundModeratorDocument, CompoundModeratorProfile
    from app.models.digest import DigestRun
    from app.models.feature_flag import FeatureFlagOverride
    from app.models.verification import VerificationDocument

    await db.execute(
        update(IndependentBusiness)
        .where(IndependentBusiness.compound_id == compound_id)
        .values(compound_id=None)
    )
    await db.execute(
        update(DigestRun).where(DigestRun.compound_id == compound_id).values(compound_id=None)
    )
    await db.execute(
        update(User).where(User.compound_id == compound_id).values(compound_id=None)
    )
    await db.execute(
        update(Compound).where(Compound.id == compound_id).values(moderator_id=None)
    )
    mod_profile_ids = select(CompoundModeratorProfile.id).where(
        CompoundModeratorProfile.compound_id == compound_id
    )
    await db.execute(
        delete(CompoundModeratorDocument).where(
            CompoundModeratorDocument.profile_id.in_(mod_profile_ids)
        )
    )
    await db.execute(
        delete(CompoundModeratorProfile).where(
            CompoundModeratorProfile.compound_id == compound_id
        )
    )
    await db.execute(
        delete(FeatureFlagOverride).where(FeatureFlagOverride.compound_id == compound_id)
    )
    await db.execute(
        delete(VerificationDocument).where(VerificationDocument.compound_id == compound_id)
    )
    await db.execute(
        delete(UserCompoundMembership).where(
            UserCompoundMembership.compound_id == compound_id
        )
    )

    if job_ids:
        await db.execute(delete(ChatImportItem).where(ChatImportItem.job_id.in_(job_ids)))
        await db.execute(
            update(User).where(User.creation_job_id.in_(job_ids)).values(creation_job_id=None)
        )
        await db.execute(delete(ChatImportJob).where(ChatImportJob.id.in_(job_ids)))

    deletable_ids: list[int] = []
    if import_user_ids:
        still_member = set(
            (
                await db.execute(
                    select(UserCompoundMembership.user_id).where(
                        UserCompoundMembership.user_id.in_(import_user_ids)
                    )
                )
            ).scalars().all()
        )
        deletable_ids = [
            uid
            for uid in import_user_ids
            if uid not in still_member
        ]
    stats["imported_users_deleted"] = await _bulk_delete_users(db, deletable_ids)

    db.expunge(compound)
    await db.execute(delete(Compound).where(Compound.id == compound_id))
    await db.flush()

    # Local chat-import upload dirs (best-effort)
    chat_import_root = LOCAL_STORAGE_DIR / "chat-imports"
    for storage_path in storage_paths:
        try:
            job_dir = Path(storage_path).parent
            if job_dir.exists() and job_dir.parent.resolve() == chat_import_root.resolve():
                shutil.rmtree(job_dir, ignore_errors=True)
        except Exception:
            pass

    return stats

