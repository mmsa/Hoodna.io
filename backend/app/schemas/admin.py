from pydantic import BaseModel
from typing import Optional
from app.models.enums import DocumentStatus, UserStatus


class DocumentReviewRequest(BaseModel):
    notes: Optional[str] = None


class UserStatusUpdate(BaseModel):
    notes: Optional[str] = None

