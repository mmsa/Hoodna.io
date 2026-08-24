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

    By default refuses when users, posts, or listings still reference it.
    With force=True, clears user.compound_id pointers and deletes the compound
    (related posts/listings cascade via ORM relationships).
    """
    from sqlalchemy import delete, func, select, update
    from app.models.user import User
    from app.models.post import Post
    from app.models.listing import Listing
    from app.models.user_compound_membership import UserCompoundMembership

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

    stats = {
        "users": users_count,
        "memberships": memberships_count,
        "posts": posts_count,
        "listings": listings_count,
    }
    has_content = any(stats.values())
    if has_content and not force:
        raise PermissionError(
            "Compound still has linked data. Pass force=true to delete anyway. "
            f"users={users_count}, memberships={memberships_count}, "
            f"posts={posts_count}, listings={listings_count}"
        )

    if users_count:
        await db.execute(
            update(User).where(User.compound_id == compound_id).values(compound_id=None)
        )
    if memberships_count:
        await db.execute(
            delete(UserCompoundMembership).where(
                UserCompoundMembership.compound_id == compound_id
            )
        )

    await db.delete(compound)
    await db.flush()
    return stats

