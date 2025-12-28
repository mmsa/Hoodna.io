from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum as SQLEnum, Text, JSON, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
from app.models.enums import DocumentType, DocumentStatus


class VerificationDocument(Base):
    __tablename__ = "verification_documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(SQLEnum(DocumentType), nullable=False)
    file_url = Column(String, nullable=False)
    status = Column(SQLEnum(DocumentStatus), default=DocumentStatus.PENDING, nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    notes = Column(Text, nullable=True)
    
    # LLM verification results
    llm_verified = Column(Integer, nullable=True)  # 0 or 1 (boolean)
    llm_confidence = Column(Float, nullable=True)  # 0.0 to 1.0
    llm_recommendation = Column(String, nullable=True)  # APPROVE, REJECT, REQUEST_MORE_DETAILS
    llm_reasoning = Column(Text, nullable=True)
    llm_issues = Column(JSON, nullable=True)  # List of issues found
    llm_extracted_info = Column(JSON, nullable=True)  # Extracted information
    llm_verified_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="verification_documents")
    reviewer = relationship("User", foreign_keys=[reviewer_id])

