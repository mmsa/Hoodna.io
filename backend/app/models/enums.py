from enum import Enum


class UserRole(str, Enum):
    USER = "USER"  # RESIDENT (legacy name)
    ADMIN = "ADMIN"
    MODERATOR = "MODERATOR"  # Legacy - use COMPOUND_MOD
    RESIDENT = "RESIDENT"  # Explicit resident role
    SERVICE_PROVIDER = "SERVICE_PROVIDER"
    COMPOUND_MOD = "COMPOUND_MOD"


class UserStatus(str, Enum):
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    BANNED = "BANNED"


class DocumentType(str, Enum):
    NATIONAL_ID = "NATIONAL_ID"
    CONTRACT = "CONTRACT"
    # Service Provider documents
    COMMERCIAL_REGISTER = "COMMERCIAL_REGISTER"
    TAX_CARD = "TAX_CARD"
    NATIONAL_ID_FRONT = "NATIONAL_ID_FRONT"
    NATIONAL_ID_BACK = "NATIONAL_ID_BACK"
    # Moderator documents
    AUTHORIZATION_LETTER = "AUTHORIZATION_LETTER"


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


class NotificationType(str, Enum):
    MESSAGE = "MESSAGE"
    COMMENT = "COMMENT"
    POST_LIKE = "POST_LIKE"
    VERIFICATION_APPROVED = "VERIFICATION_APPROVED"
    VERIFICATION_REJECTED = "VERIFICATION_REJECTED"
    VERIFICATION_REQUEST_MORE = "VERIFICATION_REQUEST_MORE"
    LISTING_INQUIRY = "LISTING_INQUIRY"
    LISTING_SAVED = "LISTING_SAVED"
    MENTION = "MENTION"


class PostCategory(str, Enum):
    """Post categories for better organization and structure."""
    GENERAL = "GENERAL"
    HELP = "HELP"  # Asking for help/assistance
    LOST_FOUND = "LOST_FOUND"  # Lost and found items
    EVENT = "EVENT"  # Community events
    MARKETPLACE = "MARKETPLACE"  # Buy/sell items
    ANNOUNCEMENT = "ANNOUNCEMENT"  # Official announcements
    ALERT = "ALERT"  # Urgent alerts
    DISCUSSION = "DISCUSSION"  # General discussions


class ProviderType(str, Enum):
    INDIVIDUAL = "INDIVIDUAL"
    REGISTERED_BUSINESS = "REGISTERED_BUSINESS"


class ProviderVerificationMethod(str, Enum):
    COMMERCIAL_REGISTER = "COMMERCIAL_REGISTER"
    NATIONAL_ID_OCCUPATION = "NATIONAL_ID_OCCUPATION"


class ProviderStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    IN_REVIEW = "IN_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SUSPENDED = "SUSPENDED"


class ModeratorStatus(str, Enum):
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    IN_REVIEW = "IN_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SUSPENDED = "SUSPENDED"

