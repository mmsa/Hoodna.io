from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
from app.models.enums import UserStatus, UserRole


class DocumentReviewRequest(BaseModel):
    notes: Optional[str] = None


class UserStatusUpdate(BaseModel):
    notes: Optional[str] = None


class AdminResetPasswordRequest(BaseModel):
    # Phone-auth users use synthetic emails like phone_*@hoodna.local
    email: str
    new_password: str

    @field_validator("email")
    @classmethod
    def email_nonempty(cls, v: str) -> str:
        value = (v or "").strip()
        if not value or "@" not in value:
            raise ValueError("Invalid email")
        return value


class AdminUserListItem(BaseModel):
    id: int
    name: str
    # str: phone-auth placeholders (@hoodna.local) fail EmailStr reserved-TLD checks
    email: str
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
    is_verified: bool = False
    verification_status: str = "PENDING"
    created_at: datetime


class AdminUserCompoundsUpdate(BaseModel):
    compound_ids: List[int]
    primary_compound_id: Optional[int] = None
    approve_user: bool = False


class AdminUserDetailResponse(BaseModel):
    id: int
    name: str
    email: str
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

