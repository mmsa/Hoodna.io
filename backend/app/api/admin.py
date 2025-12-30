import re
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from typing import Optional
from pydantic import BaseModel
from app.schemas.admin import DocumentReviewRequest, UserStatusUpdate
from app.schemas.verification import VerificationDocumentResponse
from app.schemas.user import UserResponse
from app.schemas.compound import CompoundResponse, CompoundUpdate
from app.crud.verification import (
    get_pending_documents,
    approve_document,
    reject_document,
    request_more_details_document,
    get_documents_with_status,
    update_document_status,
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
from app.models.enums import UserStatus, DocumentStatus, DocumentType, ProviderStatus, ModeratorStatus
from typing import List
from app.models.service_provider import ServiceProviderProfile
from app.models.compound_moderator import CompoundModeratorProfile
from sqlalchemy import select
from datetime import datetime

router = APIRouter()


class VerificationListResponse(BaseModel):
    items: list[dict]
    total: int
    skip: int
    limit: int


@router.get("/verifications", response_model=VerificationListResponse)
async def list_verifications(
    status_filter: Optional[str] = Query(None, description="Filter by status: PENDING, APPROVED, REJECTED, REQUEST_MORE_DETAILS, ALL"),
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    search: Optional[str] = Query(None, description="Search in user name, email, or document notes"),
    document_type: Optional[str] = Query(None, description="Filter by document type: NATIONAL_ID, CONTRACT"),
    compound_id: Optional[int] = Query(None, description="Filter by compound ID"),
    sort_by: Optional[str] = Query("created_at_desc", description="Sort order: created_at_desc, created_at_asc, user_name_asc, user_name_desc, status_asc, status_desc"),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get verification documents with pagination, search, filters, and sorting."""
    # Parse status filter
    doc_status = None
    if status_filter and status_filter.upper() != "ALL":
        try:
            doc_status = DocumentStatus[status_filter.upper()]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status filter: {status_filter}. Valid values: PENDING, APPROVED, REJECTED, REQUEST_MORE_DETAILS, ALL",
            )

    # Validate sort_by
    valid_sorts = ["created_at_desc", "created_at_asc", "user_name_asc", "user_name_desc", "status_asc", "status_desc"]
    if sort_by not in valid_sorts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid sort_by: {sort_by}. Valid values: {', '.join(valid_sorts)}"
        )

    # Get documents with filters, search, and sorting
    docs, total = await get_documents_with_status(
        db,
        status_filter=doc_status,
        skip=skip,
        limit=limit,
        search_query=search,
        document_type=document_type,
        compound_id=compound_id,
        sort_by=sort_by,
    )

    # Include user information with compound details for each document
    result = []
    for doc in docs:
        user = await db.get(User, doc.user_id)
        doc_dict = VerificationDocumentResponse.model_validate(doc).model_dump()

        compound_name = None
        compound_area = None
        if user and user.compound_id:
            from app.models.compound import Compound

            compound = await db.get(Compound, user.compound_id)
            if compound:
                compound_name = compound.name
                compound_area = compound.area

        doc_dict["user"] = (
            {
                "id": user.id,
                "name": user.name,
                "email": user.email,
                "phone": user.phone,
                "compound_id": user.compound_id,
                "compound_name": compound_name,
                "compound_area": compound_area,
            }
            if user
            else None
        )
        result.append(doc_dict)

    return VerificationListResponse(
        items=result,
        total=total,
        skip=skip,
        limit=limit,
    )


@router.post(
    "/verifications/{doc_id}/approve", response_model=VerificationDocumentResponse
)
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/verifications/{doc_id}/reject", response_model=VerificationDocumentResponse
)
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/verifications/{doc_id}/request-more-details",
    response_model=VerificationDocumentResponse,
)
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.patch(
    "/verifications/{doc_id}/status", response_model=VerificationDocumentResponse
)
async def update_document_status_endpoint(
    doc_id: int,
    status_update: dict,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update document status to any valid status."""
    try:
        new_status_str = status_update.get("status")
        if not new_status_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Status is required"
            )

        try:
            new_status = DocumentStatus[new_status_str.upper()]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {new_status_str}. Valid values: PENDING, APPROVED, REJECTED, REQUEST_MORE_DETAILS",
            )

        doc = await update_document_status(
            db=db,
            doc_id=doc_id,
            new_status=new_status,
            reviewer_id=current_user.id,
            notes=status_update.get("notes"),
        )
        await db.commit()
        return VerificationDocumentResponse.model_validate(doc)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/verifications/{doc_id}/verify-with-llm")
