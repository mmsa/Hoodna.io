from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.crud.post import delete_post, get_post_by_id
from app.crud.user import get_user_by_id, update_user_status
from app.crud.listing import get_listing_by_id, archive_listing
from app.core.dependencies import get_current_moderator_or_admin
from app.models.user import User
from app.models.enums import UserStatus
from pydantic import BaseModel

router = APIRouter()


class BanUserRequest(BaseModel):
    reason: str | None = None


@router.delete("/posts/{post_id}")
async def delete_post_endpoint(
    post_id: int,
    current_user: User = Depends(get_current_moderator_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a post (moderators and admins only)."""
    # Verify post exists
    post = await get_post_by_id(db, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    # Moderators can only delete posts from their compound
    if current_user.role == "MODERATOR" and current_user.compound_id != post.compound_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete posts from your own compound"
        )
    
    success = await delete_post(db, post_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    await db.commit()
    return {"message": "Post deleted successfully"}


@router.post("/users/{user_id}/ban")
async def ban_user_endpoint(
    user_id: int,
    ban_data: BanUserRequest,
    current_user: User = Depends(get_current_moderator_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Ban a user (moderators and admins only)."""
    # Verify user exists
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent banning yourself
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot ban yourself"
        )
    
    # Prevent banning admins (unless you're an admin)
    if user.role == "ADMIN" and current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can ban other admins"
        )
    
    # Moderators can only ban users from their compound
    if current_user.role == "MODERATOR" and current_user.compound_id != user.compound_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only ban users from your own compound"
        )
    
    # Ban the user
    updated_user = await update_user_status(
        db=db,
        user_id=user_id,
        status=UserStatus.BANNED,
        reviewer_id=current_user.id
    )
    
    await db.commit()
    
    return {
        "message": "User banned successfully",
        "user": {
            "id": updated_user.id,
            "name": updated_user.name,
            "email": updated_user.email,
            "status": updated_user.status.value,
        }
    }


@router.delete("/listings/{listing_id}")
async def delete_listing_endpoint(
    listing_id: int,
    current_user: User = Depends(get_current_moderator_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete/archive a listing (moderators and admins only)."""
    # Verify listing exists
    listing = await get_listing_by_id(db, listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )
    
    # Get listing owner to check compound
    owner = await get_user_by_id(db, listing.owner_id)
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing owner not found"
        )
    
    # Moderators can only delete listings from their compound
    if current_user.role == "MODERATOR" and current_user.compound_id != owner.compound_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete listings from your own compound"
        )
    
    success = await archive_listing(db, listing_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )
    
    await db.commit()
    return {"message": "Listing deleted successfully"}

