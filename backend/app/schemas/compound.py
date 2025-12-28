from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from decimal import Decimal
from app.models.enums import CompoundStatus2025


class CompoundBase(BaseModel):
    compound_id: str
    name: str
    area: str
    sub_area: Optional[str] = None
    category: Optional[str] = None
    developer: Optional[str] = None
    status_2025: str  # CompoundStatus2025 enum value
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
    name: str
    city: str
    country: str = "Egypt"


class CompoundListResponse(BaseModel):
    items: list[CompoundResponse]
    total: int
    limit: int
    offset: int

