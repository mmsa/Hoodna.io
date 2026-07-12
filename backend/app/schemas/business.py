from datetime import datetime
from typing import Any, Literal

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

from app.models.enums import (
    BusinessClaimStatus,
    BusinessMembershipRole,
    BusinessVerificationStatus,
)


PublicBusinessStatus = Literal["unverified", "claimed", "verified"]


class BusinessCreate(BaseModel):
    slug: str | None = Field(None, min_length=2, max_length=160, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    name: str = Field(..., min_length=2, max_length=200)
    description: str | None = Field(None, max_length=5000)
    compound_id: int | None = Field(None, ge=1)
    city: str = Field(..., min_length=2, max_length=120)
    area: str | None = Field(None, max_length=120)
    category: str = Field(..., min_length=2, max_length=120)
    address: str | None = Field(None, max_length=1000)
    phone: str | None = Field(None, min_length=7, max_length=32)
    whatsapp: str | None = Field(None, min_length=7, max_length=32)
    email: EmailStr | None = None
    website: str | None = Field(None, max_length=500)
    contact_name: str | None = Field(None, max_length=200)
    hours: dict[str, Any] = Field(default_factory=dict)
    verification_status: BusinessVerificationStatus = BusinessVerificationStatus.UNVERIFIED
    is_active: bool = True
    is_hidden: bool = False

    @field_validator("name", "city", "category", "area", "address", "contact_name", mode="before")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value

    @field_validator("website")
    @classmethod
    def validate_website(cls, value: str | None) -> str | None:
        if value and not value.lower().startswith(("http://", "https://")):
            raise ValueError("website must use http:// or https://")
        return value


class BusinessUpdate(BaseModel):
    slug: str | None = Field(None, min_length=2, max_length=160, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    name: str | None = Field(None, min_length=2, max_length=200)
    description: str | None = Field(None, max_length=5000)
    compound_id: int | None = Field(None, ge=1)
    city: str | None = Field(None, min_length=2, max_length=120)
    area: str | None = Field(None, max_length=120)
    category: str | None = Field(None, min_length=2, max_length=120)
    address: str | None = Field(None, max_length=1000)
    phone: str | None = Field(None, min_length=7, max_length=32)
    whatsapp: str | None = Field(None, min_length=7, max_length=32)
    email: EmailStr | None = None
    website: str | None = Field(None, max_length=500)
    contact_name: str | None = Field(None, max_length=200)
    hours: dict[str, Any] | None = None
    verification_status: BusinessVerificationStatus | None = None
    is_active: bool | None = None
    is_hidden: bool | None = None

    @model_validator(mode="after")
    def require_update(self):
        if not self.model_fields_set:
            raise ValueError("at least one field must be supplied")
        return self

    @field_validator("website")
    @classmethod
    def validate_website(cls, value: str | None) -> str | None:
        if value and not value.lower().startswith(("http://", "https://")):
            raise ValueError("website must use http:// or https://")
        return value


class BusinessResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    description: str | None
    compound_id: int | None
    city: str
    area: str | None
    category: str
    address: str | None
    phone: str | None
    whatsapp: str | None
    email: str | None
    website: str | None
    contact_name: str | None
    hours: dict[str, Any]
    verification_status: BusinessVerificationStatus
    public_status: PublicBusinessStatus
    is_active: bool
    is_hidden: bool
    viewer_claim_status: BusinessClaimStatus | None = None
    viewer_membership_role: BusinessMembershipRole | None = None
    created_at: datetime
    updated_at: datetime


class BusinessListResponse(BaseModel):
    items: list[BusinessResponse]
    total: int
    skip: int
    limit: int


class BusinessClaimCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    relationship_role: str = Field(..., min_length=2, max_length=120)
    phone: str = Field(..., min_length=7, max_length=32)
    email: EmailStr
    supporting_info: str | None = Field(
        None,
        max_length=5000,
        validation_alias=AliasChoices("supporting_info", "supporting_information"),
    )
    supporting_documents: list[str] = Field(default_factory=list, max_length=20)

    @field_validator("full_name", "relationship_role", "phone", mode="before")
    @classmethod
    def strip_required(cls, value: str) -> str:
        return value.strip()

    @field_validator("supporting_documents")
    @classmethod
    def validate_documents(cls, values: list[str]) -> list[str]:
        if any(not value.strip() or len(value) > 1000 for value in values):
            raise ValueError("supporting document references must be non-empty and at most 1000 characters")
        return values


class BusinessClaimReview(BaseModel):
    review_notes: str | None = Field(None, max_length=5000)
    membership_role: BusinessMembershipRole = BusinessMembershipRole.OWNER


class BusinessClaimResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    business_id: int
    business_slug: str
    business_name: str
    business_verification_status: BusinessVerificationStatus
    public_status: PublicBusinessStatus
    claimant_id: int | None
    full_name: str
    relationship_role: str
    phone: str
    email: str
    supporting_info: str | None
    supporting_documents: list[str]
    status: BusinessClaimStatus
    submitted_at: datetime
    reviewed_at: datetime | None
    reviewer_id: int | None
    review_notes: str | None


class BusinessClaimListResponse(BaseModel):
    items: list[BusinessClaimResponse]
    total: int
    skip: int
    limit: int


class BusinessSearchResult(BaseModel):
    id: int
    slug: str
    name: str
    city: str
    area: str | None
    category: str
    verification_status: BusinessVerificationStatus
    public_status: PublicBusinessStatus
