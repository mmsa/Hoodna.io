from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime
from typing import Optional

from app.models.report import ReportReason, ReportStatus, ReportType


class ReportCreate(BaseModel):
    reported_type: ReportType
    reported_id: int = Field(gt=0)
    reason: ReportReason
    description: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("reported_type", "reason", mode="before")
    @classmethod
    def normalize_enums(cls, value):
        return value.upper() if isinstance(value, str) else value

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value):
        if value is None:
            return None
        value = value.strip()
        return value or None


class ReportReasonOnly(BaseModel):
    reason: ReportReason
    description: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("reason", mode="before")
    @classmethod
    def normalize_reason(cls, value):
        return value.upper() if isinstance(value, str) else value

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value):
        if value is None:
            return None
        value = value.strip()
        return value or None


class ReportResponse(BaseModel):
    id: int
    reporter_id: int
    reporter_name: Optional[str] = None
    reported_type: ReportType
    reported_id: int
    reason: ReportReason
    description: Optional[str]
    status: ReportStatus
    reviewed_by_id: Optional[int] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReportUpdate(BaseModel):
    status: ReportStatus
    review_notes: Optional[str] = Field(default=None, max_length=4000)

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, value):
        aliases = {"PENDING": "OPEN", "REVIEWED": "UNDER_REVIEW"}
        if isinstance(value, str):
            value = value.upper()
            return aliases.get(value, value)
        return value

