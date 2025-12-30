from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum as SQLEnum, Text, ARRAY, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
from app.models.enums import ProviderType, ProviderVerificationMethod, ProviderStatus


class ServiceProviderProfile(Base):
    """Service provider profile - separate from resident verification."""
    __tablename__ = "service_provider_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    
    # Basic info
    provider_type = Column(SQLEnum(ProviderType), nullable=True)  # Set during onboarding
    verification_method = Column(SQLEnum(ProviderVerificationMethod), nullable=True)
    business_name = Column(String, nullable=True)
    category_id = Column(Integer, ForeignKey("service_categories.id"), nullable=True)
    phone = Column(String, nullable=True)
    service_area_compound_ids = Column(ARRAY(Integer), nullable=True)  # List of compound IDs
    occupation_text = Column(String, nullable=True)  # Required if NATIONAL_ID_OCCUPATION
    
    # Status tracking
    provider_status = Column(SQLEnum(ProviderStatus), default=ProviderStatus.DRAFT, nullable=False, index=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    suspension_reason = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="service_provider_profile")
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    documents = relationship("ServiceProviderDocument", back_populates="profile", cascade="all, delete-orphan")
    category = relationship("ServiceCategory", back_populates="providers")


class ServiceProviderDocument(Base):
    """Documents uploaded by service providers."""
    __tablename__ = "service_provider_documents"

    id = Column(Integer, primary_key=True, index=True)
    profile_id = Column(Integer, ForeignKey("service_provider_profiles.id"), nullable=False, index=True)
    document_type = Column(String, nullable=False)  # COMMERCIAL_REGISTER, TAX_CARD, NATIONAL_ID_FRONT, NATIONAL_ID_BACK
    file_url = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # LLM verification results
    llm_verified = Column(Integer, nullable=True)  # 0 or 1 (boolean)
    llm_confidence = Column(Float, nullable=True)  # 0.0 to 1.0
    llm_recommendation = Column(String, nullable=True)  # APPROVE, REJECT, REQUEST_MORE_DETAILS
    llm_reasoning = Column(Text, nullable=True)
    llm_issues = Column(JSON, nullable=True)  # List of issues found
    llm_extracted_info = Column(JSON, nullable=True)  # Extracted information
    llm_verified_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    profile = relationship("ServiceProviderProfile", back_populates="documents")

