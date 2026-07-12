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
    event,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.models.enums import ModerationActionType


class ModerationAction(Base):
    __tablename__ = "moderation_actions"
    __table_args__ = (
        Index("ix_moderation_actions_target", "target_type", "target_id"),
        Index("ix_moderation_actions_created", "created_at", "action_type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    subject_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    report_id = Column(
        Integer, ForeignKey("reports.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action_type = Column(
        SQLEnum(
            ModerationActionType,
            name="moderation_action_type",
            native_enum=False,
            create_constraint=True,
        ),
        nullable=False,
        index=True,
    )
    target_type = Column(String(50), nullable=False)
    target_id = Column(Integer, nullable=True)
    reason = Column(Text, nullable=False)
    details = Column(JSON, default=dict, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    actor = relationship("User", foreign_keys=[actor_id])
    subject_user = relationship("User", foreign_keys=[subject_user_id])
    report = relationship("Report")


class AuditLog(Base):
    """Immutable application audit trail; ORM updates and deletes are rejected."""

    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_actor_created", "actor_id", "created_at"),
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
        Index("ix_audit_logs_event_created", "event_type", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    event_type = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(100), nullable=True)
    entity_id = Column(String(100), nullable=True)
    request_id = Column(String(100), nullable=True, index=True)
    ip_address = Column(String(64), nullable=True)
    user_agent = Column(Text, nullable=True)
    data = Column(JSON, default=dict, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    actor = relationship("User")


def _reject_audit_log_mutation(mapper, connection, target):
    raise ValueError("audit_logs are append-only")


event.listen(AuditLog, "before_update", _reject_audit_log_mutation)
event.listen(AuditLog, "before_delete", _reject_audit_log_mutation)
