from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.enums import ModeratorStatus


class CompoundModeratorProfileCreate(BaseModel):
    compound_id: int
    role_title: str


class CompoundModeratorProfileUpdate(BaseModel):
    compound_id: Optional[int] = None
    role_title: Optional[str] = None


class CompoundModeratorDocumentCreate(BaseModel):
    document_type: str
    file_url: str


class CompoundModeratorProfileResponse(BaseModel):
    id: int
    user_id: int
    compound_id: int
    compound_name: Optional[str] = None
    role_title: Optional[str] = None
    moderator_status: ModeratorStatus
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None
    rejection_reason: Optional[str] = None
    suspension_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    documents: List['CompoundModeratorDocumentResponse'] = []

    class Config:
        from_attributes = True


class CompoundModeratorDocumentResponse(BaseModel):
    id: int
    profile_id: int
    document_type: str
    file_url: str
    created_at: datetime

    class Config:
        from_attributes = True


CompoundModeratorProfileResponse.model_rebuild()

