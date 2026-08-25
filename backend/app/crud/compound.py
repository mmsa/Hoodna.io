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

    # Clear primary compound pointer and this compound's memberships first
    if users_count:
        await db.execute(
            update(User).where(User.compound_id == compound_id).values(compound_id=None)
        )
    if compound.moderator_id:
        compound.moderator_id = None
        await db.flush()
    if memberships_count:
        await db.execute(
            delete(UserCompoundMembership).where(
                UserCompoundMembership.compound_id == compound_id
            )
        )

    # Collect chat-import-created users tied to this compound's jobs / details
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

    # Only delete invite/import accounts that have no remaining memberships elsewhere
    deleted_import_users = 0
    if import_user_ids:
        from app.models.report import Report
        from app.models.verification import VerificationDocument

        candidates = (
            await db.execute(
                select(User).where(
                    User.id.in_(import_user_ids),
                    User.creation_source == "CHAT_IMPORT",
                )
            )
        ).scalars().all()
        for user in candidates:
            other_memberships = (
                await db.execute(
                    select(func.count())
                    .select_from(UserCompoundMembership)
                    .where(UserCompoundMembership.user_id == user.id)
                )
            ).scalar() or 0
            if other_memberships:
                continue
            # Detach FK references that are not cascaded
            user.creation_job_id = None
            await db.execute(
                delete(Report).where(Report.reporter_id == user.id)
            )
            await db.execute(
                update(Report)
                .where(Report.reviewed_by_id == user.id)
                .values(reviewed_by_id=None)
            )
            await db.execute(
                update(VerificationDocument)
                .where(VerificationDocument.reviewer_id == user.id)
                .values(reviewer_id=None)
            )
            await db.flush()
            await db.delete(user)
            deleted_import_users += 1
        stats["imported_users_deleted"] = deleted_import_users

    # Remove compound content (imported + organic) so nothing is left behind
    posts = (
        await db.execute(select(Post).where(Post.compound_id == compound_id))
    ).scalars().all()
    for post in posts:
        await db.delete(post)

    listings = (
        await db.execute(select(Listing).where(Listing.compound_id == compound_id))
    ).scalars().all()
    for listing in listings:
        await db.delete(listing)

    # Delete import jobs (items cascade via ORM/DB)
    if job_ids:
        await db.execute(delete(ChatImportJob).where(ChatImportJob.id.in_(job_ids)))

    await db.delete(compound)
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

