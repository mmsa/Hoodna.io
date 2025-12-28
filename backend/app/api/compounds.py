from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.compound import CompoundResponse, CompoundRequest
from app.crud.compound import get_compounds, create_compound
from app.core.dependencies import get_current_user, get_current_approved_user
from app.models.user import User
from typing import List

router = APIRouter()


@router.get("", response_model=List[CompoundResponse])
async def list_compounds(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get all compounds."""
    compounds = await get_compounds(db, skip=skip, limit=limit)
    return compounds


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

