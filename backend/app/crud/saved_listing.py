from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.saved_listing import SavedListing
from app.models.listing import Listing
from typing import List


async def save_listing(
    db: AsyncSession, user_id: int, listing_id: int
) -> SavedListing:
    """Save a listing for a user. Returns existing saved listing if already saved."""
    # Check if already saved
    result = await db.execute(
        select(SavedListing).where(
            and_(
                SavedListing.user_id == user_id,
                SavedListing.listing_id == listing_id
            )
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        return existing
    
    # Create new saved listing
    saved = SavedListing(
        user_id=user_id,
        listing_id=listing_id
    )
    db.add(saved)
    await db.flush()
    await db.refresh(saved)
    return saved


async def unsave_listing(
    db: AsyncSession, user_id: int, listing_id: int
) -> bool:
    """Remove a saved listing. Returns True if removed, False if not found."""
    result = await db.execute(
        select(SavedListing).where(
            and_(
                SavedListing.user_id == user_id,
                SavedListing.listing_id == listing_id
            )
        )
    )
    saved = result.scalar_one_or_none()
    
    if saved:
        await db.delete(saved)
        await db.flush()
        return True
    return False


async def is_listing_saved(
    db: AsyncSession, user_id: int, listing_id: int
) -> bool:
    """Check if a listing is saved by a user."""
    result = await db.execute(
        select(SavedListing).where(
            and_(
                SavedListing.user_id == user_id,
                SavedListing.listing_id == listing_id
            )
        )
    )
    return result.scalar_one_or_none() is not None


async def get_saved_listings(
    db: AsyncSession, user_id: int, skip: int = 0, limit: int = 50
) -> List[Listing]:
    """Get all saved listings for a user."""
    result = await db.execute(
        select(Listing)
        .join(SavedListing, Listing.id == SavedListing.listing_id)
        .where(SavedListing.user_id == user_id)
        .order_by(SavedListing.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())

