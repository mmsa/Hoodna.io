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


class AdminUserActivityStats(BaseModel):
    posts: int = 0
    comments: int = 0
    listings: int = 0
    saved_listings: int = 0
    saved_posts: int = 0
    messages_sent: int = 0
    notifications: int = 0
    reviews: int = 0
    reports_filed: int = 0
    conversations: int = 0


class AdminCompoundMembershipItem(BaseModel):
    compound_id: int
    compound_name: Optional[str] = None
    compound_area: Optional[str] = None
    created_at: datetime


class AdminUserDetailResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    status: UserStatus
    compound_id: Optional[int] = None
    compound_name: Optional[str] = None
    compound_area: Optional[str] = None
    created_at: datetime
    verification_status: Optional[str] = None
    can_post: Optional[bool] = None
    can_comment: Optional[bool] = None
    can_create_listing: Optional[bool] = None
    verification_documents: List[dict] = []
    compound_memberships: List[AdminCompoundMembershipItem] = []
    provider_profile: Optional[dict] = None
    moderator_profile: Optional[dict] = None
    activity: AdminUserActivityStats

