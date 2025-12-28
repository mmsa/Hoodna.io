from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum as SQLEnum, Boolean, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
from app.models.enums import NotificationType


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(SQLEnum(NotificationType), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    
    # Optional metadata for linking to related entities
    related_id = Column(Integer, nullable=True)  # ID of related post, listing, message, etc.
    related_type = Column(String, nullable=True)  # Type: "post", "listing", "message", "comment", etc.
    metadata = Column(JSON, nullable=True)  # Additional data (e.g., sender name, listing title)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="notifications")

