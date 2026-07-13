from pydantic import BaseModel
from typing import Optional, List, Literal
from datetime import datetime
from app.models.enums import PostCategory


class PostCreate(BaseModel):
    content: str
    category: Optional[PostCategory] = PostCategory.GENERAL  # Category selection - defaults to GENERAL
    is_urgent: Optional[bool] = False  # Urgent flag for alerts


class PostResponse(BaseModel):
    id: int
    compound_id: int
    compound_name: Optional[str] = None  # Compound name for context
    author_id: int
    author_name: str
    author_avatar_url: Optional[str] = None
    author_status: Optional[str] = None  # User status (APPROVED, PENDING, etc.) - for verified badge
    content: str
    category: Optional[str] = None  # Post category (GENERAL, HELP, etc.)
    is_urgent: Optional[bool] = False  # Urgent flag for alerts
    created_at: datetime
    comments: List["CommentResponse"] = []
    reaction_counts: dict[str, int] = {}
    user_reaction: Optional[str] = None

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    content: str


class ReactionUpdate(BaseModel):
    reaction: Literal["LOVE", "LIKE", "WOW", "PRAY"]


class PostReactionsResponse(BaseModel):
    reaction_counts: dict[str, int]
    user_reaction: Optional[str] = None


class CommentResponse(BaseModel):
    id: int
    post_id: int
    author_id: int
    author_name: str
    author_avatar_url: Optional[str] = None
    author_status: Optional[str] = None  # User status (APPROVED, PENDING, etc.) - for verified badge
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


PostResponse.model_rebuild()

