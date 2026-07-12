"""Internal job endpoints. This router is intentionally not mounted yet."""

import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.session import get_db
from app.services.weekly_digest import run_weekly_digest

router = APIRouter()


def require_cron_secret(
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
    authorization: str | None = Header(default=None),
) -> None:
    """Authenticate cron calls without secret-dependent timing."""
    supplied = x_cron_secret
    if supplied is None and authorization:
        scheme, separator, token = authorization.partition(" ")
        if separator and scheme.lower() == "bearer":
            supplied = token

    expected = settings.CRON_SECRET
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cron job authentication is not configured",
        )
    if supplied is None or not secrets.compare_digest(supplied, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid cron secret",
        )


@router.post("/jobs/weekly-digest")
async def weekly_digest_job(
    dry_run: bool = Query(False),
    _: None = Depends(require_cron_secret),
    db: AsyncSession = Depends(get_db),
):
    return await run_weekly_digest(db, dry_run=dry_run)
