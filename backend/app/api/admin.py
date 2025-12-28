from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.admin import DocumentReviewRequest, UserStatusUpdate
from app.schemas.verification import VerificationDocumentResponse
from app.schemas.user import UserResponse
from app.crud.verification import (
    get_pending_documents, approve_document, reject_document
)
from app.crud.user import update_user_status
from app.crud.listing import archive_listing
from app.crud.post import delete_post
from app.core.dependencies import get_current_admin
from app.models.user import User
from app.models.enums import UserStatus, DocumentStatus
from typing import List

router = APIRouter()


@router.get("/verifications", response_model=List[VerificationDocumentResponse])
async def list_pending_verifications(
    status_filter: str = "PENDING",
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get pending verification documents."""
    if status_filter == "PENDING":
        docs = await get_pending_documents(db, skip=skip, limit=limit)
    else:
        # For MVP, just return pending. Can extend later
        docs = await get_pending_documents(db, skip=skip, limit=limit)
    
    return [VerificationDocumentResponse.model_validate(doc) for doc in docs]


@router.post("/verifications/{doc_id}/approve", response_model=VerificationDocumentResponse)
async def approve_verification_document(
    doc_id: int,
    review_data: DocumentReviewRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve a verification document."""
    try:
        doc = await approve_document(
            db=db,
            doc_id=doc_id,
            reviewer_id=current_user.id,
            notes=review_data.notes,
        )
        return VerificationDocumentResponse.model_validate(doc)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/verifications/{doc_id}/reject", response_model=VerificationDocumentResponse)
async def reject_verification_document(
    doc_id: int,
    review_data: DocumentReviewRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reject a verification document."""
    try:
        doc = await reject_document(
            db=db,
            doc_id=doc_id,
            reviewer_id=current_user.id,
            notes=review_data.notes,
        )
        return VerificationDocumentResponse.model_validate(doc)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/users/{user_id}/approve", response_model=UserResponse)
async def approve_user(
    user_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve a user."""
    try:
        user = await update_user_status(db, user_id, UserStatus.APPROVED, current_user.id)
        return UserResponse.model_validate(user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/users/{user_id}/reject", response_model=UserResponse)
async def reject_user(
    user_id: int,
    update_data: UserStatusUpdate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reject a user."""
    try:
        user = await update_user_status(db, user_id, UserStatus.REJECTED, current_user.id)
        return UserResponse.model_validate(user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/users/{user_id}/ban", response_model=UserResponse)
async def ban_user(
    user_id: int,
    update_data: UserStatusUpdate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Ban a user."""
    try:
        user = await update_user_status(db, user_id, UserStatus.BANNED, current_user.id)
        return UserResponse.model_validate(user)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/listings/{listing_id}/archive")
async def archive_listing_endpoint(
    listing_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Archive a listing."""
    success = await archive_listing(db, listing_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )
    return {"message": "Listing archived successfully"}


@router.post("/posts/{post_id}/remove")
async def remove_post(
    post_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Remove a post."""
    success = await delete_post(db, post_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    return {"message": "Post removed successfully"}

