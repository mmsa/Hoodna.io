from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from app.models.review import Review
from app.models.listing import Listing
from app.schemas.review import ReviewCreate, ReviewUpdate
from typing import Optional
from decimal import Decimal


async def create_review(
    db: AsyncSession,
    review_data: ReviewCreate,
    reviewer_id: int
) -> Review:
    """Create a new review. Ensures one review per user per listing."""
    # Check if review already exists
    existing = await db.execute(
        select(Review).where(
            Review.listing_id == review_data.listing_id,
            Review.reviewer_id == reviewer_id
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("You have already reviewed this listing")
    
    review = Review(
        listing_id=review_data.listing_id,
        reviewer_id=reviewer_id,
        rating=Decimal(str(review_data.rating)),
        comment=review_data.comment
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    return review


async def get_review(
    db: AsyncSession,
    review_id: int
) -> Optional[Review]:
    """Get a review by ID."""
    result = await db.execute(
        select(Review)
        .options(selectinload(Review.reviewer))
        .where(Review.id == review_id)
    )
    return result.scalar_one_or_none()


async def get_reviews_for_listing(
    db: AsyncSession,
    listing_id: int,
    skip: int = 0,
    limit: int = 50
) -> list[Review]:
    """Get all reviews for a listing."""
    result = await db.execute(
        select(Review)
        .options(selectinload(Review.reviewer))
        .where(Review.listing_id == listing_id)
        .order_by(desc(Review.created_at))
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_user_review_for_listing(
    db: AsyncSession,
    listing_id: int,
    user_id: int
) -> Optional[Review]:
    """Get a user's review for a specific listing."""
    result = await db.execute(
        select(Review).where(
            Review.listing_id == listing_id,
            Review.reviewer_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def update_review(
    db: AsyncSession,
    review_id: int,
    review_data: ReviewUpdate,
    user_id: int
) -> Optional[Review]:
    """Update a review. Only the reviewer can update their review."""
    review = await get_review(db, review_id)
    if not review:
        return None
    
    if review.reviewer_id != user_id:
        raise PermissionError("You can only update your own reviews")
    
    if review_data.rating is not None:
        review.rating = Decimal(str(review_data.rating))
    if review_data.comment is not None:
        review.comment = review_data.comment
    
    await db.commit()
    await db.refresh(review)
    return review


async def delete_review(
    db: AsyncSession,
    review_id: int,
    user_id: int
) -> bool:
    """Delete a review. Only the reviewer can delete their review."""
    review = await get_review(db, review_id)
    if not review:
        return False
    
    if review.reviewer_id != user_id:
        raise PermissionError("You can only delete your own reviews")
    
    await db.delete(review)
    await db.commit()
    return True


async def get_listing_rating_stats(
    db: AsyncSession,
    listing_id: int
) -> dict:
    """Get aggregated rating statistics for a listing."""
    result = await db.execute(
        select(
            func.count(Review.id).label('count'),
            func.avg(Review.rating).label('average')
        ).where(Review.listing_id == listing_id)
    )
    stats = result.first()
    
    if stats and stats.count > 0:
        return {
            'average_rating': float(stats.average) if stats.average else None,
            'review_count': stats.count
        }
    return {
        'average_rating': None,
        'review_count': 0
    }

