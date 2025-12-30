from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.core.dependencies import get_current_user, get_current_approved_user
from app.models.user import User
from app.schemas.provider import (
    ServiceProviderProfileCreate,
    ServiceProviderProfileUpdate,
    ServiceProviderProfileResponse,
    ServiceProviderDocumentCreate,
    ServiceProviderDocumentResponse
)
from app.crud.provider import (
    get_provider_profile,
    create_provider_profile,
    update_provider_profile,
    add_provider_document,
    submit_provider_profile,
    get_approved_providers
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
        # Load documents
        await db.refresh(profile, ["documents"])
        return profile
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/me", response_model=ServiceProviderProfileResponse)
async def update_provider_profile_endpoint(
    profile_data: ServiceProviderProfileUpdate,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Update provider profile (only in DRAFT status)."""
    if current_user.role.value != "SERVICE_PROVIDER":
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
        await db.refresh(profile, ["documents"])
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
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Get presigned URL for uploading provider document."""
    from app.services.s3 import generate_presigned_put_url
    from app.schemas.verification import PresignResponse
    
    if current_user.role.value != "SERVICE_PROVIDER":
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
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a document to provider profile."""
    if current_user.role.value != "SERVICE_PROVIDER":
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
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit provider profile for review."""
    if current_user.role.value != "SERVICE_PROVIDER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a service provider"
        )
    
    try:
        profile = await submit_provider_profile(db, current_user.id)
        await db.refresh(profile, ["documents"])
        return profile
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/me", response_model=ServiceProviderProfileResponse)
async def get_my_provider_profile(
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's provider profile."""
    if current_user.role.value != "SERVICE_PROVIDER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a service provider"
        )
    
    profile = await get_provider_profile(db, current_user.id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Provider profile not found"
        )
    
    await db.refresh(profile, ["documents"])
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
    # Load documents for each profile
    for profile in profiles:
        await db.refresh(profile, ["documents"])
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
    
    await db.refresh(profile, ["documents"])
    return profile

