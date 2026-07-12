from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.models.enums import ClientErrorStatus


class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    __table_args__ = (
        Index("ix_analytics_events_name_occurred", "event_name", "occurred_at"),
        Index("ix_analytics_events_user_occurred", "user_id", "occurred_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    event_name = Column(String(120), nullable=False, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    anonymous_id = Column(String(120), nullable=True, index=True)
    session_id = Column(String(120), nullable=True, index=True)
    platform = Column(String(40), nullable=True)
    app_version = Column(String(40), nullable=True)
    properties = Column(JSON, default=dict, nullable=False)
    occurred_at = Column(DateTime(timezone=True), nullable=False, index=True)
    received_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    user = relationship("User")


class ClientErrorReport(Base):
    __tablename__ = "client_error_reports"
    __table_args__ = (
        Index("ix_client_error_reports_fingerprint_created", "fingerprint", "created_at"),
        Index("ix_client_error_reports_status_created", "status", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    fingerprint = Column(String(128), nullable=True, index=True)
    message = Column(Text, nullable=False)
    stack_trace = Column(Text, nullable=True)
    source = Column(String(500), nullable=True)
    platform = Column(String(40), nullable=True)
    app_version = Column(String(40), nullable=True)
    severity = Column(String(20), nullable=False, default="ERROR", index=True)
    context = Column(JSON, default=dict, nullable=False)
    status = Column(
        SQLEnum(
            ClientErrorStatus,
            name="client_error_status",
            native_enum=False,
            create_constraint=True,
        ),
        default=ClientErrorStatus.OPEN,
        nullable=False,
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_by_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    user = relationship("User", foreign_keys=[user_id])
    resolved_by = relationship("User", foreign_keys=[resolved_by_id])
