from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CompoundBase(BaseModel):
    name: str
    city: str
    country: str = "Egypt"
    is_public: bool = False


class CompoundCreate(CompoundBase):
    pass


class CompoundResponse(CompoundBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class CompoundRequest(BaseModel):
    name: str
    city: str
    country: str = "Egypt"

