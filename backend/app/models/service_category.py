from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.db.base import Base


class ServiceCategory(Base):
    """Service categories for providers."""
    __tablename__ = "service_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
    description = Column(String, nullable=True)
    icon = Column(String, nullable=True)  # Icon name/emoji for UI
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    display_order = Column(Integer, default=0, nullable=False)  # For sorting in UI
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

