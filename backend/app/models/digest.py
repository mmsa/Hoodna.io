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
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.models.enums import (
    DigestChannel,
    DigestDeliveryStatus,
    DigestFrequency,
    DigestRunStatus,
)


def portable_enum(enum_class, name):
    return SQLEnum(enum_class, name=name, native_enum=False, create_constraint=True)


class DigestRun(Base):
    __tablename__ = "digest_runs"
    __table_args__ = (
        Index("ix_digest_runs_status_started", "status", "started_at"),
        UniqueConstraint(
            "frequency",
            "period_start",
            "period_end",
            "compound_id",
            name="uq_digest_run_period_compound",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String(200), unique=True, nullable=False, index=True)
    frequency = Column(
        portable_enum(DigestFrequency, "digest_frequency"),
        nullable=False,
        index=True,
    )
    compound_id = Column(
        Integer, ForeignKey("compounds.id", ondelete="SET NULL"), nullable=True, index=True
    )
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    status = Column(
        portable_enum(DigestRunStatus, "digest_run_status"),
        default=DigestRunStatus.PENDING,
        nullable=False,
        index=True,
    )
    stats = Column(JSON, default=dict, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    compound = relationship("Compound")
    deliveries = relationship(
        "DigestDelivery", back_populates="run", cascade="all, delete-orphan"
    )


class DigestDelivery(Base):
    __tablename__ = "digest_deliveries"
    __table_args__ = (
        UniqueConstraint(
            "digest_run_id",
            "user_id",
            "channel",
            name="uq_digest_delivery_run_user_channel",
        ),
        Index("ix_digest_deliveries_status_created", "status", "created_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    digest_run_id = Column(
        Integer,
        ForeignKey("digest_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    channel = Column(
        portable_enum(DigestChannel, "digest_channel"), nullable=False, index=True
    )
    recipient = Column(String(320), nullable=True)
    status = Column(
        portable_enum(DigestDeliveryStatus, "digest_delivery_status"),
        default=DigestDeliveryStatus.PENDING,
        nullable=False,
        index=True,
    )
    content_summary = Column(JSON, default=dict, nullable=False)
    provider_message_id = Column(String(200), nullable=True, index=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    sent_at = Column(DateTime(timezone=True), nullable=True)

    run = relationship("DigestRun", back_populates="deliveries")
    user = relationship("User")
