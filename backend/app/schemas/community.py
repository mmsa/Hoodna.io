from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime
from app.models.enums import PostCategory


class PollOptionCreate(BaseModel):
    id: Optional[int] = None
    label: str = Field(..., min_length=1, max_length=200)


class PollCreate(BaseModel):
    question: Optional[str] = Field(None, max_length=500)
    options: List[PollOptionCreate] = Field(..., min_length=2, max_length=4)


class PollOptionResult(BaseModel):
    id: int
    label: str
    votes: int = 0


class PollResult(BaseModel):
    question: Optional[str] = None
    options: List[PollOptionResult] = []
    total_votes: int = 0
    user_vote: Optional[int] = None


class PollVoteRequest(BaseModel):
    option_id: int = Field(..., ge=1)


class PostCreate(BaseModel):
    content: str
    category: Optional[PostCategory] = PostCategory.GENERAL
    is_urgent: Optional[bool] = False
    poll: Optional[PollCreate] = None


class PostResponse(BaseModel):
    id: int
    compound_id: int
    compound_name: Optional[str] = None
    author_id: int
    author_name: str
    author_avatar_url: Optional[str] = None
    author_status: Optional[str] = None
    content: str
    category: Optional[str] = None
    is_urgent: Optional[bool] = False
    poll: Optional[PollResult] = None
    created_at: datetime
    comments: List["CommentResponse"] = []
    reaction_counts: dict[str, int] = {}
    user_reaction: Optional[str] = None
    is_saved: Optional[bool] = None

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
    author_status: Optional[str] = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class AskRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)


class AskCitation(BaseModel):
    type: Literal["post", "listing", "business"]
    id: int
    title: str
    url_path: str
    snippet: Optional[str] = None


class AskResponse(BaseModel):
    answer: str
    citations: List[AskCitation] = []
    used_llm: bool = False


PostResponse.model_rebuild()
