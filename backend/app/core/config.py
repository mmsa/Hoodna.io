from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Any


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
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    # AWS S3
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = "hoodna-uploads"
    S3_ENDPOINT_URL: str = ""  # For S3-compatible services like MinIO
    
    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""  # For frontend reference
    
    # AWS SES
    SES_FROM_EMAIL: str = "noreply@eljiran.com"  # Must be verified in AWS SES
    SES_FROM_NAME: str = "eljiran.com"
    
    # App
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"  # Frontend URL for email links
    
    # OpenAI (for LLM verification)
    OPENAI_API_KEY: str = ""  # Set in .env for LLM-powered verification

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def split_cors_origins(cls, v: Any) -> Any:
        if isinstance(v, str):
            # Accept comma-separated origins or JSON-like strings
            if v.strip().startswith("["):
                # Let pydantic parse JSON array strings
                return v
            return [o.strip() for o in v.split(",") if o.strip()]
        return v
    
    class Config:
        env_file = [".env", "../.env"]  # Look in current dir and parent dir
        case_sensitive = True


settings = Settings()
