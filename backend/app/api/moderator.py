from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.crud.post import delete_post, get_post_by_id, restore_post
from app.crud.user import get_user_by_id, update_user_status
from app.crud.listing import get_listing_by_id, archive_listing, restore_listing
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
    """Soft delete a post (hide it, but don't actually delete - moderators and admins only)."""
    # Verify post exists (include deleted posts for checking)
    post = await get_post_by_id(db, post_id, include_deleted=True)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    # Moderators can only delete posts from their compound
    if current_user.role == "COMPOUND_MOD" and current_user.compound_id != post.compound_id:
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
    return {"message": "Post hidden successfully (soft deleted)"}


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
    if current_user.role == "COMPOUND_MOD" and current_user.compound_id != user.compound_id:
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
    """Soft delete a listing (hide it, but don't actually delete - moderators and admins only)."""
    # Verify listing exists (include deleted listings for checking)
    listing = await get_listing_by_id(db, listing_id, include_deleted=True)
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
    if current_user.role == "COMPOUND_MOD" and current_user.compound_id != owner.compound_id:
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
    return {"message": "Listing hidden successfully (soft deleted)"}


@router.post("/posts/{post_id}/restore")
async def restore_post_endpoint(
    post_id: int,
    current_user: User = Depends(get_current_moderator_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Restore a soft-deleted post (moderators and admins only)."""
    # Verify post exists (include deleted posts)
    post = await get_post_by_id(db, post_id, include_deleted=True)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    if post.deleted_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Post is not deleted"
        )
    
    # Moderators can only restore posts from their compound
    if current_user.role == "COMPOUND_MOD" and current_user.compound_id != post.compound_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only restore posts from your own compound"
        )
    
    success = await restore_post(db, post_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found or not deleted"
        )
    
    await db.commit()
    return {"message": "Post restored successfully"}


@router.post("/listings/{listing_id}/restore")
async def restore_listing_endpoint(
    listing_id: int,
    current_user: User = Depends(get_current_moderator_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Restore a soft-deleted listing (moderators and admins only)."""
    # Verify listing exists (include deleted listings)
    listing = await get_listing_by_id(db, listing_id, include_deleted=True)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )
    
    if listing.deleted_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Listing is not deleted"
        )
    
    # Get listing owner to check compound
    owner = await get_user_by_id(db, listing.owner_id)
    if not owner:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing owner not found"
        )
    
    # Moderators can only restore listings from their compound
    if current_user.role == "COMPOUND_MOD" and current_user.compound_id != owner.compound_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only restore listings from your own compound"
        )
    
    success = await restore_listing(db, listing_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found or not deleted"
        )
    
    await db.commit()
    return {"message": "Listing restored successfully"}

