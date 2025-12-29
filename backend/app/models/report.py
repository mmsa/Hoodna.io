from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base


class ReportType(str):
    POST = "POST"
    LISTING = "LISTING"
    COMMENT = "COMMENT"
    USER = "USER"


class ReportStatus(str):
    PENDING = "PENDING"
    REVIEWED = "REVIEWED"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reported_type = Column(String, nullable=False)  # "post", "listing", "comment", "user"
    reported_id = Column(Integer, nullable=False, index=True)  # ID of the reported entity
    reason = Column(String, nullable=False)  # "spam", "inappropriate", "scam", "other"
    description = Column(Text, nullable=True)  # Additional details
    status = Column(String, default="PENDING", nullable=False, index=True)
    
    # Admin/moderator who reviewed it
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    reporter = relationship("User", foreign_keys=[reporter_id], backref="reports_made")
    reviewer = relationship("User", foreign_keys=[reviewed_by_id], backref="reports_reviewed")

