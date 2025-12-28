from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func, desc, asc
from sqlalchemy.orm import selectinload
from app.models.listing import Listing, Promotion
from app.models.enums import ListingStatus, PromotionScope, PromotionStatus, ListingCategory, ListingIntent
from app.schemas.marketplace import ListingCreate, ListingUpdate
from datetime import datetime, timedelta
from typing import Optional


async def get_listings(
    db: AsyncSession,
    compound_id: int | None = None,
    scope: str = "compound",
    skip: int = 0,
    limit: int = 50,
    category: Optional[ListingCategory] = None,
    intent: Optional[ListingIntent] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None
) -> list[Listing]:
    """
    Get listings based on scope:
    - compound: Only listings in user's compound
    - cross: Cross-compound promoted listings
    - public: Public promoted listings
    
    Can also filter by category and intent.
    """
    query = select(Listing).options(
        selectinload(Listing.compound),
        selectinload(Listing.owner),
        selectinload(Listing.promotions)
    ).where(Listing.status == ListingStatus.ACTIVE)
    
    if scope == "compound":
        if compound_id:
            query = query.where(Listing.compound_id == compound_id)
    elif scope == "cross":
        # Listings with active CROSS_COMPOUND promotion
        query = query.join(Promotion).where(
            and_(
                Promotion.scope == PromotionScope.CROSS_COMPOUND,
                Promotion.status == PromotionStatus.ACTIVE,
                Promotion.starts_at <= datetime.utcnow(),
                Promotion.ends_at >= datetime.utcnow()
            )
        )
    elif scope == "public":
        # Listings with active PUBLIC promotion
        query = query.join(Promotion).where(
            and_(
                Promotion.scope == PromotionScope.PUBLIC,
                Promotion.status == PromotionStatus.ACTIVE,
                Promotion.starts_at <= datetime.utcnow(),
                Promotion.ends_at >= datetime.utcnow()
            )
        )
    
    # Apply category filter
    if category:
        query = query.where(Listing.category == category)
    
    # Apply intent filter
    if intent:
        query = query.where(Listing.intent == intent)
    
    # Apply search filter (search in title and description)
    if search:
        search_term = f"%{search.lower()}%"
        query = query.where(
            or_(
                func.lower(Listing.title).like(search_term),
                func.lower(Listing.description).like(search_term)
            )
        )
    
    # Apply price range filters
    if min_price is not None:
        query = query.where(Listing.price >= min_price)
    if max_price is not None:
        query = query.where(Listing.price <= max_price)
    
    # Apply sorting
    if sort_by == "price_asc":
        query = query.order_by(asc(Listing.price))
    elif sort_by == "price_desc":
        query = query.order_by(desc(Listing.price))
    elif sort_by == "date_asc":
        query = query.order_by(asc(Listing.created_at))
    else:  # Default: newest first
        query = query.order_by(desc(Listing.created_at))
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_listing_by_id(db: AsyncSession, listing_id: int) -> Listing | None:
    """Get listing by ID."""
    result = await db.execute(
        select(Listing)
        .options(
            selectinload(Listing.compound),
            selectinload(Listing.owner),
            selectinload(Listing.promotions)
        )
        .where(Listing.id == listing_id)
    )
    return result.scalar_one_or_none()


async def create_listing(
    db: AsyncSession,
    compound_id: int,
    owner_id: int,
    listing_data: ListingCreate
) -> Listing:
    """Create a new listing."""
    db_listing = Listing(
        compound_id=compound_id,
        owner_id=owner_id,
        **listing_data.model_dump()
    )
    db.add(db_listing)
    await db.flush()
    await db.refresh(db_listing)
    return db_listing


async def update_listing(
    db: AsyncSession,
    listing_id: int,
    listing_data: ListingUpdate,
    owner_id: int
) -> Listing:
    """Update a listing (only by owner)."""
    listing = await db.get(Listing, listing_id)
    if not listing:
        raise ValueError("Listing not found")
    
    if listing.owner_id != owner_id:
        raise ValueError("Not authorized to update this listing")
    
    update_data = listing_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(listing, field, value)
    
    await db.flush()
    await db.refresh(listing)
    return listing


async def create_promotion(
    db: AsyncSession,
    listing_id: int,
    scope: PromotionScope,
    duration_days: int,
    amount: float,
    currency: str,
    stripe_session_id: str | None = None
) -> Promotion:
    """Create a promotion for a listing."""
    starts_at = datetime.utcnow()
    ends_at = starts_at + timedelta(days=duration_days)
    
    status = PromotionStatus.PENDING_PAYMENT if stripe_session_id is None else PromotionStatus.ACTIVE
    
    db_promotion = Promotion(
        listing_id=listing_id,
        scope=scope,
        starts_at=starts_at,
        ends_at=ends_at,
        status=status,
        amount=amount,
        currency=currency,
        stripe_session_id=stripe_session_id,
    )
    db.add(db_promotion)
    await db.flush()
    await db.refresh(db_promotion)
    return db_promotion


async def activate_promotion(
    db: AsyncSession,
    stripe_session_id: str
) -> Promotion | None:
    """Activate a promotion after successful payment."""
    result = await db.execute(
        select(Promotion).where(Promotion.stripe_session_id == stripe_session_id)
    )
    promotion = result.scalar_one_or_none()
    
    if promotion:
        promotion.status = PromotionStatus.ACTIVE
        # Ensure listing is active
        listing = await db.get(Listing, promotion.listing_id)
        if listing:
            listing.status = ListingStatus.ACTIVE
        await db.flush()
        await db.refresh(promotion)
    
    return promotion


async def archive_listing(db: AsyncSession, listing_id: int) -> bool:
    """Archive a listing (admin action)."""
    listing = await db.get(Listing, listing_id)
    if not listing:
        return False
    listing.status = ListingStatus.ARCHIVED
    await db.flush()
    return True

