from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
    NotificationUpdate,
)
from app.crud.notification import (
    get_user_notifications,
    mark_notification_read,
    mark_all_notifications_read,
    delete_notification,
)
from app.core.dependencies import get_current_approved_user
from app.models.user import User
from typing import Optional

router = APIRouter()


@router.get("", response_model=NotificationListResponse)
async def get_notifications(
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    unread_only: bool = Query(False, description="Filter to show only unread notifications"),
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Get notifications for the current user."""
    notifications, total, unread_count = await get_user_notifications(
        db=db,
        user_id=current_user.id,
        skip=skip,
        limit=limit,
        unread_only=unread_only,
    )
    
    return NotificationListResponse(
        items=[NotificationResponse.model_validate(n) for n in notifications],
        total=total,
        unread_count=unread_count,
        skip=skip,
        limit=limit,
    )


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the count of unread notifications for the current user."""
    _, _, unread_count = await get_user_notifications(
        db=db,
        user_id=current_user.id,
        skip=0,
        limit=1,
        unread_only=True,
    )
    
    return {"unread_count": unread_count}


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(
    notification_id: int,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a notification as read."""
    notification = await mark_notification_read(
        db=db,
        notification_id=notification_id,
        user_id=current_user.id,
    )
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    
    return NotificationResponse.model_validate(notification)


@router.post("/mark-all-read")
async def mark_all_read(
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read for the current user."""
    count = await mark_all_notifications_read(
        db=db,
        user_id=current_user.id,
    )
    
    return {"message": f"Marked {count} notifications as read", "count": count}


@router.delete("/{notification_id}")
async def delete_notification_endpoint(
    notification_id: int,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a notification."""
    deleted = await delete_notification(
        db=db,
        notification_id=notification_id,
        user_id=current_user.id,
    )
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )
    
    return {"message": "Notification deleted"}