async def verify_document_with_llm_endpoint(
    doc_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Trigger LLM verification for a document."""
    logger = logging.getLogger(__name__)
    
    try:
        doc = await db.get(VerificationDocument, doc_id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
            )

        user = await db.get(User, doc.user_id)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
            )

        # Get compound name if user has a compound
        compound_name = None
        if user.compound_id:
            from app.models.compound import Compound
            compound = await db.get(Compound, user.compound_id)
            if compound:
                compound_name = compound.name

        logger.info(f"Starting LLM verification for document {doc_id}, type: {doc.type.value}, file_url: {doc.file_url}")

        # Run LLM verification
        try:
            llm_result = await verify_document_with_llm(
                file_url=doc.file_url,
                document_type=doc.type.value,
                user_name=user.name,
                user_email=user.email,
                compound_name=compound_name,
            )
            logger.info(f"LLM verification completed for document {doc_id}. Result: verified={llm_result.get('verified')}, confidence={llm_result.get('confidence')}, recommendation={llm_result.get('recommendation')}")
        except Exception as llm_error:
            logger.error(f"LLM verification failed for document {doc_id}: {str(llm_error)}", exc_info=True)
            # Return error result but don't fail the endpoint
            llm_result = {
                "verified": False,
                "confidence": 0.0,
                "issues": [f"LLM verification error: {str(llm_error)}"],
                "recommendation": "REQUEST_MORE_DETAILS",
                "reasoning": f"Failed to verify document: {str(llm_error)}",
                "extracted_info": {},
                "name_match": "UNCLEAR",
                "address_match": "UNCLEAR"
            }

        # Update document with LLM results
        doc.llm_verified = 1 if llm_result["verified"] else 0
        doc.llm_confidence = llm_result["confidence"]
        doc.llm_recommendation = llm_result["recommendation"]
        doc.llm_reasoning = llm_result["reasoning"]
        doc.llm_issues = llm_result["issues"]
        
        # Store name_match, address_match, and compound_name_in_address in extracted_info
        extracted_info = llm_result.get("extracted_info", {})
        extracted_info["name_match"] = llm_result.get("name_match", "UNCLEAR")
        extracted_info["address_match"] = llm_result.get("address_match", "UNCLEAR")
        # Check if compound name was found in address (from extracted_info or address_match)
        address_match = llm_result.get("address_match", "")
        compound_name_found = (
            extracted_info.get("compound_name_in_address", False) or
            address_match == "MATCH"
        )
        extracted_info["compound_name_in_address"] = compound_name_found
        doc.llm_extracted_info = extracted_info
        
        # Auto-update status if confidence >= 80% and recommendation is clear
        # Only auto-update if document is still PENDING (not manually reviewed)
        if llm_result["confidence"] >= 0.8 and doc.status == DocumentStatus.PENDING:
            name_match = llm_result.get("name_match", "")
            extracted_info = llm_result.get("extracted_info", {})
            doc_type_confirmed = extracted_info.get("document_type_confirmed", "")
            
            # CRITICAL: Check document type first - if wrong type, reject immediately
            if doc.type == DocumentType.CONTRACT and doc_type_confirmed == "NATIONAL_ID":
                doc.status = DocumentStatus.REJECTED
                doc.reviewer_id = current_user.id
                if doc.notes:
                    doc.notes = f"[Auto-rejected by AI - Wrong document type: Expected Contract but received National ID]\n\n{doc.notes}"
                else:
                    doc.notes = "[Auto-rejected by AI - Wrong document type: Expected Contract but received National ID]"
                await db.commit()
                await db.refresh(doc)
                return {
                    "document": VerificationDocumentResponse.model_validate(doc).model_dump(),
                    "llm_result": llm_result,
                }
            elif doc.type == DocumentType.NATIONAL_ID and doc_type_confirmed == "CONTRACT":
                doc.status = DocumentStatus.REJECTED
                doc.reviewer_id = current_user.id
                if doc.notes:
                    doc.notes = f"[Auto-rejected by AI - Wrong document type: Expected National ID but received Contract]\n\n{doc.notes}"
                else:
                    doc.notes = "[Auto-rejected by AI - Wrong document type: Expected National ID but received Contract]"
                await db.commit()
                await db.refresh(doc)
                return {
                    "document": VerificationDocumentResponse.model_validate(doc).model_dump(),
                    "llm_result": llm_result,
                }
            elif doc_type_confirmed and doc_type_confirmed not in ["CONTRACT", "NATIONAL_ID"]:
                doc.status = DocumentStatus.REJECTED
                doc.reviewer_id = current_user.id
                if doc.notes:
                    doc.notes = f"[Auto-rejected by AI - Wrong document type: Expected {doc.type.value} but received {doc_type_confirmed}]\n\n{doc.notes}"
                else:
                    doc.notes = f"[Auto-rejected by AI - Wrong document type: Expected {doc.type.value} but received {doc_type_confirmed}]"
                await db.commit()
                await db.refresh(doc)
                return {
                    "document": VerificationDocumentResponse.model_validate(doc).model_dump(),
                    "llm_result": llm_result,
                }
            
            # Auto-approve if:
            # - For National ID: name matches AND (address matches OR compound name found) AND document type confirmed
            # - For Contract: name matches AND address matches (compound name required) AND document type confirmed
            should_auto_approve = False
            if llm_result["recommendation"] == "APPROVE" and doc_type_confirmed == doc.type.value:
                if doc.type == DocumentType.NATIONAL_ID:
                    # National ID: name match + compound name in address + correct document type
                    should_auto_approve = (
                        name_match == "MATCH" and 
                        (address_match == "MATCH" or compound_name_found)
                    )
                else:  # CONTRACT
                    # Contract: name match + address match (compound name required) + correct document type
                    should_auto_approve = (
                        name_match == "MATCH" and address_match == "MATCH"
                    )
            
            if should_auto_approve:
                doc.status = DocumentStatus.APPROVED
                doc.reviewer_id = current_user.id
                # Add note about auto-approval
                if doc.notes:
                    doc.notes = f"[Auto-approved by AI - {llm_result['confidence']*100:.0f}% confidence]\n\n{doc.notes}"
                else:
                    doc.notes = f"[Auto-approved by AI - {llm_result['confidence']*100:.0f}% confidence]"
                
                # Check if user can now be approved (using the same logic as approve_document)
                await db.flush()
                from app.crud.verification import get_user_documents, has_compound_name_in_document
                
                docs = await get_user_documents(db, doc.user_id)
                national_id = docs[DocumentType.NATIONAL_ID]
                contract = docs[DocumentType.CONTRACT]
                
                user = await db.get(User, doc.user_id)
                if user and user.status == UserStatus.PENDING_VERIFICATION:
                    # If ANY document is approved, approve the user
                    if (
                        national_id and national_id.status == DocumentStatus.APPROVED
                    ) or (
                        contract and contract.status == DocumentStatus.APPROVED
                    ):
                        user.status = UserStatus.APPROVED
                        await db.flush()
                        # Send notification
                        from app.services.notifications import notify_verification_approved
                        await notify_verification_approved(db, user.id)
                    else:
                        await db.flush()
            elif llm_result["recommendation"] == "REJECT" or name_match == "NO_MATCH" or address_match == "NO_MATCH":
                # Check document type - if wrong type, reject with specific message
                extracted_info = llm_result.get("extracted_info", {})
                doc_type_confirmed = extracted_info.get("document_type_confirmed", "")
                
                # If document type doesn't match expected type, reject with specific message
                if doc.type == DocumentType.CONTRACT and doc_type_confirmed == "NATIONAL_ID":
                    doc.status = DocumentStatus.REJECTED
                    doc.reviewer_id = current_user.id
                    if doc.notes:
                        doc.notes = f"[Auto-rejected by AI - Wrong document type: Expected Contract but received National ID]\n\n{doc.notes}"
                    else:
                        doc.notes = "[Auto-rejected by AI - Wrong document type: Expected Contract but received National ID]"
                elif doc.type == DocumentType.NATIONAL_ID and doc_type_confirmed == "CONTRACT":
                    doc.status = DocumentStatus.REJECTED
                    doc.reviewer_id = current_user.id
                    if doc.notes:
                        doc.notes = f"[Auto-rejected by AI - Wrong document type: Expected National ID but received Contract]\n\n{doc.notes}"
                    else:
                        doc.notes = "[Auto-rejected by AI - Wrong document type: Expected National ID but received Contract]"
                elif doc_type_confirmed and doc_type_confirmed not in ["CONTRACT", "NATIONAL_ID"]:
                    doc.status = DocumentStatus.REJECTED
                    doc.reviewer_id = current_user.id
                    if doc.notes:
                        doc.notes = f"[Auto-rejected by AI - Wrong document type: Expected {doc.type.value} but received {doc_type_confirmed}]\n\n{doc.notes}"
                    else:
                        doc.notes = f"[Auto-rejected by AI - Wrong document type: Expected {doc.type.value} but received {doc_type_confirmed}]"
                else:
                    # Normal rejection based on name/address mismatch
                    doc.status = DocumentStatus.REJECTED
                    doc.reviewer_id = current_user.id
                    # Add note about auto-rejection
                    if doc.notes:
                        doc.notes = f"[Auto-rejected by AI - {llm_result['confidence']*100:.0f}% confidence]\n\n{doc.notes}"
                    else:
                        doc.notes = f"[Auto-rejected by AI - {llm_result['confidence']*100:.0f}% confidence]"
        
        # Only set llm_verified_at if verification was actually attempted successfully
        # (not if API key was missing, configuration error, or API error occurred)
        issues = llm_result.get("issues", [])
        reasoning = llm_result.get("reasoning", "").lower()
        
        # Check for various error conditions
        api_key_missing = any(
            "api key" in str(issue).lower() or 
            "not configured" in str(issue).lower() or
            "not available" in str(issue).lower()
            for issue in issues
        )
        
        # Check for API errors (400, 404, etc.)
        api_error = any(
            "400" in str(issue) or
            "404" in str(issue) or
            "bad request" in str(issue).lower() or
            "not found" in str(issue).lower() or
            "api error" in str(issue).lower() or
            "openai api" in str(issue).lower()
            for issue in issues
        )
        
        has_error = (
            api_key_missing or 
            api_error or
            "not available" in reasoning or
            "not configured" in reasoning or
            "manual review required" in reasoning or
            "failed to verify" in reasoning
        )
        
        # Only set verified_at if we actually got a real verification result (not an error)
        # This ensures the button doesn't disappear on errors
        if not has_error and llm_result.get("verified") is not None:
            doc.llm_verified_at = datetime.utcnow()

        await db.commit()
        await db.refresh(doc)

        logger.info(f"LLM verification endpoint completed successfully for document {doc_id}")
        return {
            "document": VerificationDocumentResponse.model_validate(doc).model_dump(),
            "llm_result": llm_result,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in LLM verification endpoint for document {doc_id}: {str(e)}", exc_info=True)
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to verify document with LLM: {str(e)}"
        )


class BulkVerifyResponse(BaseModel):
    total_processed: int
    successful: int
    failed: int
    results: list[dict]


@router.post("/verifications/bulk-verify-with-llm", response_model=BulkVerifyResponse)
async def bulk_verify_documents_with_llm(
    status_filter: Optional[str] = Query("PENDING", description="Only verify documents with this status"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of documents to process"),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Bulk verify multiple pending documents with LLM."""
    # Parse status filter
    doc_status = DocumentStatus.PENDING
    if status_filter and status_filter.upper() != "PENDING":
        try:
            doc_status = DocumentStatus[status_filter.upper()]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status filter: {status_filter}. Valid values: PENDING, APPROVED, REJECTED, REQUEST_MORE_DETAILS",
            )
    
    # Get pending documents
    docs, total = await get_documents_with_status(
        db,
        status_filter=doc_status,
        skip=0,
        limit=limit,
    )
    
    if not docs:
        return BulkVerifyResponse(
            total_processed=0,
            successful=0,
            failed=0,
            results=[],
        )
    
    successful = 0
    failed = 0
    results = []
    
    # Process each document
    for doc in docs:
        try:
            user = await db.get(User, doc.user_id)
            if not user:
                failed += 1
                results.append({
                    "document_id": doc.id,
                    "status": "failed",
                    "error": "User not found",
                })
                continue
            
            # Get compound name if user has a compound
            compound_name = None
            if user.compound_id:
                from app.models.compound import Compound
                compound = await db.get(Compound, user.compound_id)
                if compound:
                    compound_name = compound.name
            
            # Run LLM verification
            llm_result = await verify_document_with_llm(
                file_url=doc.file_url,
                document_type=doc.type.value,
                user_name=user.name,
                user_email=user.email,
                compound_name=compound_name,
            )
            
            # Update document with LLM results
            doc.llm_verified = 1 if llm_result["verified"] else 0
            doc.llm_confidence = llm_result["confidence"]
            doc.llm_recommendation = llm_result["recommendation"]
            doc.llm_reasoning = llm_result["reasoning"]
            doc.llm_issues = llm_result["issues"]
            
            # Store name_match, address_match, and compound_name_in_address
            extracted_info = llm_result.get("extracted_info", {})
            extracted_info["name_match"] = llm_result.get("name_match", "UNCLEAR")
            extracted_info["address_match"] = llm_result.get("address_match", "UNCLEAR")
            address_match = llm_result.get("address_match", "")
            compound_name_found = (
                extracted_info.get("compound_name_in_address", False) or
                address_match == "MATCH"
            )
            extracted_info["compound_name_in_address"] = compound_name_found
            doc.llm_extracted_info = extracted_info
            
            # Auto-update status if confidence >= 80%
            if llm_result["confidence"] >= 0.8 and doc.status == DocumentStatus.PENDING:
                name_match = llm_result.get("name_match", "")
                
                should_auto_approve = False
                if llm_result["recommendation"] == "APPROVE":
                    if doc.type == DocumentType.NATIONAL_ID:
                        should_auto_approve = (
                            name_match == "MATCH" and 
                            (address_match == "MATCH" or compound_name_found)
                        )
                    else:  # CONTRACT
                        should_auto_approve = (
                            name_match == "MATCH" and address_match == "MATCH"
                        )
                
                if should_auto_approve:
                    doc.status = DocumentStatus.APPROVED
                    doc.reviewer_id = current_user.id
                    doc.notes = f"[Auto-approved by AI - {llm_result['confidence']*100:.0f}% confidence]"
                    
                    # Check if user can now be approved
                    await db.flush()
                    from app.crud.verification import get_user_documents, has_compound_name_in_document
                    
                    docs_check = await get_user_documents(db, doc.user_id)
                    national_id = docs_check[DocumentType.NATIONAL_ID]
                    contract = docs_check[DocumentType.CONTRACT]
                    
                    user_check = await db.get(User, doc.user_id)
                    if user_check and user_check.status == UserStatus.PENDING_VERIFICATION:
                        # If ANY document is approved, approve the user
                        if (
                            national_id and national_id.status == DocumentStatus.APPROVED
                        ) or (
                            contract and contract.status == DocumentStatus.APPROVED
                        ):
                            user_check.status = UserStatus.APPROVED
                        await db.flush()
                elif llm_result["recommendation"] == "REJECT" or name_match == "NO_MATCH" or address_match == "NO_MATCH":
                    # Check document type - if wrong type, reject with specific message
                    extracted_info = llm_result.get("extracted_info", {})
                    doc_type_confirmed = extracted_info.get("document_type_confirmed", "")
                    
                    # If document type doesn't match expected type, reject with specific message
                    if doc.type == DocumentType.CONTRACT and doc_type_confirmed == "NATIONAL_ID":
                        doc.status = DocumentStatus.REJECTED
                        doc.reviewer_id = current_user.id
                        doc.notes = "[Auto-rejected by AI - Wrong document type: Expected Contract but received National ID]"
                    elif doc.type == DocumentType.NATIONAL_ID and doc_type_confirmed == "CONTRACT":
                        doc.status = DocumentStatus.REJECTED
                        doc.reviewer_id = current_user.id
                        doc.notes = "[Auto-rejected by AI - Wrong document type: Expected National ID but received Contract]"
                    elif doc_type_confirmed and doc_type_confirmed not in ["CONTRACT", "NATIONAL_ID"]:
                        doc.status = DocumentStatus.REJECTED
                        doc.reviewer_id = current_user.id
                        doc.notes = f"[Auto-rejected by AI - Wrong document type: Expected {doc.type.value} but received {doc_type_confirmed}]"
                    else:
                        # Normal rejection based on name/address mismatch
                        doc.status = DocumentStatus.REJECTED
                        doc.reviewer_id = current_user.id
                        doc.notes = f"[Auto-rejected by AI - {llm_result['confidence']*100:.0f}% confidence]"
            
            # Set verified_at timestamp
            issues = llm_result.get("issues", [])
            reasoning = llm_result.get("reasoning", "").lower()
            
            api_key_missing = any(
                "api key" in str(issue).lower() or 
                "not configured" in str(issue).lower() or
                "not available" in str(issue).lower()
                for issue in issues
            )
            
            api_error = any(
                "400" in str(issue) or
                "404" in str(issue) or
                "bad request" in str(issue).lower() or
                "not found" in str(issue).lower() or
                "api error" in str(issue).lower() or
                "openai api" in str(issue).lower()
                for issue in issues
            )
            
            has_error = (
                api_key_missing or 
                api_error or
                "not available" in reasoning or
                "not configured" in reasoning or
                "manual review required" in reasoning or
                "failed to verify" in reasoning
            )
            
            if not has_error and llm_result.get("verified") is not None:
                doc.llm_verified_at = datetime.utcnow()
            
            await db.flush()
            successful += 1
            results.append({
                "document_id": doc.id,
                "status": "success",
                "recommendation": llm_result["recommendation"],
                "confidence": llm_result["confidence"],
            })
        except Exception as e:
            failed += 1
            results.append({
                "document_id": doc.id,
                "status": "failed",
                "error": str(e),
            })
            continue
    
    await db.commit()
    
    return BulkVerifyResponse(
        total_processed=len(docs),
        successful=successful,
        failed=failed,
        results=results,
    )


