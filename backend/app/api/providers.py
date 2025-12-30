from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import logging
from app.db.session import get_db
from app.core.dependencies import get_current_user, get_current_approved_user
from app.models.user import User
from app.models.enums import UserRole

logger = logging.getLogger(__name__)
from app.schemas.provider import (
    ServiceProviderProfileCreate,
    ServiceProviderProfileUpdate,
    ServiceProviderProfileResponse,
    ServiceProviderDocumentCreate,
    ServiceProviderDocumentResponse,
    CategoryCompoundsChangeRequest
)
from app.crud.provider import (
    get_provider_profile,
    create_provider_profile,
    update_provider_profile,
    add_provider_document,
    submit_provider_profile,
    get_approved_providers,
    request_category_compounds_change
)
from app.models.service_provider import ServiceProviderDocument
from typing import List
from sqlalchemy import select

router = APIRouter()


@router.post("/onboarding/start", response_model=ServiceProviderProfileResponse, status_code=status.HTTP_201_CREATED)
async def start_provider_onboarding(
    profile_data: ServiceProviderProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start provider onboarding - creates draft profile and sets user role."""
    try:
        profile = await create_provider_profile(db, current_user.id, profile_data)
        # Load documents and category
        await db.refresh(profile, ["documents", "category"])
        return profile
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/me", response_model=ServiceProviderProfileResponse)
async def update_provider_profile_endpoint(
    profile_data: ServiceProviderProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update provider profile (allowed in DRAFT or APPROVED status)."""
    if not current_user.role or current_user.role != UserRole.SERVICE_PROVIDER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a service provider"
        )
    
    try:
        profile = await update_provider_profile(db, current_user.id, profile_data)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider profile not found"
            )
        await db.refresh(profile, ["documents", "category"])
        return profile
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/me/request-change", response_model=ServiceProviderProfileResponse)
async def request_category_compounds_change_endpoint(
    request_data: CategoryCompoundsChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Request a change to category or service area compounds.
    
    Providers cannot directly update category_id or service_area_compound_ids.
    They must request changes through this endpoint, which requires admin approval.
    """
    if not current_user.role or current_user.role != UserRole.SERVICE_PROVIDER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a service provider"
        )
    
    try:
        profile = await request_category_compounds_change(
            db,
            current_user.id,
            reason=request_data.reason,
            category_id=request_data.category_id,
            service_area_compound_ids=request_data.service_area_compound_ids,
        )
        await db.refresh(profile, ["documents", "category"])
        
        # Send notification to admins
        from app.services.notifications import create_notification
        from app.models.notification import NotificationType
        from app.schemas.notification import NotificationCreate
        from app.models.user import User as UserModel
        from sqlalchemy import select
        
        # Get all admins
        admins_result = await db.execute(
            select(UserModel).where(UserModel.role == UserRole.ADMIN)
        )
        admins = admins_result.scalars().all()
        
        for admin in admins:
            await create_notification(
                db=db,
                notification=NotificationCreate(
                    user_id=admin.id,
                    type=NotificationType.PROVIDER_CHANGE_REQUEST,
                    title="Provider Change Request",
                    message=f"Provider {profile.business_name} has requested changes to their category or service areas.",
                    data={"provider_id": profile.id, "user_id": profile.user_id}
                )
            )
        
        return profile
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/documents/upload-url")
async def get_provider_document_upload_url(
    document_type: str,
    file_name: str,
    file_type: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get presigned URL for uploading provider document."""
    from app.services.s3 import generate_presigned_put_url
    from app.schemas.verification import PresignResponse
    
    if not current_user.role or current_user.role != UserRole.SERVICE_PROVIDER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a service provider"
        )
    
    try:
        presigned_url, file_url = generate_presigned_put_url(
            file_name=file_name,
            file_type=file_type,
        )
        return PresignResponse(
            presigned_url=presigned_url,
            file_url=file_url
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate presigned URL: {str(e)}"
        )


@router.post("/documents", response_model=ServiceProviderDocumentResponse, status_code=status.HTTP_201_CREATED)
async def add_provider_document_endpoint(
    document_data: ServiceProviderDocumentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a document to provider profile."""
    if not current_user.role or current_user.role != UserRole.SERVICE_PROVIDER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a service provider"
        )
    
    try:
        document = await add_provider_document(
            db,
            current_user.id,
            document_data.document_type,
            document_data.file_url
        )
        return document
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/onboarding/submit", response_model=ServiceProviderProfileResponse)
async def submit_provider_onboarding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit provider profile for review."""
    if not current_user.role or current_user.role != UserRole.SERVICE_PROVIDER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a service provider"
        )
    
    try:
        profile = await submit_provider_profile(db, current_user.id)
        await db.refresh(profile, ["documents", "category"])
        return profile
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/me", response_model=ServiceProviderProfileResponse)
async def get_my_provider_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's provider profile."""
    logger.info(f"[ProviderAPI] GET /api/providers/me called by user {current_user.id}, role: {current_user.role}")
    
    if not current_user.role or current_user.role != UserRole.SERVICE_PROVIDER:
        logger.warning(f"[ProviderAPI] User {current_user.id} is not a SERVICE_PROVIDER (role: {current_user.role})")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a service provider"
        )
    
    profile = await get_provider_profile(db, current_user.id)
    if not profile:
        logger.warning(f"[ProviderAPI] Provider profile not found for user {current_user.id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found"
        )
    
    logger.info(f"[ProviderAPI] Provider profile found for user {current_user.id}: status={profile.provider_status}, id={profile.id}")
    await db.refresh(profile, ["documents", "category"])
    
    # Log the status value explicitly
    logger.info(f"[ProviderAPI] Returning profile with provider_status='{profile.provider_status}' (type: {type(profile.provider_status).__name__})")
    return profile


# Public endpoints
@router.get("", response_model=List[ServiceProviderProfileResponse])
async def list_providers(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Get all approved providers (public listing)."""
    profiles = await get_approved_providers(db, skip, limit)
    # Load documents and category for each profile
    for profile in profiles:
        await db.refresh(profile, ["documents", "category"])
    return profiles


@router.get("/{provider_id}", response_model=ServiceProviderProfileResponse)
async def get_provider(
    provider_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific approved provider."""
    from app.models.service_provider import ServiceProviderProfile
    from app.models.enums import ProviderStatus
    
    result = await db.execute(
        select(ServiceProviderProfile).where(
            ServiceProviderProfile.id == provider_id,
            ServiceProviderProfile.provider_status == ProviderStatus.APPROVED
        )
    )
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider not found or not approved"
        )
    
    await db.refresh(profile, ["documents", "category"])
    return profile

