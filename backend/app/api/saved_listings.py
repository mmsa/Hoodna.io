from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.marketplace import ListingResponse, sanitize_listing_attributes
from app.crud.saved_listing import (
    save_listing,
    unsave_listing,
    is_listing_saved,
    get_saved_listings,
)
from app.crud.listing import get_listing_by_id
from app.core.dependencies import get_current_approved_user
from app.models.user import User
from app.services.s3 import sign_file_urls
from typing import List

router = APIRouter()


@router.post("/listings/{listing_id}/save")
async def save_listing_endpoint(
    listing_id: int,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a listing to user's saved list."""
    # Verify listing exists
    listing = await get_listing_by_id(db, listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )
    
    saved = await save_listing(db, current_user.id, listing_id)

    if listing.owner_id != current_user.id:
        from app.services.notifications import notify_listing_saved

        await notify_listing_saved(
            db,
            listing_owner_id=listing.owner_id,
            saver_name=current_user.name or "Neighbour",
            listing_id=listing.id,
            listing_title=listing.title or "Listing",
        )

    await db.commit()
    
    return {"message": "Listing saved successfully", "saved": True}


@router.delete("/listings/{listing_id}/save")
async def unsave_listing_endpoint(
    listing_id: int,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a listing from user's saved list."""
    removed = await unsave_listing(db, current_user.id, listing_id)
    await db.commit()
    
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found in saved list"
        )
    
    return {"message": "Listing removed from saved list", "saved": False}


@router.get("/listings/{listing_id}/saved")
async def check_listing_saved(
    listing_id: int,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if a listing is saved by the current user."""
    saved = await is_listing_saved(db, current_user.id, listing_id)
    return {"saved": saved}


@router.get("/saved-listings", response_model=List[ListingResponse])
async def get_saved_listings_endpoint(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all saved listings for the current user."""
    listings = await get_saved_listings(db, current_user.id, skip=skip, limit=limit)
    
    # Convert to response format
    result = []
    for listing in listings:
        result.append(ListingResponse(
            id=listing.id,
            compound_id=listing.compound_id,
            compound_name=listing.compound.name,
            owner_id=listing.owner_id,
            owner_name=listing.owner.name,
            owner_email=None,  # Don't expose owner email in list view
            owner_phone=None,  # Don't expose owner phone in list view
            category=listing.category,
            title=listing.title,
            description=listing.description,
            price=listing.price,
            currency=listing.currency,
            intent=listing.intent,
            attributes=sanitize_listing_attributes(listing.category, listing.attributes),
            image_urls=sign_file_urls(listing.image_urls or [], user_id=current_user.id),
            status=listing.status,
            created_at=listing.created_at,
        ))
    
    return result

