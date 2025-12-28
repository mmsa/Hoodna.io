from enum import Enum


class UserRole(str, Enum):
    USER = "USER"
    ADMIN = "ADMIN"
    MODERATOR = "MODERATOR"


class UserStatus(str, Enum):
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    BANNED = "BANNED"


class DocumentType(str, Enum):
    NATIONAL_ID = "NATIONAL_ID"
    CONTRACT = "CONTRACT"


class DocumentStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    REQUEST_MORE_DETAILS = "REQUEST_MORE_DETAILS"


class ListingCategory(str, Enum):
    PROPERTY = "PROPERTY"
    CAR = "CAR"
    ITEM = "ITEM"
    SERVICE = "SERVICE"


class ListingIntent(str, Enum):
    SELL = "SELL"
    RENT = "RENT"


class ListingStatus(str, Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    SOLD = "SOLD"
    RENTED = "RENTED"
    ARCHIVED = "ARCHIVED"


class PromotionScope(str, Enum):
    COMPOUND_ONLY = "COMPOUND_ONLY"
    CROSS_COMPOUND = "CROSS_COMPOUND"
    PUBLIC = "PUBLIC"


class PromotionStatus(str, Enum):
    PENDING_PAYMENT = "PENDING_PAYMENT"
    ACTIVE = "ACTIVE"
    EXPIRED = "EXPIRED"


class CompoundStatus2025(str, Enum):
    READY_TO_MOVE = "Ready to Move"
    UNDER_CONSTRUCTION = "Under Construction"
    MIXED_PHASED = "Mixed/Phased"

