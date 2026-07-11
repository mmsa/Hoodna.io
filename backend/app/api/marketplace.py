from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import logging
from app.db.session import get_db

logger = logging.getLogger(__name__)
from app.schemas.marketplace import (
    ListingCreate,
    ListingUpdate,
    ListingResponse,
    PromotionCheckout,
    CheckoutSessionResponse,
)
from app.schemas.verification import PresignResponse
from app.crud.listing import (
    get_listings,
    get_listing_by_id,
    create_listing,
    update_listing,
)
from app.crud.saved_listing import is_listing_saved
from app.core.dependencies import get_current_approved_user, get_current_user_optional, get_current_user
from app.services.s3 import generate_presigned_put_url, sign_file_urls
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
    category: Optional[str] = None,
    intent: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Get listings based on scope (compound, cross, public). Public read, but requires auth for compound scope."""
    from app.models.enums import ListingCategory, ListingIntent
    from app.core.verification_helpers import is_user_verified_for_compound
    
    # Handle different scopes
    compound_id = None
    owner_id = None
    
    if scope == "my":
        # Get user's own listings (for service providers)
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required for 'my' scope"
            )
        owner_id = current_user.id
        logger.info(f"[MarketplaceAPI] scope=my: fetching listings for owner_id={owner_id}")
    elif scope == "compound":
        # For compound scope, user must be authenticated and verified for the compound
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required for compound scope"
            )
        
        # Get compound_id - for moderators, use their profile's compound_id
        from app.models.enums import UserRole
        effective_compound_id = current_user.compound_id
        
        if current_user.role == UserRole.COMPOUND_MOD:
            from app.crud.moderator import get_moderator_profile
            from app.models.enums import ModeratorStatus
            moderator_profile = await get_moderator_profile(db, current_user.id)
            if not moderator_profile or moderator_profile.moderator_status != ModeratorStatus.APPROVED:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Your moderator profile must be approved to access the marketplace."
                )
            if not moderator_profile.compound_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Moderator must have a compound assigned"
                )
            effective_compound_id = moderator_profile.compound_id
        
        if not effective_compound_id:
            # Check if user is a service provider - suggest using scope=my
            if current_user.role == UserRole.SERVICE_PROVIDER:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Service providers should use scope=my to view their own listings. Use scope=my instead of scope=compound."
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must select a compound first"
            )
        
        # Check if user is verified for this compound (skip for moderators as they're already checked)
        if current_user.role != UserRole.COMPOUND_MOD:
            is_verified = await is_user_verified_for_compound(
                db=db,
                user=current_user,
                compound_id=effective_compound_id
            )
            
            if not is_verified:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You must be verified for this compound to access its marketplace. Please complete verification first."
                )
        
        compound_id = effective_compound_id
    
    # Parse category and intent filters
    category_filter = None
    if category:
        try:
            category_filter = ListingCategory[category.upper()]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category: {category}. Valid values: PROPERTY, CAR, ITEM, SERVICE"
            )
    
    intent_filter = None
    if intent:
        try:
            intent_filter = ListingIntent[intent.upper()]
        except KeyError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid intent: {intent}. Valid values: SELL, RENT"
            )
    
    # Validate sort_by
    valid_sorts = ["price_asc", "price_desc", "date_asc", "date_desc"]
    if sort_by and sort_by not in valid_sorts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid sort_by: {sort_by}. Valid values: {', '.join(valid_sorts)}"
        )

    listings = await get_listings(
        db=db,
        compound_id=compound_id,
        owner_id=owner_id,
        scope=scope,
        skip=skip,
        limit=limit,
        category=category_filter,
        intent=intent_filter,
        search=search,
        sort_by=sort_by,
        min_price=min_price,
        max_price=max_price,
    )

    # Import review stats function
    from app.crud.review import get_listing_rating_stats
    
    result = []
    for listing in listings:
        # Get rating stats for this listing
        stats = await get_listing_rating_stats(db, listing.id)
        
        result.append(
            ListingResponse(
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
                image_urls=sign_file_urls(listing.image_urls or []),
                status=listing.status,
                created_at=listing.created_at,
                average_rating=stats.get('average_rating'),
                review_count=stats.get('review_count', 0),
            )
        )

    return result


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(
    listing_id: int,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """Get a specific listing. For compound listings, user must be verified for that compound.
    Owners can always view their own listings."""
    from app.core.verification_helpers import is_user_verified_for_compound
    from app.models.enums import UserRole
    from app.models.enums import ProviderStatus
    
    listing = await get_listing_by_id(db, listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Listing not found"
        )

    # If listing is from a compound, check if user is verified for that compound
    # Exception: Owners can always view their own listings
    if listing.compound_id and current_user:
        # Allow owners to view their own listings
        is_owner = listing.owner_id == current_user.id
        
        # For service providers, also check if they have an approved profile
        is_approved_provider = False
        if not is_owner and current_user.role == UserRole.SERVICE_PROVIDER:
            from app.crud.provider import get_provider_profile
            provider_profile = await get_provider_profile(db, current_user.id)
            if provider_profile and provider_profile.provider_status == ProviderStatus.APPROVED:
                is_approved_provider = True
        
        if not is_owner and not is_approved_provider:
            is_verified = await is_user_verified_for_compound(
                db=db,
                user=current_user,
                compound_id=listing.compound_id
            )
            if not is_verified:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You must be verified for this compound to view its marketplace listings. Please complete verification first."
                )

    # Include owner contact info (email and phone) only for authenticated approved users
    owner_email = None
    owner_phone = None
    if current_user and current_user.status.value == "APPROVED":
        owner_email = listing.owner.email if listing.owner else None
        owner_phone = listing.owner.phone if listing.owner else None

    # Check if listing is saved by current user (only if authenticated)
    is_saved = False
    if current_user:
        is_saved = await is_listing_saved(db, current_user.id, listing_id)

    # Get rating stats for this listing
    from app.crud.review import get_listing_rating_stats
    stats = await get_listing_rating_stats(db, listing_id)

    response = ListingResponse(
        id=listing.id,
        compound_id=listing.compound_id,
        compound_name=listing.compound.name,
        owner_id=listing.owner_id,
        owner_name=listing.owner.name,
        owner_email=owner_email,
        owner_phone=owner_phone,
        category=listing.category,
        title=listing.title,
        description=listing.description,
        price=listing.price,
        currency=listing.currency,
        intent=listing.intent,
        image_urls=sign_file_urls(listing.image_urls or []),
        status=listing.status,
        created_at=listing.created_at,
        average_rating=stats.get('average_rating'),
        review_count=stats.get('review_count', 0),
    )

    # Add saved status to response (using model_dump and adding field)
    response_dict = response.model_dump()
    response_dict["is_saved"] = is_saved
    return response_dict


@router.post("", response_model=ListingResponse, status_code=status.HTTP_201_CREATED)
async def create_listing_endpoint(
    listing_data: ListingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new listing. User must be verified for the compound."""
    from app.core.verification_helpers import is_user_verified_for_compound
    from app.models.enums import UserRole, ListingCategory, UserStatus
    from app.crud.provider import get_provider_profile
    from app.models.enums import ProviderStatus
    from sqlalchemy import select, func
    from app.models.listing import Listing
    from app.models.enums import ListingStatus
    
    # Service provider restrictions
    if current_user.role == UserRole.SERVICE_PROVIDER:
        # Service providers can only create SERVICE listings
        if listing_data.category != ListingCategory.SERVICE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Service providers can only create SERVICE listings"
            )
        
        # Check provider profile and status
        provider_profile = await get_provider_profile(db, current_user.id)
        if not provider_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider profile not found"
            )
        
        if provider_profile.provider_status != ProviderStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your provider profile must be approved to create service listings"
            )
        
        # Check listing limit
        max_listings = provider_profile.max_listings or 3  # Default to 3 if not set
        existing_count_result = await db.execute(
            select(func.count(Listing.id)).where(
                Listing.owner_id == current_user.id,
                Listing.category == ListingCategory.SERVICE,
                Listing.status == ListingStatus.ACTIVE
            )
        )
        existing_count = existing_count_result.scalar_one() or 0
        
        if existing_count >= max_listings:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You have reached your maximum limit of {max_listings} service listings. Please delete an existing listing or contact admin to increase your limit."
            )
        
        logger.info(f"[MarketplaceAPI] Service provider {current_user.id} creating listing. Current: {existing_count}/{max_listings}")
    
    # Ensure user has a compound selected (for non-service providers or service providers with compound)
    if not current_user.compound_id:
        # Service providers might not have compound_id, use first service area compound
        if current_user.role == UserRole.SERVICE_PROVIDER:
            provider_profile = provider_profile or await get_provider_profile(db, current_user.id)
            if provider_profile and provider_profile.service_area_compound_ids:
                # Use first compound from service area
                compound_id_to_use = provider_profile.service_area_compound_ids[0]
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Service provider must have at least one service area compound configured"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must select a compound first"
            )
    else:
        compound_id_to_use = current_user.compound_id
    
    # For marketplace items (non-SERVICE listings), only verified APPROVED residents can post
    if listing_data.category != ListingCategory.SERVICE:
        # Only residents can post marketplace items (not moderators, admins, or service providers)
        if current_user.role != UserRole.RESIDENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only verified residents can post marketplace items. Service providers can only post services."
            )
        
        # Check if user is verified and approved for their compound
        if current_user.status != UserStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be approved to create marketplace listings. Please complete verification first."
            )
        
        is_verified = await is_user_verified_for_compound(
            db=db,
            user=current_user,
            compound_id=compound_id_to_use
        )
        
        if not is_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be verified for this compound to create marketplace listings. Please complete verification first."
            )

    listing = await create_listing(
        db=db,
        compound_id=compound_id_to_use,
        owner_id=current_user.id,
        listing_data=listing_data,
    )
    
    # Auto-activate listings for service providers (they're already approved)
    if current_user.role == UserRole.SERVICE_PROVIDER:
        listing.status = ListingStatus.ACTIVE
        await db.commit()
        await db.refresh(listing)

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
        image_urls=sign_file_urls(listing.image_urls or []),
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
    """Update a listing (only by owner).
    
    For service providers:
    - Cannot change category (must remain SERVICE)
    - Cannot change compound_id (service areas are managed via change requests)
    """
    from app.models.enums import UserRole, ListingCategory
    
    # Get existing listing to check restrictions
    listing = await get_listing_by_id(db, listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )
    
    # Check ownership
    if listing.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own listings"
        )
    
    # Service provider restrictions
    if current_user.role == UserRole.SERVICE_PROVIDER:
        update_dict = listing_data.model_dump(exclude_unset=True)
        
        # Cannot change category - must remain SERVICE
        if 'category' in update_dict and update_dict['category'] != ListingCategory.SERVICE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Service providers cannot change listing category. It must remain SERVICE."
            )
        
        # Ensure category is SERVICE if not explicitly set
        if listing.category != ListingCategory.SERVICE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Service providers can only manage SERVICE listings"
            )
    
    try:
        listing = await update_listing(
            db=db,
            listing_id=listing_id,
            listing_data=listing_data,
            owner_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=(
                status.HTTP_404_NOT_FOUND
                if "not found" in str(e).lower()
                else status.HTTP_403_FORBIDDEN
            ),
            detail=str(e),
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
        image_urls=sign_file_urls(listing.image_urls or []),
        status=listing.status,
        created_at=listing.created_at,
    )


