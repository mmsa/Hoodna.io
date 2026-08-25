from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from typing import Optional

from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.link_preview import fetch_link_preview

router = APIRouter()


class LinkPreviewResponse(BaseModel):
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    site_name: Optional[str] = None
    kind: str = "generic"


@router.get("/link-preview", response_model=LinkPreviewResponse)
async def get_link_preview(
    url: str = Query(..., min_length=8, max_length=2048),
    current_user: User = Depends(get_current_user),
):
    """Return Open Graph / fallback metadata for a shared URL in the feed."""
    try:
        data = await fetch_link_preview(url)
        return LinkPreviewResponse(**data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc
