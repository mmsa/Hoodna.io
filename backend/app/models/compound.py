from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric, Date, Index, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
from app.models.enums import CompoundStatus2025


class Compound(Base):
    __tablename__ = "compounds"

    id = Column(Integer, primary_key=True, index=True)
    compound_id = Column(String, unique=True, nullable=True, index=True)  # Unique slug/identifier from CSV (nullable initially for migration)
    name = Column(String, nullable=False, index=True)
    area = Column(String, nullable=True, index=True)  # Nullable initially for migration
    sub_area = Column(String, nullable=True, index=True)
    category = Column(String, nullable=True, index=True)
    developer = Column(String, nullable=True, index=True)
    status_2025 = Column(String, nullable=True, index=True)  # CompoundStatus2025 enum value (nullable initially)
    delivery_notes = Column(Text, nullable=True)
    source_hint = Column(String, nullable=True)
    last_verified_date = Column(Date, nullable=True)
    lat = Column(Numeric(10, 7), nullable=True)
    lng = Column(Numeric(10, 7), nullable=True)
    
    # Legacy fields (for backward compatibility)
    city = Column(String, nullable=True)  # Can be derived from area
    country = Column(String, nullable=False, default="Egypt")
    is_public = Column(Boolean, default=False, nullable=False)
    
    # Compound management
    moderator_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Compound-specific moderator
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    users = relationship("User", back_populates="compound", foreign_keys="User.compound_id")
    moderator = relationship("User", foreign_keys=[moderator_id])
    posts = relationship("Post", back_populates="compound", cascade="all, delete-orphan")
    listings = relationship("Listing", back_populates="compound", cascade="all, delete-orphan")
    
    # Composite indexes for common queries
    __table_args__ = (
        Index('ix_compounds_area_status', 'area', 'status_2025'),
        Index('ix_compounds_developer_status', 'developer', 'status_2025'),
        Index('ix_compounds_category_status', 'category', 'status_2025'),
    )

