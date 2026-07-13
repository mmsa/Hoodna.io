from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class UserPreferencesResponse(BaseModel):
    push_notifications: bool
    weekly_digest: bool
    community_announcements: bool
    business_recommendations: bool
    locale: Literal["en", "ar"] = "en"
    updated_at: datetime | None = None


class UserPreferencesUpdate(BaseModel):
    push_notifications: bool | None = None
    weekly_digest: bool | None = None
    community_announcements: bool | None = None
    business_recommendations: bool | None = None
    locale: Literal["en", "ar"] | None = None


class AccountDeletionRequestCreate(BaseModel):
    confirmation: Literal["DELETE"]
    reason: str | None = Field(default=None, max_length=1000)


class AccountDeletionRequestResponse(BaseModel):
    id: int
    status: Literal["PENDING", "PROCESSING", "COMPLETED", "CANCELLED"]
    requested_at: datetime
    completed_at: datetime | None = None
