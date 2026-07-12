from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base
from app.models.enums import (
    BusinessClaimStatus,
    BusinessMembershipRole,
    BusinessVerificationStatus,
)


def portable_enum(enum_class, name):
    return SQLEnum(enum_class, name=name, native_enum=False, create_constraint=True)


class IndependentBusiness(Base):
    __tablename__ = "independent_businesses"
    __table_args__ = (
        Index("ix_independent_businesses_location", "city", "area"),
        Index(
            "ix_independent_businesses_visibility",
            "is_active",
            "is_hidden",
            "verification_status",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(160), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    compound_id = Column(
        Integer, ForeignKey("compounds.id", ondelete="SET NULL"), nullable=True, index=True
    )
    city = Column(String(120), nullable=False, index=True)
    area = Column(String(120), nullable=True, index=True)
    category = Column(String(120), nullable=False, index=True)
    address = Column(Text, nullable=True)
    phone = Column(String(32), nullable=True)
    whatsapp = Column(String(32), nullable=True)
    email = Column(String(320), nullable=True)
    website = Column(String(500), nullable=True)
    contact_name = Column(String(200), nullable=True)
    hours = Column(JSON, default=dict, nullable=False)
    verification_status = Column(
        portable_enum(BusinessVerificationStatus, "business_verification_status"),
        default=BusinessVerificationStatus.UNVERIFIED,
        nullable=False,
        index=True,
    )
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    is_hidden = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    compound = relationship("Compound")
    claims = relationship(
        "BusinessClaim", back_populates="business", cascade="all, delete-orphan"
    )
    memberships = relationship(
        "BusinessMembership", back_populates="business", cascade="all, delete-orphan"
    )


class BusinessClaim(Base):
    __tablename__ = "business_claims"
    __table_args__ = (
        Index("ix_business_claims_queue", "status", "submitted_at"),
        Index(
            "uq_business_claims_active_user_business",
            "business_id",
            "claimant_id",
            unique=True,
            postgresql_where=text("status = 'PENDING'"),
            sqlite_where=text("status = 'PENDING'"),
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(
        Integer,
        ForeignKey("independent_businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    claimant_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    full_name = Column(String(200), nullable=False)
    relationship_role = Column(String(120), nullable=False)
    phone = Column(String(32), nullable=False)
    email = Column(String(320), nullable=False)
    supporting_info = Column(Text, nullable=True)
    supporting_documents = Column(JSON, default=list, nullable=False)
    status = Column(
        portable_enum(BusinessClaimStatus, "business_claim_status"),
        default=BusinessClaimStatus.PENDING,
        nullable=False,
        index=True,
    )
    submitted_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewer_id = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    review_notes = Column(Text, nullable=True)

    business = relationship("IndependentBusiness", back_populates="claims")
    claimant = relationship("User", foreign_keys=[claimant_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])


class BusinessMembership(Base):
    __tablename__ = "business_memberships"
    __table_args__ = (
        UniqueConstraint(
            "business_id", "user_id", name="uq_business_membership_business_user"
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(
        Integer,
        ForeignKey("independent_businesses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role = Column(
        portable_enum(BusinessMembershipRole, "business_membership_role"),
        nullable=False,
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    business = relationship("IndependentBusiness", back_populates="memberships")
    user = relationship("User")
