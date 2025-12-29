from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ReportCreate(BaseModel):
    reported_type: str  # "post", "listing", "comment", "user"
    reported_id: int
    reason: str  # "spam", "inappropriate", "scam", "harassment", "fake", "other"
    description: Optional[str] = None


class ReportResponse(BaseModel):
    id: int
    reporter_id: int
    reporter_name: Optional[str] = None
    reported_type: str
    reported_id: int
    reason: str
    description: Optional[str]
    status: str
    reviewed_by_id: Optional[int] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReportUpdate(BaseModel):
    status: str  # "REVIEWED", "RESOLVED", "DISMISSED"
    review_notes: Optional[str] = None

