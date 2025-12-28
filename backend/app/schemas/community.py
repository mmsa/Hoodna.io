from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class PostCreate(BaseModel):
    content: str


class PostResponse(BaseModel):
    id: int
    compound_id: int
    author_id: int
    author_name: str
    content: str
    created_at: datetime
    comments: List["CommentResponse"] = []

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: int
    post_id: int
    author_id: int
    author_name: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


PostResponse.model_rebuild()

