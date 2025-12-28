from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.marketplace import (
    ListingCreate, ListingUpdate, ListingResponse,
    PromotionCheckout, CheckoutSessionResponse
)
from app.schemas.verification import PresignResponse
from app.crud.listing import (
    get_listings, get_listing_by_id, create_listing, update_listing
)
from app.core.dependencies import get_current_approved_user
from app.services.s3 import generate_presigned_put_url
from app.models.user import User
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter()


class ImagePresignRequest(BaseModel):
    file_name: str
    file_type: str


@router.get("", response_model=List[ListingResponse])
async def list_listings(
    scope: str = "compound",
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Get listings based on scope (compound, cross, public)."""
    compound_id = current_user.compound_id if scope == "compound" else None
    
    listings = await get_listings(
        db=db,
        compound_id=compound_id,
        scope=scope,
        skip=skip,
        limit=limit,
    )
    
    result = []
    for listing in listings:
        result.append(ListingResponse(
            id=listing.id,
            compound_id=listing.compound_id,
            compound_name=listing.compound.name,
            owner_id=listing.owner_id,
            owner_name=listing.owner.name,
            category=listing.category,
            title=listing.title,
            description=listing.description,
            price=listing.price,
            currency=listing.currency,
            intent=listing.intent,
            image_urls=listing.image_urls or [],
            status=listing.status,
            created_at=listing.created_at,
        ))
    
    return result


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(
    listing_id: int,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific listing."""
    listing = await get_listing_by_id(db, listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )
    
    return ListingResponse(
        id=listing.id,
        compound_id=listing.compound_id,
        compound_name=listing.compound.name,
        owner_id=listing.owner_id,
        owner_name=listing.owner.name,
        category=listing.category,
        title=listing.title,
        description=listing.description,
        price=listing.price,
        currency=listing.currency,
        intent=listing.intent,
        image_urls=listing.image_urls or [],
        status=listing.status,
        created_at=listing.created_at,
    )


@router.post("", response_model=ListingResponse, status_code=status.HTTP_201_CREATED)
async def create_listing_endpoint(
    listing_data: ListingCreate,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new listing."""
    if current_user.compound_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be assigned to a compound"
        )
    
    listing = await create_listing(
        db=db,
        compound_id=current_user.compound_id,
        owner_id=current_user.id,
        listing_data=listing_data,
    )
    
    return ListingResponse(
        id=listing.id,
        compound_id=listing.compound_id,
        compound_name=current_user.compound.name if current_user.compound else "",
        owner_id=listing.owner_id,
        owner_name=current_user.name,
        category=listing.category,
        title=listing.title,
        description=listing.description,
        price=listing.price,
        currency=listing.currency,
        intent=listing.intent,
        image_urls=listing.image_urls or [],
        status=listing.status,
        created_at=listing.created_at,
    )


@router.patch("/{listing_id}", response_model=ListingResponse)
async def update_listing_endpoint(
    listing_id: int,
    listing_data: ListingUpdate,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a listing (only by owner)."""
    try:
        listing = await update_listing(
            db=db,
            listing_id=listing_id,
            listing_data=listing_data,
            owner_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "not found" in str(e).lower() else status.HTTP_403_FORBIDDEN,
            detail=str(e)
        )
    
    return ListingResponse(
        id=listing.id,
        compound_id=listing.compound_id,
        compound_name=listing.compound.name if listing.compound else "",
        owner_id=listing.owner_id,
        owner_name=listing.owner.name if listing.owner else "",
        category=listing.category,
        title=listing.title,
        description=listing.description,
        price=listing.price,
        currency=listing.currency,
        intent=listing.intent,
        image_urls=listing.image_urls or [],
        status=listing.status,
        created_at=listing.created_at,
    )


# File upload validation constants for marketplace images
ALLOWED_IMAGE_TYPES = {
    "image/jpeg", "image/jpg", "image/png", "image/webp"
}
MAX_IMAGE_SIZE_MB = 5
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024


def validate_image_upload(file_name: str, file_type: str) -> None:
    """Validate image upload for marketplace listings."""
    # Check file type
    if file_type.lower() not in [t.lower() for t in ALLOWED_IMAGE_TYPES]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}"
        )
    
    # Check file extension matches MIME type
    file_ext = file_name.split('.')[-1].lower() if '.' in file_name else ''
    ext_to_mime = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp'
    }
    
    if file_ext and file_ext in ext_to_mime:
        expected_mime = ext_to_mime[file_ext]
        if file_type.lower() != expected_mime.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension '{file_ext}' does not match MIME type '{file_type}'"
            )


@router.post("/images/presign", response_model=PresignResponse)
async def get_listing_image_presigned_url(
    request: ImagePresignRequest,
    current_user: User = Depends(get_current_approved_user),
):
    """Get a pre-signed URL for uploading a listing image."""
    # Validate image upload
    validate_image_upload(request.file_name, request.file_type)
    
    try:
        presigned_url, file_url = generate_presigned_put_url(
            file_name=request.file_name,
            file_type=request.file_type,
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

