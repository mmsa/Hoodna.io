"""Admin review endpoints for providers and moderators."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.dependencies import get_current_admin
from app.models.user import User
from app.models.service_provider import ServiceProviderProfile, ServiceProviderDocument
from app.models.compound_moderator import CompoundModeratorProfile, CompoundModeratorDocument
from app.models.enums import ProviderStatus, ModeratorStatus
from app.schemas.provider import ServiceProviderProfileResponse
from app.schemas.moderator import CompoundModeratorProfileResponse
from app.services.llm_verification import verify_document_with_llm
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field
import logging

router = APIRouter()


class ApproveRejectRequest(BaseModel):
    reason: Optional[str] = None


class SuspendRequest(BaseModel):
    reason: str


class RequestMoreDetailsRequest(BaseModel):
    reason: str  # Required reason for requesting more details


class UpdateMaxListingsRequest(BaseModel):
    max_listings: int = Field(..., ge=1, le=100, description="Maximum number of service listings allowed (1-100)")


# Provider Review Endpoints
@router.get("/providers", response_model=List[ServiceProviderProfileResponse])
async def list_providers_for_review(
    status_filter: Optional[str] = Query(None, description="Filter by status: SUBMITTED, IN_REVIEW, APPROVED, REJECTED, SUSPENDED, REQUEST_MORE_DETAILS"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List providers for admin review."""
    query = select(ServiceProviderProfile)
    
    if status_filter:
        if status_filter.upper() == "REQUEST_MORE_DETAILS":
            # Filter by rejection_reason containing "More details requested"
            query = query.where(
                ServiceProviderProfile.rejection_reason.like("%More details requested%")
            )
        else:
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
    
    # Eagerly load relationships
    query = query.options(
        selectinload(ServiceProviderProfile.documents),
        selectinload(ServiceProviderProfile.user),
        selectinload(ServiceProviderProfile.category)
    )
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    profiles = list(result.scalars().all())
    
    # Add user_name to the response
    for profile in profiles:
        if profile.user:
            profile.user_name = profile.user.name
    
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
    # Refresh the object to get updated column values (like updated_at)
    await db.refresh(profile)
    # Then refresh relationships
    await db.refresh(profile, ["documents", "user", "category"])
    if profile.user:
        profile.user_name = profile.user.name
    # Access updated_at while still in async context to ensure it's loaded
    _ = profile.updated_at
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
    # Refresh the object to get updated column values (like updated_at)
    await db.refresh(profile)
    # Then refresh relationships
    await db.refresh(profile, ["documents", "user", "category"])
    if profile.user:
        profile.user_name = profile.user.name
    # Access updated_at while still in async context to ensure it's loaded
    _ = profile.updated_at
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
    # Refresh the object to get updated column values (like updated_at)
    await db.refresh(profile)
    # Then refresh relationships
    await db.refresh(profile, ["documents", "user", "category"])
    if profile.user:
        profile.user_name = profile.user.name
    # Access updated_at while still in async context to ensure it's loaded
    _ = profile.updated_at
    return profile


@router.patch("/providers/{provider_id}/max-listings", response_model=ServiceProviderProfileResponse)
async def update_provider_max_listings(
    provider_id: int,
    request: UpdateMaxListingsRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update the maximum number of listings allowed for a provider."""
    profile = await db.get(ServiceProviderProfile, provider_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found"
        )
    
    profile.max_listings = request.max_listings
    await db.commit()
    await db.refresh(profile, ["documents", "user", "category"])
    if profile.user:
        profile.user_name = profile.user.name
    return profile


@router.post("/providers/{provider_id}/change-request/approve", response_model=ServiceProviderProfileResponse)
async def approve_provider_change_request(
    provider_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve a provider's change request for category or compounds."""
    profile = await db.get(ServiceProviderProfile, provider_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found"
        )
    
    if profile.change_request_status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No pending change request found (status: {profile.change_request_status})"
        )
    
    # Apply the changes
    if profile.category_change_request is not None:
        profile.category_id = profile.category_change_request
    if profile.compounds_change_request is not None:
        profile.service_area_compound_ids = profile.compounds_change_request
    
    # Update change request status
    profile.change_request_status = "APPROVED"
    profile.change_request_reviewed_at = datetime.utcnow()
    profile.change_request_reviewed_by = current_user.id
    
    # Clear the request fields
    profile.category_change_request = None
    profile.compounds_change_request = None
    
    await db.commit()
    await db.refresh(profile, ["documents", "user", "category"])
    if profile.user:
        profile.user_name = profile.user.name
    _ = profile.updated_at
    
    # Send notification to provider
    from app.services.notifications import create_notification
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=profile.user_id,
            type=NotificationType.VERIFICATION_APPROVED,
            title="Change Request Approved",
            message="Your request to change category or service areas has been approved.",
            data={"provider_id": profile.id}
        )
    )
    
    return profile


