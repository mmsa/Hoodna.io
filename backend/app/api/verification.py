from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.verification import (
    PresignRequest, PresignResponse, DocumentSubmit,
    VerificationStatusResponse, VerificationDocumentResponse
)
from app.services.s3 import generate_presigned_put_url, build_download_proxy_url
from app.crud.verification import (
    create_document, get_user_documents, check_and_update_user_status
)
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.enums import DocumentType, DocumentStatus, UserRole, UserStatus
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
            folder="verification",
            user_id=current_user.id,
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
    if not current_user.compound_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select a neighbourhood before submitting verification documents.",
        )

    doc = await create_document(
        db=db,
        user_id=current_user.id,
        document_type=document_data.document_type,
        file_url=document_data.file_url,
        compound_id=current_user.compound_id,
    )
    return doc


@router.get("/signed-url")
async def get_signed_file_url(
    file_url: str = Query(..., description="Stored file URL from verification document"),
    current_user: User = Depends(get_current_user),
):
    """
    Return a short-lived URL for viewing a private S3 (or local) file.
    Authenticated users only — required when the bucket blocks public access.
    """
    if not file_url.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="file_url is required")
    try:
        url = build_download_proxy_url(file_url.strip(), current_user.id)
        return {"url": url, "expires_in": 900}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate view URL: {e}",
        )


@router.get("/status", response_model=VerificationStatusResponse)
async def get_verification_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get verification status for the user's current compound."""
    from app.crud.user_compound_membership import user_has_compound_membership

    if not current_user.compound_id:
        return VerificationStatusResponse(
            national_id=None,
            contract=None,
            user_status=current_user.status.value,
            can_post=False,
            compound_id=None,
            compound_name=None,
        )

    docs = await get_user_documents(db, current_user.id, current_user.compound_id)

    national_id = docs[DocumentType.NATIONAL_ID]
    contract = docs[DocumentType.CONTRACT]

    is_verified_here = await user_has_compound_membership(
        db, current_user, current_user.compound_id
    )

    if (
        not is_verified_here
        and current_user.status != UserStatus.APPROVED
    ):
        user_should_be_approved = (
            national_id and national_id.status == DocumentStatus.APPROVED
        ) or (contract and contract.status == DocumentStatus.APPROVED)

        if user_should_be_approved:
            current_user.status = UserStatus.APPROVED
            from app.crud.user_compound_membership import ensure_user_compound_membership
            await ensure_user_compound_membership(
                db, current_user.id, current_user.compound_id
            )
            await db.commit()
            await db.refresh(current_user)
            is_verified_here = True
            try:
                from app.services.notifications import notify_verification_approved
                await notify_verification_approved(db, current_user.id)
            except Exception:
                pass

    can_post = (
        current_user.role in (UserRole.RESIDENT, UserRole.USER, None)
        and current_user.status == UserStatus.APPROVED
        and is_verified_here
    )

    from app.crud.compound import get_compound_by_id
    compound = await get_compound_by_id(db, current_user.compound_id)

    return VerificationStatusResponse(
        national_id=VerificationDocumentResponse.model_validate(national_id) if national_id else None,
        contract=VerificationDocumentResponse.model_validate(contract) if contract else None,
        user_status=current_user.status.value,
        can_post=can_post,
        compound_id=current_user.compound_id,
        compound_name=compound.name if compound else None,
    )

