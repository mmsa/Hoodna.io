from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum as SQLEnum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
from app.models.enums import ModeratorStatus


class CompoundModeratorProfile(Base):
    """Compound moderator profile - separate from resident verification."""
    __tablename__ = "compound_moderator_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    compound_id = Column(Integer, ForeignKey("compounds.id"), nullable=False, index=True)
    
    # Basic info
    role_title = Column(String, nullable=True)  # e.g., "Moderator", "Community Admin", "HOA Manager"
    
    # Status tracking
    moderator_status = Column(SQLEnum(ModeratorStatus), default=ModeratorStatus.DRAFT, nullable=False, index=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    suspension_reason = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="moderator_profile")
    compound = relationship("Compound", back_populates="moderators")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    documents = relationship("CompoundModeratorDocument", back_populates="profile", cascade="all, delete-orphan")


class CompoundModeratorDocument(Base):
    """Documents uploaded by compound moderators."""
    __tablename__ = "compound_moderator_documents"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("compound_moderator_profiles.id"), nullable=False, index=True)
    document_type = Column(String, nullable=False)  # NATIONAL_ID_FRONT, NATIONAL_ID_BACK, AUTHORIZATION_LETTER
    file_url = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    profile = relationship("CompoundModeratorProfile", back_populates="documents")