@router.post("/providers/{provider_id}/change-request/reject", response_model=ServiceProviderProfileResponse)
async def reject_provider_change_request(
    provider_id: int,
    request: RequestMoreDetailsRequest,  # Reuse this schema for rejection reason
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reject a provider's change request for category or compounds."""
    profile = await db.get(ServiceProviderProfile, provider_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found"
        )
    
    if profile.change_request_status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No pending change request found (status: {profile.change_request_status})"
        )
    
    # Update change request status
    profile.change_request_status = "REJECTED"
    profile.change_request_reviewed_at = datetime.utcnow()
    profile.change_request_reviewed_by = current_user.id
    profile.change_request_reason = f"{profile.change_request_reason}\n\nRejection reason: {request.reason}"
    
    # Clear the request fields
    profile.category_change_request = None
    profile.compounds_change_request = None
    
    await db.commit()
    await db.refresh(profile, ["documents", "user", "category"])
    if profile.user:
        profile.user_name = profile.user.name
    _ = profile.updated_at
    
    # Send notification to provider
    from app.services.notifications import create_notification
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=profile.user_id,
            type=NotificationType.VERIFICATION_REJECTED,
            title="Change Request Rejected",
            message=f"Your request to change category or service areas has been rejected. Reason: {request.reason}",
            data={"provider_id": profile.id}
        )
    )
    
    return profile


@router.post("/providers/{provider_id}/request-more-details", response_model=ServiceProviderProfileResponse)
async def request_more_details_provider(
    provider_id: int,
    request: RequestMoreDetailsRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Request more details from a provider."""
    profile = await db.get(ServiceProviderProfile, provider_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found"
        )
    
    if profile.provider_status != ProviderStatus.SUBMITTED and profile.provider_status != ProviderStatus.IN_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot request more details for provider in {profile.provider_status} status"
        )
    
    # Change status to IN_REVIEW and store the request reason
    profile.provider_status = ProviderStatus.IN_REVIEW
    profile.reviewed_at = datetime.utcnow()
    profile.reviewed_by = current_user.id
    profile.rejection_reason = f"More details requested: {request.reason}"
    
    await db.commit()
    # Refresh the object to get updated column values (like updated_at)
    await db.refresh(profile)
    # Then refresh relationships
    await db.refresh(profile, ["documents", "user", "category"])
    if profile.user:
        profile.user_name = profile.user.name
    # Access updated_at while still in async context to ensure it's loaded
    _ = profile.updated_at
    
    # Send notification to user
    from app.services.notifications import create_notification
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=profile.user_id,
            type=NotificationType.VERIFICATION_REQUEST_MORE,
            title="More Information Needed",
            message=f"We need more information to verify your service provider account. {request.reason}",
            related_id=profile.id,
            related_type="service_provider",
            extra_data={"reason": request.reason, "profile_id": profile.id},
        ),
    )
    await db.commit()
    
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
        if status_filter.upper() == "REQUEST_MORE_DETAILS":
            # Filter by rejection_reason containing "More details requested"
            query = query.where(
                CompoundModeratorProfile.rejection_reason.like("%More details requested%")
            )
        else:
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
    
    # Load documents, user, and compound
    for profile in profiles:
        await db.refresh(profile, ["documents", "user", "compound"])
        if profile.compound:
            profile.compound_name = profile.compound.name
        # Add user_name to the response
        if profile.user:
            profile.user_name = profile.user.name
    
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
    # Refresh the object to get updated column values (like updated_at)
    await db.refresh(profile)
    # Then refresh relationships
    await db.refresh(profile, ["documents", "user", "compound"])
    if profile.compound:
        profile.compound_name = profile.compound.name
    if profile.user:
        profile.user_name = profile.user.name
    # Access updated_at while still in async context to ensure it's loaded
    _ = profile.updated_at
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
    # Refresh the object to get updated column values (like updated_at)
    await db.refresh(profile)
    # Then refresh relationships
    await db.refresh(profile, ["documents", "user", "compound"])
    if profile.compound:
        profile.compound_name = profile.compound.name
    if profile.user:
        profile.user_name = profile.user.name
    # Access updated_at while still in async context to ensure it's loaded
    _ = profile.updated_at
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
    # Refresh the object to get updated column values (like updated_at)
    await db.refresh(profile)
    # Then refresh relationships
    await db.refresh(profile, ["documents", "user", "compound"])
    if profile.compound:
        profile.compound_name = profile.compound.name
    if profile.user:
        profile.user_name = profile.user.name
    # Access updated_at while still in async context to ensure it's loaded
    _ = profile.updated_at
    return profile


@router.post("/moderators/{moderator_id}/request-more-details", response_model=CompoundModeratorProfileResponse)
async def request_more_details_moderator(
    moderator_id: int,
    request: RequestMoreDetailsRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Request more details from a moderator."""
    profile = await db.get(CompoundModeratorProfile, moderator_id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Moderator profile not found"
        )
    
    if profile.moderator_status != ModeratorStatus.SUBMITTED and profile.moderator_status != ModeratorStatus.IN_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot request more details for moderator in {profile.moderator_status} status"
        )
    
    # Change status to IN_REVIEW and store the request reason
    profile.moderator_status = ModeratorStatus.IN_REVIEW
    profile.reviewed_at = datetime.utcnow()
    profile.reviewed_by = current_user.id
    profile.rejection_reason = f"More details requested: {request.reason}"
    
    await db.commit()
    # Refresh the object to get updated column values (like updated_at)
    await db.refresh(profile)
    # Then refresh relationships
    await db.refresh(profile, ["documents", "user", "compound"])
    if profile.compound:
        profile.compound_name = profile.compound.name
    if profile.user:
        profile.user_name = profile.user.name
    # Access updated_at while still in async context to ensure it's loaded
    _ = profile.updated_at
    
    # Send notification to user
    from app.services.notifications import create_notification
    from app.models.notification import NotificationType
    from app.schemas.notification import NotificationCreate
    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=profile.user_id,
            type=NotificationType.VERIFICATION_REQUEST_MORE,
            title="More Information Needed",
            message=f"We need more information to verify your moderator account. {request.reason}",
            related_id=profile.id,
            related_type="moderator",
            extra_data={"reason": request.reason, "profile_id": profile.id},
        ),
    )
    await db.commit()
    
    return profile


