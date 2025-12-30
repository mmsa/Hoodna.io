from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.core.dependencies import get_current_approved_user
from app.models.user import User
from app.schemas.review import ReviewCreate, ReviewUpdate, ReviewResponse
from app.crud.review import (
    create_review,
    get_review,
    get_reviews_for_listing,
    get_user_review_for_listing,
    update_review,
    delete_review,
    get_listing_rating_stats
)
from typing import List

router = APIRouter()


@router.post("/listings/{listing_id}/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review_endpoint(
    listing_id: int,
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a review for a listing."""
    if review_data.listing_id != listing_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Listing ID mismatch"
        )
    
    try:
        review = await create_review(db, review_data, current_user.id)
        # Load reviewer relationship
        await db.refresh(review, ["reviewer"])
        return ReviewResponse(
            id=review.id,
            listing_id=review.listing_id,
            reviewer_id=review.reviewer_id,
            reviewer_name=review.reviewer.name,
            rating=review.rating,
            comment=review.comment,
            created_at=review.created_at,
            updated_at=review.updated_at
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/listings/{listing_id}/reviews", response_model=List[ReviewResponse])
async def get_listing_reviews(
    listing_id: int,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Get all reviews for a listing."""
    reviews = await get_reviews_for_listing(db, listing_id, skip, limit)
    return [
        ReviewResponse(
            id=review.id,
            listing_id=review.listing_id,
            reviewer_id=review.reviewer_id,
            reviewer_name=review.reviewer.name,
            rating=review.rating,
            comment=review.comment,
            created_at=review.created_at,
            updated_at=review.updated_at
        )
        for review in reviews
    ]


@router.get("/listings/{listing_id}/reviews/stats")
async def get_listing_review_stats(
    listing_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get rating statistics for a listing."""
    return await get_listing_rating_stats(db, listing_id)


@router.get("/listings/{listing_id}/reviews/my", response_model=ReviewResponse | None)
async def get_my_review(
    listing_id: int,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's review for a listing."""
    review = await get_user_review_for_listing(db, listing_id, current_user.id)
    if not review:
        return None
    
    await db.refresh(review, ["reviewer"])
    return ReviewResponse(
        id=review.id,
        listing_id=review.listing_id,
        reviewer_id=review.reviewer_id,
        reviewer_name=review.reviewer.name,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at,
        updated_at=review.updated_at
    )


@router.put("/reviews/{review_id}", response_model=ReviewResponse)
async def update_review_endpoint(
    review_id: int,
    review_data: ReviewUpdate,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a review."""
    try:
        review = await update_review(db, review_id, review_data, current_user.id)
        if not review:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )
        await db.refresh(review, ["reviewer"])
        return ReviewResponse(
            id=review.id,
            listing_id=review.listing_id,
            reviewer_id=review.reviewer_id,
            reviewer_name=review.reviewer.name,
            rating=review.rating,
            comment=review.comment,
            created_at=review.created_at,
            updated_at=review.updated_at
        )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )


@router.delete("/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_review_endpoint(
    review_id: int,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a review."""
    try:
        success = await delete_review(db, review_id, current_user.id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )

