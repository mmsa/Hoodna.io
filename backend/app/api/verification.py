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
from app.models.enums import DocumentType, UserStatus
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
    docs = await get_user_documents(db, current_user.id)
    
    national_id = docs[DocumentType.NATIONAL_ID]
    contract = docs[DocumentType.CONTRACT]
    
    # Check if user can post (both documents approved)
    can_post = (
        current_user.status == UserStatus.APPROVED and
        national_id and national_id.status.value == "APPROVED" and
        contract and contract.status.value == "APPROVED"
    )
    
    return VerificationStatusResponse(
        national_id=VerificationDocumentResponse.model_validate(national_id) if national_id else None,
        contract=VerificationDocumentResponse.model_validate(contract) if contract else None,
        user_status=current_user.status.value,
        can_post=can_post,
    )

