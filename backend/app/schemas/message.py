from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class MessageCreate(BaseModel):
    content: str
    recipient_id: int
    listing_id: Optional[int] = None


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender_name: str
    content: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    id: int
    user1_id: int
    user2_id: int
    listing_id: Optional[int] = None
    listing_title: Optional[str] = None
    other_user_id: int
    other_user_name: str
    other_user_email: Optional[str] = None
    last_message: Optional[MessageResponse] = None
    unread_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationDetailResponse(BaseModel):
    id: int
    user1_id: int
    user2_id: int
    listing_id: Optional[int] = None
    listing_title: Optional[str] = None
    other_user_id: int
    other_user_name: str
    other_user_email: Optional[str] = None
    messages: List[MessageResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

