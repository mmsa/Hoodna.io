from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ServiceCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None
    is_active: bool = True
    display_order: int = 0


class ServiceCategoryCreate(ServiceCategoryBase):
    pass


class ServiceCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None


class ServiceCategoryResponse(ServiceCategoryBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

