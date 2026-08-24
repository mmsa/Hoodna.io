from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ProfileVisibility(BaseModel):
    """Controls what neighbours see on a public profile. Name is always visible."""

    show_avatar: bool = True
    show_compound: bool = True
    show_joined_at: bool = True
    show_phone: bool = False
    show_email: bool = False


class UserPreferencesResponse(BaseModel):
    push_notifications: bool
    weekly_digest: bool
    community_announcements: bool
    business_recommendations: bool
    locale: Literal["en", "ar"] = "en"
    profile_visibility: ProfileVisibility = Field(default_factory=ProfileVisibility)
    updated_at: datetime | None = None


class UserPreferencesUpdate(BaseModel):
    push_notifications: bool | None = None
    weekly_digest: bool | None = None
    community_announcements: bool | None = None
    business_recommendations: bool | None = None
    locale: Literal["en", "ar"] | None = None
    profile_visibility: ProfileVisibility | None = None


class AccountDeletionRequestCreate(BaseModel):
    confirmation: Literal["DELETE"]
    reason: str | None = Field(default=None, max_length=1000)


class AccountDeletionRequestResponse(BaseModel):
    id: int
    status: Literal["PENDING", "PROCESSING", "COMPLETED", "CANCELLED"]
    requested_at: datetime
    completed_at: datetime | None = None


class PublicUserProfile(BaseModel):
    id: int
    name: str
    avatar_url: str | None = None
    compound_id: int | None = None
    compound_name: str | None = None
    joined_at: datetime | None = None
    phone: str | None = None
    email: str | None = None
    is_verified: bool = False
    role: str | None = None
    is_own_profile: bool = False
    visibility: ProfileVisibility
