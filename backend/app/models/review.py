from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Numeric, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class Review(Base):
    """Review and rating for a listing (service)."""
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("listings.id"), nullable=False, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    rating = Column(Numeric(2, 1), nullable=False)  # Rating from 1.0 to 5.0
    comment = Column(Text, nullable=True)  # Optional review text
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    listing = relationship("Listing", back_populates="reviews")
    reviewer = relationship("User", back_populates="reviews")

    # Ensure one review per user per listing
    __table_args__ = (
        CheckConstraint('rating >= 1.0 AND rating <= 5.0', name='check_rating_range'),
    )

