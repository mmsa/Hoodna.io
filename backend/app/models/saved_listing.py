from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class SavedListing(Base):
    """Many-to-many relationship between users and listings (saved/bookmarked items)."""
    __tablename__ = "saved_listings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    listing_id = Column(Integer, ForeignKey("listings.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="saved_listings")
    listing = relationship("Listing", back_populates="saved_by_users")

    # Ensure a user can only save a listing once
    __table_args__ = (
        UniqueConstraint('user_id', 'listing_id', name='uq_user_listing'),
    )

