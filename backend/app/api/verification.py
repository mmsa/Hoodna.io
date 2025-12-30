from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.verification import (
    PresignRequest, PresignResponse, DocumentSubmit,
    VerificationStatusResponse, VerificationDocumentResponse
)
from app.services.s3 import generate_presigned_put_url
from app.crud.verification import (
    create_document, get_user_documents, check_and_update_user_status
)
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.enums import DocumentType, DocumentStatus, UserStatus
import os

router = APIRouter()

# File upload validation constants
ALLOWED_DOCUMENT_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp",
    "application/pdf"
}
MAX_FILE_SIZE_MB = 15  # Increased to accommodate multi-page scanned contracts
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


def validate_file_upload(file_name: str, file_type: str) -> None:
    """Validate file upload for verification documents."""
    # Check file type
    if file_type.lower() not in [t.lower() for t in ALLOWED_DOCUMENT_TYPES]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_DOCUMENT_TYPES)}"
        )
    
    # Check file extension matches MIME type
    file_ext = file_name.split('.')[-1].lower() if '.' in file_name else ''
    ext_to_mime = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
        'pdf': 'application/pdf'
    }
    
    if file_ext and file_ext in ext_to_mime:
        expected_mime = ext_to_mime[file_ext]
        if file_type.lower() != expected_mime.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension '{file_ext}' does not match MIME type '{file_type}'"
            )


@router.post("/presign", response_model=PresignResponse)
async def get_presigned_url(
    request: PresignRequest,
    current_user: User = Depends(get_current_user),
):
    """Get a pre-signed URL for uploading a verification document."""
    # Validate file upload
    validate_file_upload(request.file_name, request.file_type)
    
    try:
        presigned_url, file_url = generate_presigned_put_url(
            file_name=request.file_name,
            file_type=request.file_type,
        )
        return PresignResponse(
            presigned_url=presigned_url,
            file_url=file_url
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate presigned URL: {str(e)}"
        )


@router.post("/submit", response_model=VerificationDocumentResponse, status_code=status.HTTP_201_CREATED)
async def submit_document(
    document_data: DocumentSubmit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a verification document after uploading to S3."""
    doc = await create_document(
        db=db,
        user_id=current_user.id,
        document_type=document_data.document_type,
        file_url=document_data.file_url,
    )
    return doc


@router.get("/status", response_model=VerificationStatusResponse)
async def get_verification_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get verification status for current user."""
    from app.crud.verification import has_compound_name_in_document
    
    docs = await get_user_documents(db, current_user.id)
    
    national_id = docs[DocumentType.NATIONAL_ID]
    contract = docs[DocumentType.CONTRACT]
    
    # Check if user can post based on new rules:
    # 1. National ID approved + has compound name → sufficient
    # 2. Contract approved (name match + compound match) → sufficient
    # 3. Both documents approved → sufficient
    def _has_compound_name(doc):
        if not doc or not doc.llm_extracted_info:
            return False
        if isinstance(doc.llm_extracted_info, dict):
            compound_found = doc.llm_extracted_info.get("compound_name_in_address", False)
            address_match = doc.llm_extracted_info.get("address_match", "")
            return compound_found or address_match == "MATCH"
        return False
    
    # Check if user should be auto-approved based on approved documents
    # If ANY document is approved, approve the user
    if current_user.status != UserStatus.APPROVED:
        user_should_be_approved = False
        
        # If ANY document is approved, approve the user
        if (
            national_id and national_id.status == DocumentStatus.APPROVED
        ) or (
            contract and contract.status == DocumentStatus.APPROVED
        ):
            user_should_be_approved = True
        
        if user_should_be_approved:
            current_user.status = UserStatus.APPROVED
            await db.commit()
            await db.refresh(current_user)
            # Send notification
            try:
                from app.services.notifications import notify_verification_approved
                await notify_verification_approved(db, current_user.id)
            except Exception:
                # Don't fail if notification fails
                pass
    
    can_post = False
    if current_user.status == UserStatus.APPROVED:
        # Rule 1: National ID approved + has compound name
        if (
            national_id 
            and national_id.status.value == "APPROVED" 
            and _has_compound_name(national_id)
        ):
            can_post = True
        # Rule 2: Contract approved + name match + compound match
        elif (
            contract
            and contract.status.value == "APPROVED"
            and contract.llm_extracted_info
            and isinstance(contract.llm_extracted_info, dict)
        ):
            name_match = contract.llm_extracted_info.get("name_match", "")
            if name_match == "MATCH" and _has_compound_name(contract):
                can_post = True
        # Rule 3: Both documents approved
        elif (
            national_id and national_id.status.value == "APPROVED" and
            contract and contract.status.value == "APPROVED"
        ):
            can_post = True
    
    return VerificationStatusResponse(
        national_id=VerificationDocumentResponse.model_validate(national_id) if national_id else None,
        contract=VerificationDocumentResponse.model_validate(contract) if contract else None,
        user_status=current_user.status.value,
        can_post=can_post,
    )

