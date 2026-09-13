from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Any, Dict
import json


def normalize_database_url(url: str) -> str:
    """Render/Heroku provide postgres://; SQLAlchemy async needs postgresql+asyncpg://."""
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


CANONICAL_PRODUCTION_FRONTEND_URL = "https://eljiran.io"


def parse_cors_origins(value: Any) -> List[str]:
    """Accept JSON list, comma-separated string, or already-parsed list."""
    if value is None:
        return ["http://localhost:3000"]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return ["http://localhost:3000"]
        if raw.startswith("["):
            parsed = json.loads(raw)
            return [str(item).strip() for item in parsed if str(item).strip()]
        return [part.strip() for part in raw.split(",") if part.strip()]
    return ["http://localhost:3000"]


def _is_unusable_public_origin(url: str) -> bool:
    lowered = (url or "").strip().lower()
    return (
        not lowered
        or "localhost" in lowered
        or "127.0.0.1" in lowered
        or "vercel.app" in lowered
    )


def production_frontend_url_issue(frontend_url: str) -> str | None:
    """Return a boot error when production FRONTEND_URL is not the public origin."""
    if not _is_unusable_public_origin(frontend_url):
        return None
    return (
        "FRONTEND_URL must be the canonical public origin "
        f"{CANONICAL_PRODUCTION_FRONTEND_URL} (not empty, localhost, or a "
        "Vercel preview host)."
    )


def resolve_public_frontend_url(
    environment: str,
    frontend_url: str,
) -> str:
    """Public origin for emails and invite links, derived only from FRONTEND_URL.

    Production never emits a Vercel preview host. CORS is not consulted.
    """
    url = (frontend_url or "").strip().rstrip("/")
    if (environment or "").strip().lower() == "production":
        if not _is_unusable_public_origin(url):
            return url
        return CANONICAL_PRODUCTION_FRONTEND_URL
    return url or "http://localhost:3000"


