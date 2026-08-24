from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Any, Optional, List, Union
from datetime import datetime
from decimal import Decimal
from enum import Enum
from app.models.enums import ListingCategory, ListingIntent, ListingStatus


class ItemCondition(str, Enum):
    NEW = "NEW"
    LIKE_NEW = "LIKE_NEW"
    USED = "USED"
    FAIR = "FAIR"


class CarTransmission(str, Enum):
    AUTOMATIC = "AUTOMATIC"
    MANUAL = "MANUAL"


class CarFuelType(str, Enum):
    PETROL = "PETROL"
    DIESEL = "DIESEL"
    ELECTRIC = "ELECTRIC"
    HYBRID = "HYBRID"


class PropertyType(str, Enum):
    APARTMENT = "APARTMENT"
    VILLA = "VILLA"
    TOWNHOUSE = "TOWNHOUSE"
    STUDIO = "STUDIO"
    DUPLEX = "DUPLEX"


class Furnishing(str, Enum):
    UNFURNISHED = "UNFURNISHED"
    SEMI_FURNISHED = "SEMI_FURNISHED"
    FURNISHED = "FURNISHED"


class ListingAttributes(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ItemAttributes(ListingAttributes):
    condition: ItemCondition


class CarAttributes(ListingAttributes):
    make: str = Field(min_length=1, max_length=100)
    model: str = Field(min_length=1, max_length=100)
    year: int
    mileage_km: int = Field(ge=0)
    transmission: CarTransmission
    fuel_type: CarFuelType

    @field_validator("year")
    @classmethod
    def validate_year(cls, value: int) -> int:
        max_year = datetime.now().year + 1
        if value < 1886 or value > max_year:
            raise ValueError(f"year must be between 1886 and {max_year}")
        return value


class PropertyAttributes(ListingAttributes):
    property_type: PropertyType
    bedrooms: int = Field(ge=0, le=100)
    bathrooms: int = Field(ge=0, le=100)
    area_sqm: float = Field(gt=0)
    furnishing: Furnishing


CategoryAttributes = Union[ItemAttributes, CarAttributes, PropertyAttributes]

# Provenance / import keys that are not part of category attribute schemas
_IMPORT_ATTRIBUTE_KEYS = frozenset(
    {"imported_from", "chat_import_job_id", "original_timestamp"}
)


def sanitize_listing_attributes(
    category: ListingCategory | str | None,
    attributes: Any,
) -> Optional[dict[str, Any]]:
    """
    Return attributes safe for API responses.

    Invalid / incomplete payloads (e.g. chat-import provenance) become None
    instead of raising ValidationError on ListingResponse.
    """
    if not attributes or not isinstance(attributes, dict):
        return None

    cleaned = {
        key: value
        for key, value in attributes.items()
        if key not in _IMPORT_ATTRIBUTE_KEYS
    }
    if not cleaned:
        return None

    category_value = (
        category.value if isinstance(category, ListingCategory) else str(category or "")
    ).upper()
    schema = {
        "ITEM": ItemAttributes,
        "CAR": CarAttributes,
        "PROPERTY": PropertyAttributes,
    }.get(category_value)
    if schema is None:
        return None

    try:
        return schema.model_validate(cleaned).model_dump(mode="json")
    except Exception:
        return None


def validate_attributes_for_category(
    category: ListingCategory,
    attributes: Optional[CategoryAttributes],
) -> None:
    expected_type = {
        ListingCategory.ITEM: ItemAttributes,
        ListingCategory.CAR: CarAttributes,
        ListingCategory.PROPERTY: PropertyAttributes,
    }.get(category)

    if category == ListingCategory.SERVICE:
        if attributes is not None:
            raise ValueError("SERVICE listings do not accept attributes")
        return

    if attributes is not None and not isinstance(attributes, expected_type):
        raise ValueError(f"attributes do not match {category.value} category")


class ListingCreate(BaseModel):
    category: ListingCategory
    title: str
    description: Optional[str] = None
    price: Optional[Decimal] = None
    currency: str = "EGP"
    intent: ListingIntent
    image_urls: List[str] = []
    attributes: Optional[CategoryAttributes] = None

    @model_validator(mode="after")
    def validate_category_details(self):
        allowed_intents = {
            ListingCategory.PROPERTY: {ListingIntent.SELL, ListingIntent.RENT},
            ListingCategory.CAR: {ListingIntent.SELL},
            ListingCategory.ITEM: {ListingIntent.SELL},
            ListingCategory.SERVICE: {ListingIntent.SELL, ListingIntent.RENT},
        }
        if self.intent not in allowed_intents[self.category]:
            raise ValueError(
                f"{self.category.value} listings do not support {self.intent.value} intent"
            )
        validate_attributes_for_category(self.category, self.attributes)
        return self


class ListingUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    status: Optional[ListingStatus] = None
    image_urls: Optional[List[str]] = None
    attributes: Optional[CategoryAttributes] = None


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
    # Loose on read so legacy/import rows never 500 the marketplace
    attributes: Optional[dict[str, Any]] = None
    status: ListingStatus
    created_at: datetime
    average_rating: Optional[float] = None  # Average rating from reviews
    review_count: int = 0  # Number of reviews

    model_config = ConfigDict(from_attributes=True)

    @field_validator("attributes", mode="before")
    @classmethod
    def coerce_attributes(cls, value: Any, info) -> Optional[dict[str, Any]]:
        category = None
        if info.data:
            category = info.data.get("category")
        return sanitize_listing_attributes(category, value)


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
