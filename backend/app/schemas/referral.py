from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ReferralCreate(BaseModel):
    source: Literal["profile", "settings", "community", "other"] | None = None


class ReferralRedeem(BaseModel):
    code: str = Field(min_length=4, max_length=64)


class ReferralInviteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    inviter_id: int
    accepted_user_id: int | None = None
    status: Literal["PENDING", "REGISTERED", "EXPIRED", "REVOKED"]
    reward_status: Literal["NOT_APPLICABLE", "PENDING", "GRANTED"] | None = None
    created_at: datetime
    registered_at: datetime | None = None
    expires_at: datetime | None = None
    invite_url: str | None = None


class ReferralMeResponse(BaseModel):
    code: str
    invite_url: str
    invite: ReferralInviteResponse | None = None


class ReferralStatsResponse(BaseModel):
    invitations_sent: int
    successful_registrations: int


class ReferralRedeemResponse(BaseModel):
    redeemed: bool
    invite: ReferralInviteResponse
