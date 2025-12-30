from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class ReviewCreate(BaseModel):
    listing_id: int
    rating: float = Field(..., ge=1.0, le=5.0, description="Rating from 1.0 to 5.0")
    comment: Optional[str] = None


class ReviewUpdate(BaseModel):
    rating: Optional[float] = Field(None, ge=1.0, le=5.0)
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    id: int
    listing_id: int
    reviewer_id: int
    reviewer_name: str
    rating: Decimal
    comment: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ListingWithReviews(BaseModel):
    """Listing with aggregated review data."""
    id: int
    average_rating: Optional[float] = None
    review_count: int = 0
    reviews: list[ReviewResponse] = []

