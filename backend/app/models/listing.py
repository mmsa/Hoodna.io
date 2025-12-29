from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum as SQLEnum, Text, Numeric, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
from app.models.enums import ListingCategory, ListingIntent, ListingStatus, PromotionScope, PromotionStatus


class Listing(Base):
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)
    compound_id = Column(Integer, ForeignKey("compounds.id"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category = Column(SQLEnum(ListingCategory), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(10, 2), nullable=True)
    currency = Column(String, default="EGP", nullable=False)
    intent = Column(SQLEnum(ListingIntent), nullable=False)
    image_urls = Column(JSON, default=list, nullable=False)
    status = Column(SQLEnum(ListingStatus), default=ListingStatus.DRAFT, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)  # Soft delete

    # Relationships
    compound = relationship("Compound", back_populates="listings")
    owner = relationship("User", back_populates="listings")
    promotions = relationship("Promotion", back_populates="listing", cascade="all, delete-orphan")
    saved_by_users = relationship("SavedListing", back_populates="listing", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="listing", cascade="all, delete-orphan")


class Promotion(Base):
    __tablename__ = "promotions"

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(Integer, ForeignKey("listings.id"), nullable=False)
    scope = Column(SQLEnum(PromotionScope), nullable=False)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    status = Column(SQLEnum(PromotionStatus), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String, default="EGP", nullable=False)
    stripe_session_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    listing = relationship("Listing", back_populates="promotions")

