from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.enums import ProviderType, ProviderVerificationMethod, ProviderStatus


class ServiceProviderProfileCreate(BaseModel):
    provider_type: ProviderType
    verification_method: ProviderVerificationMethod
    business_name: str
    category_id: int
    phone: str
    service_area_compound_ids: List[int] = Field(..., min_items=1)
    occupation_text: Optional[str] = None


class ServiceProviderProfileUpdate(BaseModel):
    provider_type: Optional[ProviderType] = None
    verification_method: Optional[ProviderVerificationMethod] = None
    business_name: Optional[str] = None
    category_id: Optional[int] = None
    phone: Optional[str] = None
    service_area_compound_ids: Optional[List[int]] = None
    occupation_text: Optional[str] = None


class ServiceProviderDocumentCreate(BaseModel):
    document_type: str
    file_url: str


class ServiceProviderProfileResponse(BaseModel):
    id: int
    user_id: int
    provider_type: Optional[ProviderType] = None
    verification_method: Optional[ProviderVerificationMethod] = None
    business_name: Optional[str] = None
    category_id: Optional[int] = None
    phone: Optional[str] = None
    service_area_compound_ids: Optional[List[int]] = None
    occupation_text: Optional[str] = None
    provider_status: ProviderStatus
    submitted_at: Optional[datetime] = None
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None
    rejection_reason: Optional[str] = None
    suspension_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    documents: List['ServiceProviderDocumentResponse'] = []

    class Config:
        from_attributes = True


class ServiceProviderDocumentResponse(BaseModel):
    id: int
    profile_id: int
    document_type: str
    file_url: str
    created_at: datetime

    class Config:
        from_attributes = True


ServiceProviderProfileResponse.model_rebuild()

