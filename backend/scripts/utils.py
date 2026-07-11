"""
Utility functions for seed scripts.
"""
import os
from app.core.config import normalize_database_url, settings


def get_db_url() -> str:
    """
    Get database URL for scripts.

    When DATABASE_URL is explicitly provided, normalize it for asyncpg.
    Otherwise, convert the app's default Docker hostname to the published
    localhost port for host-run local scripts.
    """
    env_db_url = os.getenv("DATABASE_URL")
    if env_db_url:
        return normalize_database_url(env_db_url)

    db_url = settings.DATABASE_URL
    if "postgres:5432" in db_url:
        return db_url.replace("postgres:5432", "localhost:5434")
    return db_url
