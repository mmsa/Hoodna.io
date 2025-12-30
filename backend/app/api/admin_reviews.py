"""Admin review endpoints for providers and moderators."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.dependencies import get_current_admin
from app.models.user import User
from app.models.service_provider import ServiceProviderProfile
from app.models.compound_moderator import CompoundModeratorProfile
from app.models.enums import ProviderStatus, ModeratorStatus
from app.schemas.provider import ServiceProviderProfileResponse
from app.schemas.moderator import CompoundModeratorProfileResponse
from sqlalchemy import select
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter()


class ApproveRejectRequest(BaseModel):
    reason: Optional[str] = None


class SuspendRequest(BaseModel):
    reason: str


# Provider Review Endpoints
@router.get("/providers", response_model=List[ServiceProviderProfileResponse])
async def list_providers_for_review(
    status_filter: Optional[str] = Query(None, description="Filter by status: SUBMITTED, IN_REVIEW, APPROVED, REJECTED, SUSPENDED"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List providers for admin review."""
    query = select(ServiceProviderProfile)
    
    if status_filter:
        try:
            status_enum = ProviderStatus[status_filter.upper()]
            query = query.where(ServiceProviderProfile.provider_status == status_enum)
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}"
            )
    else:
        # Default to pending review
        query = query.where(
            ServiceProviderProfile.provider_status.in_([
                ProviderStatus.SUBMITTED,
                ProviderStatus.IN_REVIEW
            ])
        )
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    profiles = list(result.scalars().all())
    
    # Load documents
    for profile in profiles:
        await db.refresh(profile, ["documents", "user"])
    
    return profiles


@router.post("/providers/{provider_id}/approve", response_model=ServiceProviderProfileResponse)
async def approve_provider(
    provider_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve a provider."""
    profile = await db.get(ServiceProviderProfile, provider_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found"
        )
    
    if profile.provider_status != ProviderStatus.SUBMITTED and profile.provider_status != ProviderStatus.IN_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve provider in {profile.provider_status} status"
        )
    
    profile.provider_status = ProviderStatus.APPROVED
    profile.reviewed_at = datetime.utcnow()
    profile.reviewed_by = current_user.id
    
    await db.commit()
    await db.refresh(profile, ["documents", "user"])
    return profile


@router.post("/providers/{provider_id}/reject", response_model=ServiceProviderProfileResponse)
async def reject_provider(
    provider_id: int,
    request: ApproveRejectRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reject a provider."""
    if not request.reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rejection reason is required"
        )
    
    profile = await db.get(ServiceProviderProfile, provider_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found"
        )
    
    if profile.provider_status != ProviderStatus.SUBMITTED and profile.provider_status != ProviderStatus.IN_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject provider in {profile.provider_status} status"
        )
    
    profile.provider_status = ProviderStatus.REJECTED
    profile.reviewed_at = datetime.utcnow()
    profile.reviewed_by = current_user.id
    profile.rejection_reason = request.reason
    
    await db.commit()
    await db.refresh(profile, ["documents", "user"])
    return profile


@router.post("/providers/{provider_id}/suspend", response_model=ServiceProviderProfileResponse)
async def suspend_provider(
    provider_id: int,
    request: SuspendRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Suspend an approved provider."""
    profile = await db.get(ServiceProviderProfile, provider_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found"
        )
    
    if profile.provider_status != ProviderStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only suspend approved providers"
        )
    
    profile.provider_status = ProviderStatus.SUSPENDED
    profile.suspension_reason = request.reason
    
    await db.commit()
    await db.refresh(profile, ["documents", "user"])
    return profile


# Moderator Review Endpoints
@router.get("/moderators", response_model=List[CompoundModeratorProfileResponse])
async def list_moderators_for_review(
    status_filter: Optional[str] = Query(None, description="Filter by status: SUBMITTED, IN_REVIEW, APPROVED, REJECTED, SUSPENDED"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List moderators for admin review."""
    query = select(CompoundModeratorProfile)
    
    if status_filter:
        try:
            status_enum = ModeratorStatus[status_filter.upper()]
            query = query.where(CompoundModeratorProfile.moderator_status == status_enum)
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}"
            )
    else:
        # Default to pending review
        query = query.where(
            CompoundModeratorProfile.moderator_status.in_([
                ModeratorStatus.SUBMITTED,
                ModeratorStatus.IN_REVIEW
            ])
        )
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    profiles = list(result.scalars().all())
    
    # Load documents and compound
    for profile in profiles:
        await db.refresh(profile, ["documents", "user", "compound"])
        if profile.compound:
            profile.compound_name = profile.compound.name
    
    return profiles


@router.post("/moderators/{moderator_id}/approve", response_model=CompoundModeratorProfileResponse)
async def approve_moderator(
    moderator_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve a moderator."""
    profile = await db.get(CompoundModeratorProfile, moderator_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Moderator profile not found"
        )
    
    if profile.moderator_status != ModeratorStatus.SUBMITTED and profile.moderator_status != ModeratorStatus.IN_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve moderator in {profile.moderator_status} status"
        )
    
    profile.moderator_status = ModeratorStatus.APPROVED
    profile.reviewed_at = datetime.utcnow()
    profile.reviewed_by = current_user.id
    
    await db.commit()
    await db.refresh(profile, ["documents", "user", "compound"])
    if profile.compound:
        profile.compound_name = profile.compound.name
    return profile


@router.post("/moderators/{moderator_id}/reject", response_model=CompoundModeratorProfileResponse)
async def reject_moderator(
    moderator_id: int,
    request: ApproveRejectRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reject a moderator."""
    if not request.reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Rejection reason is required"
        )
    
    profile = await db.get(CompoundModeratorProfile, moderator_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Moderator profile not found"
        )
    
    if profile.moderator_status != ModeratorStatus.SUBMITTED and profile.moderator_status != ModeratorStatus.IN_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject moderator in {profile.moderator_status} status"
        )
    
    profile.moderator_status = ModeratorStatus.REJECTED
    profile.reviewed_at = datetime.utcnow()
    profile.reviewed_by = current_user.id
    profile.rejection_reason = request.reason
    
    await db.commit()
    await db.refresh(profile, ["documents", "user", "compound"])
    if profile.compound:
        profile.compound_name = profile.compound.name
    return profile


@router.post("/moderators/{moderator_id}/suspend", response_model=CompoundModeratorProfileResponse)
async def suspend_moderator(
    moderator_id: int,
    request: SuspendRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Suspend an approved moderator."""
    profile = await db.get(CompoundModeratorProfile, moderator_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Moderator profile not found"
        )
    
    if profile.moderator_status != ModeratorStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only suspend approved moderators"
        )
    
    profile.moderator_status = ModeratorStatus.SUSPENDED
    profile.suspension_reason = request.reason
    
    await db.commit()
    await db.refresh(profile, ["documents", "user", "compound"])
    if profile.compound:
        profile.compound_name = profile.compound.name
    return profile