# AI Verification Endpoints for Provider Documents
@router.post("/providers/{provider_id}/documents/{document_id}/verify-with-llm")
async def verify_provider_document_with_llm(
    provider_id: int,
    document_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Trigger LLM verification for a provider document."""
    logger = logging.getLogger(__name__)
    
    try:
        profile = await db.get(ServiceProviderProfile, provider_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider profile not found"
            )
        
        doc = await db.get(ServiceProviderDocument, document_id)
        if not doc or doc.profile_id != provider_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        user = await db.get(User, profile.user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get compound name if provider serves compounds
        compound_name = None
        if profile.service_area_compound_ids:
            from app.models.compound import Compound
            # Use first compound for context
            compound = await db.get(Compound, profile.service_area_compound_ids[0])
            if compound:
                compound_name = compound.name
        
        logger.info(f"Starting LLM verification for provider document {document_id}, type: {doc.document_type}, file_url: {doc.file_url}")
        
        # Run LLM verification
        try:
            llm_result = await verify_document_with_llm(
                file_url=doc.file_url,
                document_type=doc.document_type,
                user_name=user.name,
                user_email=user.email,
                compound_name=compound_name,
                user_type="service_provider",
            )
            logger.info(f"LLM verification completed for provider document {document_id}. Result: verified={llm_result.get('verified')}, confidence={llm_result.get('confidence')}")
        except Exception as llm_error:
            logger.error(f"LLM verification failed for provider document {document_id}: {str(llm_error)}", exc_info=True)
            llm_result = {
                "verified": False,
                "confidence": 0.0,
                "issues": [f"LLM verification error: {str(llm_error)}"],
                "recommendation": "REQUEST_MORE_DETAILS",
                "reasoning": f"Failed to verify document: {str(llm_error)}",
                "extracted_info": {},
            }
        
        # Save LLM results to document
        doc.llm_verified = 1 if llm_result.get('verified') else 0
        doc.llm_confidence = llm_result.get('confidence', 0.0)
        doc.llm_recommendation = llm_result.get('recommendation', 'REQUEST_MORE_DETAILS')
        doc.llm_reasoning = llm_result.get('reasoning')
        doc.llm_issues = llm_result.get('issues', [])
        doc.llm_extracted_info = llm_result.get('extracted_info', {})
        doc.llm_verified_at = datetime.utcnow()
        
        await db.flush()
        
        # Auto-approve if confidence >= 90% and recommendation is APPROVE
        auto_approved = False
        if (llm_result.get('confidence', 0.0) >= 0.9 and 
            llm_result.get('recommendation') == 'APPROVE' and
            profile.provider_status in [ProviderStatus.SUBMITTED, ProviderStatus.IN_REVIEW]):
            profile.provider_status = ProviderStatus.APPROVED
            profile.reviewed_at = datetime.utcnow()
            profile.reviewed_by = current_user.id
            auto_approved = True
            logger.info(f"Auto-approved provider {provider_id} based on high confidence LLM verification")
        
        await db.commit()
        
        # Refresh to get updated values
        await db.refresh(profile)
        await db.refresh(doc)
        
        return {
            "document_id": doc.id,
            "document_type": doc.document_type,
            "file_url": doc.file_url,
            "llm_result": llm_result,
            "auto_approved": auto_approved,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in LLM verification for provider document {document_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify document with LLM: {str(e)}"
        )


# AI Verification Endpoints for Moderator Documents
@router.post("/moderators/{moderator_id}/documents/{document_id}/verify-with-llm")
async def verify_moderator_document_with_llm(
    moderator_id: int,
    document_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Trigger LLM verification for a moderator document."""
    logger = logging.getLogger(__name__)
    
    try:
        profile = await db.get(CompoundModeratorProfile, moderator_id)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Moderator profile not found"
            )
        
        doc = await db.get(CompoundModeratorDocument, document_id)
        if not doc or doc.profile_id != moderator_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found"
            )
        
        user = await db.get(User, profile.user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Get compound name
        compound_name = None
        if profile.compound_id:
            from app.models.compound import Compound
            compound = await db.get(Compound, profile.compound_id)
            if compound:
                compound_name = compound.name
        
        logger.info(f"Starting LLM verification for moderator document {document_id}, type: {doc.document_type}, file_url: {doc.file_url}")
        
        # Run LLM verification
        try:
            llm_result = await verify_document_with_llm(
                file_url=doc.file_url,
                document_type=doc.document_type,
                user_name=user.name,
                user_email=user.email,
                compound_name=compound_name,
                user_type="moderator",
            )
            logger.info(f"LLM verification completed for moderator document {document_id}. Result: verified={llm_result.get('verified')}, confidence={llm_result.get('confidence')}")
        except Exception as llm_error:
            logger.error(f"LLM verification failed for moderator document {document_id}: {str(llm_error)}", exc_info=True)
            llm_result = {
                "verified": False,
                "confidence": 0.0,
                "issues": [f"LLM verification error: {str(llm_error)}"],
                "recommendation": "REQUEST_MORE_DETAILS",
                "reasoning": f"Failed to verify document: {str(llm_error)}",
                "extracted_info": {},
            }
        
        # Save LLM results to document
        doc.llm_verified = 1 if llm_result.get('verified') else 0
        doc.llm_confidence = llm_result.get('confidence', 0.0)
        doc.llm_recommendation = llm_result.get('recommendation', 'REQUEST_MORE_DETAILS')
        doc.llm_reasoning = llm_result.get('reasoning')
        doc.llm_issues = llm_result.get('issues', [])
        doc.llm_extracted_info = llm_result.get('extracted_info', {})
        doc.llm_verified_at = datetime.utcnow()
        
        await db.flush()
        
        # Auto-approve if confidence >= 90% and recommendation is APPROVE
        auto_approved = False
        if (llm_result.get('confidence', 0.0) >= 0.9 and 
            llm_result.get('recommendation') == 'APPROVE' and
            profile.moderator_status in [ModeratorStatus.SUBMITTED, ModeratorStatus.IN_REVIEW]):
            profile.moderator_status = ModeratorStatus.APPROVED
            profile.reviewed_at = datetime.utcnow()
            profile.reviewed_by = current_user.id
            auto_approved = True
            logger.info(f"Auto-approved moderator {moderator_id} based on high confidence LLM verification")
        
        await db.commit()
        
        # Refresh to get updated values
        await db.refresh(profile)
        await db.refresh(doc)
        
        return {
            "document_id": doc.id,
            "document_type": doc.document_type,
            "file_url": doc.file_url,
            "llm_result": llm_result,
            "auto_approved": auto_approved,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in LLM verification for moderator document {document_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify document with LLM: {str(e)}"
        )