class Settings(BaseSettings):
    # Database
    # Default to localhost:5434 for local development (Docker Compose maps 5434->5432)
    # Override with DATABASE_URL env var for Docker or production
    DATABASE_URL: str = "postgresql+asyncpg://hoodna:hoodna123@localhost:5434/hoodna"
    
    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # CORS — store as string so Render env values don't need JSON encoding.
    # Use get_cors_origins() / cors_origin_list for the parsed list.
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"
    
    # AWS S3
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "eu-central-1"
    S3_BUCKET_NAME: str = "eljiran-uploads"
    S3_ENDPOINT_URL: str = ""  # For S3-compatible services like MinIO
    
    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""  # For frontend reference
    
    # AWS SES
    SES_FROM_EMAIL: str = "hello@eljiran.io"  # Must be verified in AWS SES
    SES_FROM_NAME: str = "Eljiran"
    SES_REGION: str = ""  # Defaults to AWS_REGION when empty

    # Optional transactional email (used when SES unavailable)
    RESEND_API_KEY: str = ""
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    
    # App
    ENVIRONMENT: str = "development"
    # Verbose SQL logging. Never enable in production (leaks bound parameters).
    SQL_ECHO: bool = False
    FRONTEND_URL: str = "http://localhost:3000"  # Canonical public web origin for emails and invites (https://eljiran.io in production)
    # Public backend URL for local-storage upload/file links (set to LAN IP for physical devices)
    BACKEND_URL: str = "http://localhost:8000"

    # Internal jobs
    CRON_SECRET: str = ""
    WEEKLY_DIGEST_MAX_POSTS: int = 5
    WEEKLY_DIGEST_MAX_BUSINESSES: int = 5
    WEEKLY_DIGEST_MAX_ANNOUNCEMENTS: int = 3
    WEEKLY_DIGEST_MAX_RECOMMENDATIONS: int = 5

    # Launch feature controls. Database values override these environment defaults.
    FEATURE_INVITATIONS_ENABLED: bool = True
    FEATURE_BUSINESS_CLAIMING_ENABLED: bool = True
    FEATURE_WEEKLY_DIGEST_ENABLED: bool = False
    FEATURE_COMMUNITY_POSTING_ENABLED: bool = True
    FEATURE_BUSINESS_REVIEWS_ENABLED: bool = True
    FEATURE_USER_REGISTRATION_ENABLED: bool = True
    FEATURE_FLAG_CACHE_TTL_SECONDS: int = 15
    FEATURE_ENABLED_CITIES: str = ""
    FEATURE_ENABLED_NEIGHBOURHOODS: str = ""

    # Optional vendor-neutral JSON forwarding. First-party storage remains authoritative.
    ANALYTICS_FORWARD_URL: str = ""
    CLIENT_ERROR_FORWARD_URL: str = ""
    TELEMETRY_FORWARD_TIMEOUT_SECONDS: float = 2.0
    TELEMETRY_ANONYMIZATION_SECRET: str = ""
    
    # OpenAI (for LLM verification)
    OPENAI_API_KEY: str = ""  # Set in .env for LLM-powered verification

    # Phone OTP. SMS_PROVIDER=smsto|twilio|whatsapp|none
    SMS_PROVIDER: str = "none"
    SMSTO_API_KEY: str = ""
    SMSTO_SENDER_ID: str = "Eljiran"  # Max 11 chars alphanumeric where allowed
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""  # E.164 sender, e.g. +1...
    WHATSAPP_TOKEN: str = ""  # Permanent Cloud API access token
    WHATSAPP_PHONE_NUMBER_ID: str = ""  # From Meta WhatsApp > API Setup
    WHATSAPP_OTP_TEMPLATE: str = "eljiran_auth_otp"  # Approved AUTHENTICATION template name
    WHATSAPP_OTP_TEMPLATE_LANG: str = "en_US"
    WHATSAPP_GRAPH_VERSION: str = "v21.0"
    OTP_MAX_PER_PHONE_PER_HOUR: int = 5
    OTP_MAX_PER_IP_PER_HOUR: int = 20

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url(cls, v: Any) -> Any:
        if isinstance(v, str):
            return normalize_database_url(v)
        return v

    @property
    def sms_provider(self) -> str:
        return (self.SMS_PROVIDER or "none").strip().lower()

    @property
    def smsto_configured(self) -> bool:
        return bool(self.sms_provider == "smsto" and self.SMSTO_API_KEY.strip())

    @property
    def twilio_configured(self) -> bool:
        return bool(
            self.sms_provider == "twilio"
            and self.TWILIO_ACCOUNT_SID.strip()
            and self.TWILIO_AUTH_TOKEN.strip()
            and self.TWILIO_FROM_NUMBER.strip()
        )

    @property
    def whatsapp_configured(self) -> bool:
        return bool(
            self.sms_provider == "whatsapp"
            and self.WHATSAPP_TOKEN.strip()
            and self.WHATSAPP_PHONE_NUMBER_ID.strip()
            and self.WHATSAPP_OTP_TEMPLATE.strip()
        )

    @property
    def otp_delivery_configured(self) -> bool:
        return (
            self.smsto_configured
            or self.twilio_configured
            or self.whatsapp_configured
        )

    @property
    def cors_origin_list(self) -> List[str]:
        return parse_cors_origins(self.CORS_ORIGINS)

    @property
    def ses_region(self) -> str:
        return (self.SES_REGION or self.AWS_REGION or "eu-central-1").strip()

    @property
    def effective_frontend_url(self) -> str:
        """Public web URL for links in emails and invites."""
        return resolve_public_frontend_url(
            self.ENVIRONMENT,
            self.FRONTEND_URL,
        )

    @property
    def feature_flag_defaults(self) -> Dict[str, bool]:
        return {
            "invitations": self.FEATURE_INVITATIONS_ENABLED,
            "business_claiming": self.FEATURE_BUSINESS_CLAIMING_ENABLED,
            "weekly_digest": self.FEATURE_WEEKLY_DIGEST_ENABLED,
            "community_posting": self.FEATURE_COMMUNITY_POSTING_ENABLED,
            "business_reviews": self.FEATURE_BUSINESS_REVIEWS_ENABLED,
            "user_registration": self.FEATURE_USER_REGISTRATION_ENABLED,
        }

    @property
    def feature_enabled_cities(self) -> set[str]:
        return {
            item.strip().casefold()
            for item in self.FEATURE_ENABLED_CITIES.split(",")
            if item.strip()
        }

    @property
    def feature_enabled_neighbourhoods(self) -> set[str]:
        return {
            item.strip().casefold()
            for item in self.FEATURE_ENABLED_NEIGHBOURHOODS.split(",")
            if item.strip()
        }
    
    @property
    def is_production(self) -> bool:
        return (self.ENVIRONMENT or "").strip().lower() == "production"

    class Config:
        env_file = [".env", "../.env"]  # Look in current dir and parent dir
        case_sensitive = True


settings = Settings()


INSECURE_SECRET_KEYS = {
    "your-secret-key-change-in-production",
    "change-me",
    "secret",
    "changeme",
}


def validate_production_settings(config: Settings) -> None:
    """Fail fast rather than boot production with development defaults.

    A forgeable SECRET_KEY means anyone can mint an admin JWT, so this must
    never degrade to a warning.
    """
    if not config.is_production:
        return

    errors: list[str] = []

    if config.SECRET_KEY.strip() in INSECURE_SECRET_KEYS or len(
        config.SECRET_KEY.strip()
    ) < 32:
        errors.append(
            "SECRET_KEY must be set to a unique value of at least 32 characters "
            "(generate with `openssl rand -hex 32`)."
        )

    if "localhost" in config.DATABASE_URL or "127.0.0.1" in config.DATABASE_URL:
        errors.append("DATABASE_URL still points at localhost.")

    insecure_origins = [
        origin
        for origin in config.cors_origin_list
        if origin == "*" or "localhost" in origin or "127.0.0.1" in origin
    ]
    if insecure_origins:
        errors.append(
            "CORS_ORIGINS must not include wildcards or localhost in production: "
            f"{insecure_origins}"
        )

    frontend_issue = production_frontend_url_issue(config.FRONTEND_URL)
    if frontend_issue:
        errors.append(frontend_issue)

    if errors:
        raise RuntimeError(
            "Refusing to start with an insecure production configuration:\n  - "
            + "\n  - ".join(errors)
        )


validate_production_settings(settings)
