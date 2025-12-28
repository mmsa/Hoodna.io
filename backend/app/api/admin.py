import re
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.admin import DocumentReviewRequest, UserStatusUpdate
from app.schemas.verification import VerificationDocumentResponse
from app.schemas.user import UserResponse
from app.schemas.compound import CompoundResponse, CompoundUpdate
from app.crud.verification import (
    get_pending_documents, approve_document, reject_document, request_more_details_document
)
from app.services.llm_verification import verify_document_with_llm
from app.models.verification import VerificationDocument
from datetime import datetime
from app.crud.user import update_user_status
from app.crud.listing import archive_listing
from app.crud.post import delete_post
from app.crud.compound import get_all_compounds, update_compound, get_compound_by_id
from app.core.dependencies import get_current_admin
from app.models.user import User
from app.models.enums import UserStatus, DocumentStatus
from typing import List

router = APIRouter()


@router.get("/verifications")
async def list_pending_verifications(
    status_filter: str = "PENDING",
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get pending verification documents with user information."""
    if status_filter == "PENDING":
        docs = await get_pending_documents(db, skip=skip, limit=limit)
    else:
        # For MVP, just return pending. Can extend later
        docs = await get_pending_documents(db, skip=skip, limit=limit)
    
    # Include user information with each document
    result = []
    for doc in docs:
        user = await db.get(User, doc.user_id)
        doc_dict = VerificationDocumentResponse.model_validate(doc).model_dump()
        doc_dict["user"] = {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "compound_id": user.compound_id,
        } if user else None
        result.append(doc_dict)
    
    return result


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
        await db.commit()
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
        await db.commit()
        return VerificationDocumentResponse.model_validate(doc)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/verifications/{doc_id}/request-more-details", response_model=VerificationDocumentResponse)
async def request_more_details_document_endpoint(
    doc_id: int,
    review_data: DocumentReviewRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Request more details for a verification document."""
    try:
        doc = await request_more_details_document(
            db=db,
            doc_id=doc_id,
            reviewer_id=current_user.id,
            notes=review_data.notes,
        )
        await db.commit()
        return VerificationDocumentResponse.model_validate(doc)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.post("/verifications/{doc_id}/verify-with-llm")
async def verify_document_with_llm_endpoint(
    doc_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Trigger LLM verification for a document."""
    doc = await db.get(VerificationDocument, doc_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    user = await db.get(User, doc.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Run LLM verification
    llm_result = await verify_document_with_llm(
        file_url=doc.file_url,
        document_type=doc.type.value,
        user_name=user.name,
        user_email=user.email
    )
    
    # Update document with LLM results
    doc.llm_verified = 1 if llm_result["verified"] else 0
    doc.llm_confidence = llm_result["confidence"]
    doc.llm_recommendation = llm_result["recommendation"]
    doc.llm_reasoning = llm_result["reasoning"]
    doc.llm_issues = llm_result["issues"]
    doc.llm_extracted_info = llm_result["extracted_info"]
    doc.llm_verified_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(doc)
    
    return {
        "document": VerificationDocumentResponse.model_validate(doc).model_dump(),
        "llm_result": llm_result
    }


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


@router.get("/compounds/pending", response_model=List[CompoundResponse])
async def list_pending_compounds(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """List compounds that need admin completion (user-requested, missing full details)."""
    # Get ALL compounds (including incomplete ones)
    all_compounds, total = await get_all_compounds(
        db,
        skip=skip,
        limit=limit,
    )
    
    # Filter to only compounds missing full details (user-requested, not yet admin-completed)
    pending = [
        c for c in all_compounds
        if not c.compound_id or not c.area or not c.status_2025
    ]
    
    return pending


@router.patch("/compounds/{compound_id}", response_model=CompoundResponse)
async def update_compound_details(
    compound_id: int,
    update_data: CompoundUpdate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Update compound details (admin completes user-requested compounds).
    
    Admin can fill in: compound_id, area, sub_area, category, developer, status_2025, etc.
    If compound_id is not provided, it will be auto-generated from name.
    """
    update_dict = update_data.model_dump(exclude_unset=True)
    
    # If compound_id not provided but name is being updated, generate slug from name
    if 'compound_id' not in update_dict and 'name' in update_dict:
        name = update_dict['name']
        # Generate slug: lowercase, replace spaces with hyphens, remove special chars
        slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
        update_dict['compound_id'] = slug
    
    # If compound_id still not provided, get current name and generate slug
    if 'compound_id' not in update_dict:
        compound = await get_compound_by_id(db, compound_id)
        if compound and compound.name:
            slug = re.sub(r'[^a-z0-9]+', '-', compound.name.lower()).strip('-')
            update_dict['compound_id'] = slug
    
    compound = await update_compound(
        db,
        compound_id,
        update_dict
    )
    
    if not compound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Compound not found"
        )
    
    await db.commit()
    return compound