@router.delete("/{listing_id}")
async def delete_listing_endpoint(
    listing_id: int,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a listing (only by owner)."""
    from app.crud.listing import archive_listing
    
    listing = await get_listing_by_id(db, listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )
    
    # Only owner can delete
    if listing.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own listings"
        )
    
    success = await archive_listing(db, listing_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )
    
    await db.commit()
    return {"message": "Listing deleted successfully"}


# File upload validation constants for marketplace images
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
MAX_IMAGE_SIZE_MB = 5
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024


def validate_image_upload(file_name: str, file_type: str) -> None:
    """Validate image upload for marketplace listings."""
    # Check file type
    if file_type.lower() not in [t.lower() for t in ALLOWED_IMAGE_TYPES]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}",
        )

    # Check file extension matches MIME type
    file_ext = file_name.split(".")[-1].lower() if "." in file_name else ""
    ext_to_mime = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
    }

    if file_ext and file_ext in ext_to_mime:
        expected_mime = ext_to_mime[file_ext]
        if file_type.lower() != expected_mime.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension '{file_ext}' does not match MIME type '{file_type}'",
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
            folder="listings",
            user_id=current_user.id,
        )
        return PresignResponse(presigned_url=presigned_url, file_url=file_url)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate presigned URL: {str(e)}",
        )
