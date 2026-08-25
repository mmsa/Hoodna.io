from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from app.models.enums import UserRole, UserStatus


class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    compound_id: Optional[int] = None
    role: Optional[UserRole] = None


class UserResponse(BaseModel):
    """Response schema — email is str so phone-auth @hoodna.local placeholders validate."""

    id: int
    name: str
    email: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role: Optional[UserRole] = None
    status: UserStatus
    compound_id: Optional[int] = None
    created_at: datetime
    # Verification status details (computed)
    verification_status: Optional[str] = None  # UNVERIFIED, PENDING, APPROVED, REJECTED
    can_post: Optional[bool] = None
    can_comment: Optional[bool] = None
    can_create_listing: Optional[bool] = None
    verified_compound_ids: Optional[List[int]] = None
    is_verified_for_current_compound: Optional[bool] = None
    needs_profile_setup: Optional[bool] = None

    class Config:
        from_attributes = True


class CompleteProfileRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=128)


class AvatarPresignRequest(BaseModel):
    file_name: str = Field(min_length=1, max_length=255)
    file_type: str = Field(min_length=1, max_length=100)


class AvatarUpdate(BaseModel):
    avatar_url: str = Field(min_length=1, max_length=512)

