from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from decimal import Decimal
from app.models.enums import CompoundStatus2025


class CompoundBase(BaseModel):
    compound_id: Optional[str] = None  # NULL for user-requested compounds, filled by admin
    name: str
    area: Optional[str] = None  # NULL for user-requested compounds, filled by admin
    sub_area: Optional[str] = None
    category: Optional[str] = None
    developer: Optional[str] = None
    status_2025: Optional[str] = None  # NULL for user-requested compounds, filled by admin
    delivery_notes: Optional[str] = None
    source_hint: Optional[str] = None
    last_verified_date: Optional[date] = None
    lat: Optional[Decimal] = None
    lng: Optional[Decimal] = None
    # Legacy fields
    city: Optional[str] = None
    country: str = "Egypt"
    is_public: bool = False


class CompoundCreate(CompoundBase):
    pass


class CompoundResponse(CompoundBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CompoundRequest(BaseModel):
    """User request for a new compound - minimal info only."""
    name: str
    city: str
    country: str = "Egypt"


class CompoundUpdate(BaseModel):
    """Admin update to complete compound details."""
    compound_id: Optional[str] = None
    name: Optional[str] = None
    area: Optional[str] = None
    sub_area: Optional[str] = None
    category: Optional[str] = None
    developer: Optional[str] = None
    status_2025: Optional[str] = None
    delivery_notes: Optional[str] = None
    source_hint: Optional[str] = None
    last_verified_date: Optional[date] = None
    lat: Optional[Decimal] = None
    lng: Optional[Decimal] = None
    city: Optional[str] = None
    is_public: Optional[bool] = None


class CompoundListResponse(BaseModel):
    items: list[CompoundResponse]
    total: int
    limit: int
    offset: int

