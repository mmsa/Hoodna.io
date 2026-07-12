from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ReportModerationAction(str, Enum):
    HIDE = "HIDE"
    RESTORE = "RESTORE"
    SUSPEND = "SUSPEND"
    RESOLVE = "RESOLVE"
    DISMISS = "DISMISS"


class ReportModerationActionRequest(BaseModel):
    action: ReportModerationAction
    reason: str = Field(min_length=1, max_length=4000)
    notes: Optional[str] = Field(default=None, max_length=4000)

    @field_validator("action", mode="before")
    @classmethod
    def normalize_action(cls, value):
        return value.upper() if isinstance(value, str) else value


class ModerationActionResponse(BaseModel):
    id: int
    actor_id: Optional[int]
    report_id: Optional[int]
    action_type: str
    target_type: str
    target_id: Optional[int]
    reason: str
    details: dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogResponse(BaseModel):
    id: int
    actor_id: Optional[int]
    event_type: str
    entity_type: Optional[str]
    entity_id: Optional[str]
    request_id: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    data: dict[str, Any]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
    skip: int
    limit: int
