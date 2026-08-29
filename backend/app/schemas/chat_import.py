from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.models.enums import (
    ChatImportItemDecision,
    ChatImportItemKind,
    ChatImportJobStatus,
    ChatImportSource,
)


class ChatImportItemUpdate(BaseModel):
    id: int
    decision: Optional[ChatImportItemDecision] = None
    kind: Optional[ChatImportItemKind] = None
    normalized: Optional[dict[str, Any]] = None
    reject_reason: Optional[str] = None


class ChatImportItemsPatchRequest(BaseModel):
    items: list[ChatImportItemUpdate] = Field(default_factory=list)


class ChatImportItemResponse(BaseModel):
    id: int
    job_id: int
    kind: ChatImportItemKind
    decision: ChatImportItemDecision
    # Omit heavy raw_payload from default API responses (OOM risk on large imports)
    raw_payload: dict[str, Any] = Field(default_factory=dict)
    normalized: dict[str, Any] = Field(default_factory=dict)
    matched_user_id: Optional[int] = None
    published_entity_type: Optional[str] = None
    published_entity_id: Optional[int] = None
    reject_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ChatImportJobResponse(BaseModel):
    id: int
    compound_id: int
    uploaded_by_id: Optional[int] = None
    source: ChatImportSource
    status: ChatImportJobStatus
    original_filename: Optional[str] = None
    storage_path: Optional[str] = None
    stats: dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    # Always empty on job endpoints — use GET .../items for pages
    items: list[ChatImportItemResponse] = Field(default_factory=list)
    item_count: int = 0

    class Config:
        from_attributes = True


class ChatImportItemsPage(BaseModel):
    items: list[ChatImportItemResponse]
    total: int
    skip: int
    limit: int


class ChatImportJobListItem(BaseModel):
    id: int
    compound_id: int
    source: ChatImportSource
    status: ChatImportJobStatus
    original_filename: Optional[str] = None
    stats: dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ChatImportPublishResponse(BaseModel):
    job_id: int
    status: ChatImportJobStatus
    stats: dict[str, Any] = Field(default_factory=dict)


class CompoundInviteResponse(BaseModel):
    compound_id: int
    compound_name: str
    compound_area: Optional[str] = None
    verification_source: str
    created_at: Optional[datetime] = None


class CompoundInviteConfirmResponse(BaseModel):
    compound_id: int
    verification_status: str
    user_status: str
