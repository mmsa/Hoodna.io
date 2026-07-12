from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
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
from app.models.enums import FeatureFlagScope


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(120), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    enabled = Column(Boolean, default=False, nullable=False, index=True)
    config = Column(JSON, default=dict, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    overrides = relationship(
        "FeatureFlagOverride",
        back_populates="feature_flag",
        cascade="all, delete-orphan",
    )


class FeatureFlagOverride(Base):
    __tablename__ = "feature_flag_overrides"
    __table_args__ = (
        UniqueConstraint(
            "feature_flag_id",
            "scope",
            "target_key",
            name="uq_feature_flag_override_target",
        ),
        CheckConstraint(
            "(scope = 'USER' AND user_id IS NOT NULL AND compound_id IS NULL AND city IS NULL) "
            "OR (scope = 'COMPOUND' AND user_id IS NULL AND compound_id IS NOT NULL AND city IS NULL) "
            "OR (scope = 'CITY' AND user_id IS NULL AND compound_id IS NULL AND city IS NOT NULL)",
            name="ck_feature_flag_override_scope_target",
        ),
        Index("ix_feature_flag_overrides_lookup", "scope", "target_key"),
    )

    id = Column(Integer, primary_key=True, index=True)
    feature_flag_id = Column(
        Integer,
        ForeignKey("feature_flags.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scope = Column(
        SQLEnum(
            FeatureFlagScope,
            name="feature_flag_scope",
            native_enum=False,
            create_constraint=True,
        ),
        nullable=False,
        index=True,
    )
    target_key = Column(String(160), nullable=False)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    compound_id = Column(
        Integer,
        ForeignKey("compounds.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    city = Column(String(120), nullable=True, index=True)
    enabled = Column(Boolean, nullable=False)
    config = Column(JSON, default=dict, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    feature_flag = relationship("FeatureFlag", back_populates="overrides")
    user = relationship("User")
    compound = relationship("Compound")
