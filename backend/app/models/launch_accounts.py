from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.models.enums import (
    AccountDeletionStatus,
    DigestFrequency,
    ReferralInviteStatus,
    ReferralRewardStatus,
)


def portable_enum(enum_class, name):
    return SQLEnum(enum_class, name=name, native_enum=False, create_constraint=True)


class ReferralInvite(Base):
    __tablename__ = "referral_invites"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), unique=True, nullable=False, index=True)
    inviter_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    accepted_user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        unique=True,
        nullable=True,
        index=True,
    )
    invited_email = Column(String(320), nullable=True, index=True)
    invited_phone = Column(String(32), nullable=True)
    status = Column(
        portable_enum(ReferralInviteStatus, "referral_invite_status"),
        default=ReferralInviteStatus.PENDING,
        nullable=False,
        index=True,
    )
    reward_status = Column(
        portable_enum(ReferralRewardStatus, "referral_reward_status"),
        default=ReferralRewardStatus.NOT_ELIGIBLE,
        nullable=False,
        index=True,
    )
    expires_at = Column(DateTime(timezone=True), nullable=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    inviter = relationship("User", foreign_keys=[inviter_id])
    accepted_user = relationship("User", foreign_keys=[accepted_user_id])


class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    email_notifications = Column(Boolean, default=True, nullable=False)
    push_notifications = Column(Boolean, default=True, nullable=False)
    community_notifications = Column(Boolean, default=True, nullable=False)
    marketplace_notifications = Column(Boolean, default=True, nullable=False)
    digest_enabled = Column(Boolean, default=True, nullable=False)
    digest_frequency = Column(
        portable_enum(DigestFrequency, "digest_frequency"),
        default=DigestFrequency.WEEKLY,
        nullable=False,
    )
    preferences = Column(JSON, default=dict, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User")


class AccountDeletionRequest(Base):
    __tablename__ = "account_deletion_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    reason = Column(Text, nullable=True)
    status = Column(
        portable_enum(AccountDeletionStatus, "account_deletion_status"),
        default=AccountDeletionStatus.PENDING,
        nullable=False,
        index=True,
    )
    requested_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewer_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    review_notes = Column(Text, nullable=True)
    scheduled_for = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])
