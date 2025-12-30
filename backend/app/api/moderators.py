from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.dependencies import get_current_user, get_current_approved_user
from app.models.user import User
from app.schemas.moderator import (
    CompoundModeratorProfileCreate,
    CompoundModeratorProfileUpdate,
    CompoundModeratorProfileResponse,
    CompoundModeratorDocumentCreate,
    CompoundModeratorDocumentResponse
)
from app.crud.moderator import (
    get_moderator_profile,
    create_moderator_profile,
    update_moderator_profile,
    add_moderator_document,
    submit_moderator_profile
)
from app.models.compound_moderator import CompoundModeratorDocument
from typing import List

router = APIRouter()


@router.post("/onboarding/start", response_model=CompoundModeratorProfileResponse, status_code=status.HTTP_201_CREATED)
async def start_moderator_onboarding(
    profile_data: CompoundModeratorProfileCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start moderator onboarding - creates draft profile and sets user role."""
    try:
        profile = await create_moderator_profile(db, current_user.id, profile_data)
        # Load compound name
        await db.refresh(profile, ["compound", "documents"])
        if profile.compound:
            profile.compound_name = profile.compound.name
        return profile
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.patch("/me", response_model=CompoundModeratorProfileResponse)
async def update_moderator_profile_endpoint(
    profile_data: CompoundModeratorProfileUpdate,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Update moderator profile (only in DRAFT status)."""
    if current_user.role and current_user.role.value != "COMPOUND_MOD":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a compound moderator"
        )
    
    try:
        profile = await update_moderator_profile(db, current_user.id, profile_data)
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Moderator profile not found"
            )
        await db.refresh(profile, ["compound", "documents"])
        if profile.compound:
            profile.compound_name = profile.compound.name
        return profile
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/documents/upload-url")
async def get_moderator_document_upload_url(
    document_type: str,
    file_name: str,
    file_type: str,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Get presigned URL for uploading moderator document."""
    from app.services.s3 import generate_presigned_put_url
    from app.schemas.verification import PresignResponse
    
    if current_user.role and current_user.role.value != "COMPOUND_MOD":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a compound moderator"
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


@router.post("/documents", response_model=CompoundModeratorDocumentResponse, status_code=status.HTTP_201_CREATED)
async def add_moderator_document_endpoint(
    document_data: CompoundModeratorDocumentCreate,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Add a document to moderator profile."""
    if current_user.role and current_user.role.value != "COMPOUND_MOD":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a compound moderator"
        )
    
    try:
        document = await add_moderator_document(
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


@router.post("/onboarding/submit", response_model=CompoundModeratorProfileResponse)
async def submit_moderator_onboarding(
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit moderator profile for review."""
    if current_user.role and current_user.role.value != "COMPOUND_MOD":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a compound moderator"
        )
    
    try:
        profile = await submit_moderator_profile(db, current_user.id)
        await db.refresh(profile, ["compound", "documents"])
        if profile.compound:
            profile.compound_name = profile.compound.name
        return profile
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/me", response_model=CompoundModeratorProfileResponse)
async def get_my_moderator_profile(
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's moderator profile."""
    if current_user.role and current_user.role.value != "COMPOUND_MOD":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not a compound moderator"
        )
    
    profile = await get_moderator_profile(db, current_user.id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Moderator profile not found"
        )
    
    await db.refresh(profile, ["compound", "documents"])
    if profile.compound:
        profile.compound_name = profile.compound.name
    return profile

