from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


FeatureFlagKey = Literal[
    "invitations",
    "business_claiming",
    "weekly_digest",
    "community_posting",
    "business_reviews",
    "user_registration",
]
FeatureFlagScopeValue = Literal["USER", "COMPOUND", "CITY"]


class FeatureFlagWrite(BaseModel):
    enabled: bool
    description: str | None = Field(default=None, max_length=500)
    config: dict[str, Any] = Field(default_factory=dict)


class FeatureFlagCreate(FeatureFlagWrite):
    key: FeatureFlagKey


class FeatureFlagResponse(FeatureFlagCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime


class FeatureFlagOverrideWrite(BaseModel):
    scope: FeatureFlagScopeValue
    enabled: bool
    user_id: int | None = Field(default=None, gt=0)
    compound_id: int | None = Field(default=None, gt=0)
    city: str | None = Field(default=None, min_length=1, max_length=120)
    config: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_scope_target(self):
        expected = {
            "USER": self.user_id,
            "COMPOUND": self.compound_id,
            "CITY": self.city,
        }
        if expected[self.scope] is None or sum(value is not None for value in expected.values()) != 1:
            raise ValueError("Exactly the target matching scope must be supplied")
        return self


class FeatureFlagOverrideResponse(FeatureFlagOverrideWrite):
    model_config = ConfigDict(from_attributes=True)

    id: int
    feature_flag_id: int
    target_key: str
    created_at: datetime
    updated_at: datetime


class FeatureConfigResponse(BaseModel):
    flags: dict[FeatureFlagKey, bool]
    city_enabled: bool
    neighbourhood_enabled: bool
    fetched_at: datetime
