import math
import re
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


AnalyticsEventName = Literal[
    "app_opened",
    "registration_started",
    "registration_completed",
    "onboarding_step_viewed",
    "onboarding_completed",
    "community_selected",
    "search_performed",
    "search_result_opened",
    "post_created",
    "comment_created",
    "business_profile_viewed",
    "business_claim_submitted",
    "invite_shared",
    "referral_registration_completed",
    "notification_opened",
    "report_submitted",
]

COMMON_KEYS = {"platform", "app_version", "source_screen"}
ANALYTICS_PROPERTY_ALLOWLIST: dict[str, set[str]] = {
    "app_opened": COMMON_KEYS,
    "registration_started": COMMON_KEYS | {"method", "referral_present"},
    "registration_completed": COMMON_KEYS | {"method", "role"},
    "onboarding_step_viewed": COMMON_KEYS | {"step", "step_number"},
    "onboarding_completed": COMMON_KEYS | {"steps_completed"},
    "community_selected": COMMON_KEYS | {"community_id"},
    "search_performed": COMMON_KEYS | {"category", "result_count"},
    "search_result_opened": COMMON_KEYS | {"entity_type", "entity_id", "position"},
    "post_created": COMMON_KEYS | {"post_id", "category", "community_id"},
    "comment_created": COMMON_KEYS | {"comment_id", "post_id"},
    "business_profile_viewed": COMMON_KEYS | {"business_id", "category"},
    "business_claim_submitted": COMMON_KEYS | {"business_id"},
    "invite_shared": COMMON_KEYS | {"channel"},
    "referral_registration_completed": COMMON_KEYS | {"inviter_id"},
    "notification_opened": COMMON_KEYS | {"notification_id", "notification_type"},
    "report_submitted": COMMON_KEYS | {"entity_type", "reason"},
}
SENSITIVE_KEY = re.compile(
    r"name|email|phone|address|message|content|description|text|query|password|token|contact",
    re.IGNORECASE,
)
SAFE_METADATA_STRING = re.compile(r"^[A-Za-z0-9_.:/-]{1,100}$")
PHONE_LIKE_VALUE = re.compile(r"^\+?[\d\s()-]{7,}$")
SAFE_IDENTIFIER = re.compile(r"^[A-Za-z0-9_.:-]{1,128}$")


class AnalyticsEventInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    event: AnalyticsEventName
    properties: dict[str, str | int | float | bool | None] = Field(default_factory=dict)
    occurred_at: datetime
    anonymous_id: str | None = Field(default=None, max_length=128)
    session_id: str | None = Field(default=None, max_length=128)

    @field_validator("anonymous_id", "session_id")
    @classmethod
    def validate_identifier(cls, value: str | None) -> str | None:
        if value is not None and (
            not SAFE_IDENTIFIER.fullmatch(value) or PHONE_LIKE_VALUE.fullmatch(value)
        ):
            raise ValueError("Telemetry identifiers must be opaque machine values")
        return value

    @model_validator(mode="after")
    def validate_safe_properties(self):
        allowed = ANALYTICS_PROPERTY_ALLOWLIST[self.event]
        for key, value in self.properties.items():
            if key not in allowed or SENSITIVE_KEY.search(key):
                raise ValueError(f'Unsafe analytics property "{key}"')
            if isinstance(value, str) and (
                not SAFE_METADATA_STRING.fullmatch(value)
                or PHONE_LIKE_VALUE.fullmatch(value)
            ):
                raise ValueError(f'Unsafe analytics property "{key}"')
            if isinstance(value, float) and not math.isfinite(value):
                raise ValueError(f'Unsafe analytics property "{key}"')
        return self


class AnalyticsBatchInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    events: list[AnalyticsEventInput] = Field(min_length=1, max_length=100)


class ClientErrorInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    error_code: str = Field(min_length=1, max_length=100)
    error_kind: Literal["api", "render", "unhandled_promise", "native", "unknown"]
    occurred_at: datetime
    platform: Literal["web", "ios", "android"]
    environment: str = Field(min_length=1, max_length=50)
    release: str | None = Field(default=None, max_length=100)
    route: str | None = Field(default=None, max_length=200)
    request_id: str | None = Field(default=None, max_length=128)
    status_code: int | None = Field(default=None, ge=100, le=599)
    stack_fingerprint: str | None = Field(default=None, max_length=128)
    anonymous_user_id: str | None = Field(default=None, max_length=128)

    @field_validator(
        "error_code",
        "environment",
        "release",
        "request_id",
        "stack_fingerprint",
        "anonymous_user_id",
    )
    @classmethod
    def validate_machine_string(cls, value: str | None) -> str | None:
        if value is not None and not SAFE_METADATA_STRING.fullmatch(value):
            raise ValueError("Only machine-readable metadata is accepted")
        return value


class ErrorStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["OPEN", "RESOLVED", "IGNORED"]


class TelemetryAccepted(BaseModel):
    accepted: int


class ClientErrorAccepted(BaseModel):
    id: int
    request_id: str
