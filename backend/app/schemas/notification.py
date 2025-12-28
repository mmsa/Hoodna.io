from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any
from app.models.enums import NotificationType


class NotificationBase(BaseModel):
    type: NotificationType
    title: str
    message: str
    related_id: Optional[int] = None
    related_type: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class NotificationCreate(NotificationBase):
    user_id: int


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    read: bool
    read_at: Optional[datetime]
    related_id: Optional[int]
    related_type: Optional[str]
    metadata: Optional[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    unread_count: int
    skip: int
    limit: int


class NotificationUpdate(BaseModel):
    read: Optional[bool] = None

