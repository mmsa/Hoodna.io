from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.db.session import get_db
from app.schemas.service_category import ServiceCategoryResponse
from app.models.service_category import ServiceCategory

router = APIRouter()


@router.get("", response_model=List[ServiceCategoryResponse])
async def list_service_categories(
    db: AsyncSession = Depends(get_db),
):
    """Get all active service categories, ordered by display_order."""
    result = await db.execute(
        select(ServiceCategory)
        .where(ServiceCategory.is_active == True)
        .order_by(ServiceCategory.display_order, ServiceCategory.name)
    )
    categories = result.scalars().all()
    return categories

