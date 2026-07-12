from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
from enum import Enum


class ReportType(str, Enum):
    POST = "POST"
    LISTING = "LISTING"
    COMMENT = "COMMENT"
    BUSINESS = "BUSINESS"
    USER = "USER"


class ReportReason(str, Enum):
    SPAM = "SPAM"
    HARASSMENT = "HARASSMENT"
    FALSE_INFORMATION = "FALSE_INFORMATION"
    INAPPROPRIATE_CONTENT = "INAPPROPRIATE_CONTENT"
    DUPLICATE_LISTING = "DUPLICATE_LISTING"
    OTHER = "OTHER"


class ReportStatus(str, Enum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class Report(Base):
    __tablename__ = "reports"
    __table_args__ = (
        Index(
            "uq_reports_active_reporter_target",
            "reporter_id",
            "reported_type",
            "reported_id",
            unique=True,
            sqlite_where=Column("status").in_(
                [ReportStatus.OPEN.value, ReportStatus.UNDER_REVIEW.value]
            ),
            postgresql_where=Column("status").in_(
                [ReportStatus.OPEN.value, ReportStatus.UNDER_REVIEW.value]
            ),
        ),
        Index("ix_reports_target", "reported_type", "reported_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    reported_type = Column(String, nullable=False)
    reported_id = Column(Integer, nullable=False, index=True)  # ID of the reported entity
    reason = Column(String, nullable=False)
    description = Column(Text, nullable=True)  # Additional details
    status = Column(String, default=ReportStatus.OPEN.value, nullable=False, index=True)
    
    # Admin/moderator who reviewed it
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    reporter = relationship("User", foreign_keys=[reporter_id], backref="reports_made")
    reviewer = relationship("User", foreign_keys=[reviewed_by_id], backref="reports_reviewed")

