from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.db.session import get_db
from app.schemas.compound import CompoundResponse, CompoundRequest, CompoundListResponse
from app.crud.compound import get_compounds, create_compound, get_compound_by_slug
from app.core.dependencies import get_current_approved_user
from app.models.user import User
from app.models.enums import CompoundStatus2025

router = APIRouter()


@router.get("", response_model=CompoundListResponse)
async def list_compounds(
    area: Optional[str] = Query(None, description="Filter by area"),
    q: Optional[str] = Query(None, description="Search in name or compound_id"),
    status: Optional[str] = Query(None, description="Filter by status_2025"),
    developer: Optional[str] = Query(None, description="Filter by developer"),
    category: Optional[str] = Query(None, description="Filter by category"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get compounds with optional filters.
    
    - **area**: Filter by area (case-insensitive partial match)
    - **q**: Search in compound name or compound_id (case-insensitive partial match)
    - **status**: Filter by status_2025 (must be one of: Ready to Move, Under Construction, Mixed/Phased)
    - **developer**: Filter by developer (case-insensitive partial match)
    - **category**: Filter by category (case-insensitive partial match)
    - **limit**: Maximum number of results (1-200, default 50)
    - **offset**: Offset for pagination (default 0)
    """
    # Validate status if provided
    if status:
        allowed_statuses = {s.value for s in CompoundStatus2025}
        if status not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(allowed_statuses)}"
            )
    
    compounds, total = await get_compounds(
        db,
        skip=offset,
        limit=limit,
        area=area,
        q=q,
        status=status,
        developer=developer,
        category=category,
    )
    
    return CompoundListResponse(
        items=compounds,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{compound_id}", response_model=CompoundResponse)
async def get_compound(
    compound_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a compound by compound_id slug."""
    compound = await get_compound_by_slug(db, compound_id)
    if not compound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Compound not found: {compound_id}"
        )
    return compound


@router.post("/request", response_model=CompoundResponse, status_code=status.HTTP_201_CREATED)
async def request_compound(
    compound_data: CompoundRequest,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db)
):
    """Request a new compound (creates compound and assigns user to it)."""
    # Create compound
    compound = await create_compound(db, compound_data)
    
    # Assign user to compound if not already assigned
    if not current_user.compound_id:
        current_user.compound_id = compound.id
        await db.flush()
    
    return compound

