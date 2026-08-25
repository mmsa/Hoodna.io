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
from app.models.enums import (
    ChatImportItemDecision,
    ChatImportItemKind,
    ChatImportJobStatus,
    ChatImportSource,
)


def portable_enum(enum_class, name):
    return SQLEnum(enum_class, name=name, native_enum=False, create_constraint=True)


class ChatImportJob(Base):
    __tablename__ = "chat_import_jobs"
    __table_args__ = (
        Index("ix_chat_import_jobs_compound_status", "compound_id", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    compound_id = Column(
        Integer, ForeignKey("compounds.id", ondelete="CASCADE"), nullable=False, index=True
    )
    uploaded_by_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    source = Column(
        portable_enum(ChatImportSource, "chat_import_source"),
        nullable=False,
        index=True,
    )
    status = Column(
        portable_enum(ChatImportJobStatus, "chat_import_job_status"),
        default=ChatImportJobStatus.UPLOADED,
        nullable=False,
        index=True,
    )
    original_filename = Column(String(500), nullable=True)
    storage_path = Column(String(1000), nullable=True)
    stats = Column(JSON, default=dict, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)

    compound = relationship("Compound")
    uploaded_by = relationship("User", foreign_keys=[uploaded_by_id])
    items = relationship(
        "ChatImportItem",
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="ChatImportItem.id",
    )


class ChatImportItem(Base):
    __tablename__ = "chat_import_items"
    __table_args__ = (
        Index("ix_chat_import_items_job_decision", "job_id", "decision"),
        Index("ix_chat_import_items_job_kind", "job_id", "kind"),
    )

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(
        Integer,
        ForeignKey("chat_import_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kind = Column(
        portable_enum(ChatImportItemKind, "chat_import_item_kind"),
        nullable=False,
        index=True,
    )
    decision = Column(
        portable_enum(ChatImportItemDecision, "chat_import_item_decision"),
        default=ChatImportItemDecision.PENDING,
        nullable=False,
        index=True,
    )
    raw_payload = Column(JSON, default=dict, nullable=False)
    normalized = Column(JSON, default=dict, nullable=False)
    matched_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    published_entity_type = Column(String(50), nullable=True)
    published_entity_id = Column(Integer, nullable=True)
    reject_reason = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    job = relationship("ChatImportJob", back_populates="items")
    matched_user = relationship("User", foreign_keys=[matched_user_id])