@router.post("/users/{user_id}/approve", response_model=UserResponse)
async def approve_user(
    user_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve a user."""
    try:
        user = await update_user_status(
            db, user_id, UserStatus.APPROVED, current_user.id
        )
        return UserResponse.model_validate(user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/users/{user_id}/reject", response_model=UserResponse)
async def reject_user(
    user_id: int,
    update_data: UserStatusUpdate,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Reject a user."""
    try:
        user = await update_user_status(
            db, user_id, UserStatus.REJECTED, current_user.id
        )
        return UserResponse.model_validate(user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


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
            status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found"
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
            status_code=status.HTTP_404_NOT_FOUND, detail="Post not found"
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
        c for c in all_compounds if not c.compound_id or not c.area or not c.status_2025
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
    if "compound_id" not in update_dict and "name" in update_dict:
        name = update_dict["name"]
        # Generate slug: lowercase, replace spaces with hyphens, remove special chars
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        update_dict["compound_id"] = slug

    # If compound_id still not provided, get current name and generate slug
    if "compound_id" not in update_dict:
        compound = await get_compound_by_id(db, compound_id)
        if compound and compound.name:
            slug = re.sub(r"[^a-z0-9]+", "-", compound.name.lower()).strip("-")
            update_dict["compound_id"] = slug

    compound = await update_compound(db, compound_id, update_dict)

    if not compound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Compound not found"
        )

    await db.commit()
    return compound
