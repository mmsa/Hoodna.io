from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.models.enums import DocumentType, DocumentStatus


class PresignRequest(BaseModel):
    file_name: str
    file_type: str
    document_type: DocumentType


class PresignResponse(BaseModel):
    presigned_url: str
    file_url: str


class DocumentSubmit(BaseModel):
    file_url: str
    document_type: DocumentType


class VerificationDocumentResponse(BaseModel):
    id: int
    user_id: int
    type: DocumentType
    file_url: str
    status: DocumentStatus
    reviewer_id: Optional[int] = None
    notes: Optional[str] = None
    llm_verified: Optional[bool] = None
    llm_confidence: Optional[float] = None
    llm_recommendation: Optional[str] = None
    llm_reasoning: Optional[str] = None
    llm_issues: Optional[list[str]] = None
    llm_extracted_info: Optional[dict] = None
    llm_verified_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class VerificationStatusResponse(BaseModel):
    national_id: Optional[VerificationDocumentResponse] = None
    contract: Optional[VerificationDocumentResponse] = None
    user_status: str
    can_post: bool


class DocumentReview(BaseModel):
    notes: Optional[str] = None

