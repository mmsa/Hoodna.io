from pydantic import BaseModel, EmailStr
from typing import Optional
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


class UserResponse(UserBase):
    id: int
    role: UserRole
    status: UserStatus
    compound_id: Optional[int] = None
    created_at: datetime
    # Verification status details (computed)
    verification_status: Optional[str] = None  # UNVERIFIED, PENDING, APPROVED, REJECTED
    can_post: Optional[bool] = None
    can_comment: Optional[bool] = None
    can_create_listing: Optional[bool] = None

    class Config:
        from_attributes = True

