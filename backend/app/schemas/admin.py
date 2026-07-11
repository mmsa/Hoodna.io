from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from app.models.enums import DocumentStatus, UserStatus, UserRole


class DocumentReviewRequest(BaseModel):
    notes: Optional[str] = None


class UserStatusUpdate(BaseModel):
    notes: Optional[str] = None


class AdminResetPasswordRequest(BaseModel):
    email: EmailStr
    new_password: str


class AdminUserListItem(BaseModel):
    id: int
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    status: UserStatus
    compound_id: Optional[int] = None
    compound_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AdminUserListResponse(BaseModel):
    items: List[AdminUserListItem]
    total: int
    skip: int
    limit: int

