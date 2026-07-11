from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Any
import json


def normalize_database_url(url: str) -> str:
    """Render/Heroku provide postgres://; SQLAlchemy async needs postgresql+asyncpg://."""
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


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
    SES_FROM_EMAIL: str = "noreply@eljiran.com"  # Must be verified in AWS SES
    SES_FROM_NAME: str = "eljiran.com"
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
    FRONTEND_URL: str = "http://localhost:3000"  # Frontend URL for email links
    # Public backend URL for local-storage upload/file links (set to LAN IP for physical devices)
    BACKEND_URL: str = "http://localhost:8000"
    
    # OpenAI (for LLM verification)
    OPENAI_API_KEY: str = ""  # Set in .env for LLM-powered verification

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_database_url(cls, v: Any) -> Any:
        if isinstance(v, str):
            return normalize_database_url(v)
        return v

    @property
    def cors_origin_list(self) -> List[str]:
        return parse_cors_origins(self.CORS_ORIGINS)

    @property
    def ses_region(self) -> str:
        return (self.SES_REGION or self.AWS_REGION or "eu-central-1").strip()

    @property
    def effective_frontend_url(self) -> str:
        """Public web URL for links in emails (never localhost in production)."""
        url = (self.FRONTEND_URL or "").strip().rstrip("/")
        if self.ENVIRONMENT == "production" and (
            not url or url.startswith("http://localhost") or url.startswith("https://localhost")
        ):
            for origin in self.cors_origin_list:
                if origin.startswith("http") and "localhost" not in origin:
                    return origin.rstrip("/")
        return url or "http://localhost:3000"
    
    class Config:
        env_file = [".env", "../.env"]  # Look in current dir and parent dir
        case_sensitive = True


settings = Settings()
