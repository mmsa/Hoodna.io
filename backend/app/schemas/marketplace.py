from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from app.models.enums import ListingCategory, ListingIntent, ListingStatus


class ListingCreate(BaseModel):
    category: ListingCategory
    title: str
    description: Optional[str] = None
    price: Optional[Decimal] = None
    currency: str = "EGP"
    intent: ListingIntent
    image_urls: List[str] = []


class ListingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    status: Optional[ListingStatus] = None
    image_urls: Optional[List[str]] = None


class ListingResponse(BaseModel):
    id: int
    compound_id: int
    compound_name: str
    owner_id: int
    owner_name: str
    owner_email: Optional[str] = None  # Only included if current user is viewing
    owner_phone: Optional[str] = None  # Only included if current user is viewing
    category: ListingCategory
    title: str
    description: Optional[str] = None
    price: Optional[Decimal] = None
    currency: str
    intent: ListingIntent
    image_urls: List[str]
    status: ListingStatus
    created_at: datetime

    class Config:
        from_attributes = True


class PromotionCheckout(BaseModel):
    listing_id: int
    scope: str  # CROSS_COMPOUND or PUBLIC
    duration_days: int = 7


class PromotionResponse(BaseModel):
    id: int
    listing_id: int
    scope: str
    starts_at: datetime
    ends_at: datetime
    status: str
    amount: Decimal
    currency: str

    class Config:
        from_attributes = True


class CheckoutSessionResponse(BaseModel):
    session_id: str
    url: str

