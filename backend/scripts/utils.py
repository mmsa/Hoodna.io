"""
Utility functions for seed scripts.
"""
import os
from app.core.config import settings


def get_db_url() -> str:
    """
    Get database URL, converting Docker postgres:5432 to localhost:5433 for local dev.
    """
    db_url = os.getenv("DATABASE_URL", settings.DATABASE_URL)
    if "postgres:5432" in db_url:
        db_url = db_url.replace("postgres:5432", "localhost:5433")
    return db_url

