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
from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.push import register_push_token, unregister_push_token
from pydantic import BaseModel, Field, field_validator
from typing import Optional

router = APIRouter()


@router.get("", response_model=NotificationListResponse)
@router.get("/", response_model=NotificationListResponse)
async def get_notifications(
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of results"),
    unread_only: bool = Query(
        False, description="Filter to show only unread notifications"
    ),
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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
    current_user: User = Depends(get_current_user),
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


class PushTokenRequest(BaseModel):
    """A device registering itself for push delivery."""

    token: str = Field(min_length=10, max_length=255)
    platform: Optional[str] = Field(default=None, max_length=16)
    device_name: Optional[str] = Field(default=None, max_length=120)

    @field_validator("token")
    @classmethod
    def _validate_token(cls, value: str) -> str:
        token = value.strip()
        # Reject anything that is not an Expo token outright rather than storing
        # junk that will only fail later at send time.
        if not (
            token.startswith("ExponentPushToken[")
            or token.startswith("ExpoPushToken[")
        ) or not token.endswith("]"):
            raise ValueError("Not a valid Expo push token")
        return token


@router.post("/push-tokens", status_code=status.HTTP_204_NO_CONTENT)
async def register_device_push_token(
    request: PushTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register this device to receive push notifications."""
    await register_push_token(
        db,
        current_user.id,
        request.token,
        platform=request.platform,
        device_name=request.device_name,
    )
    return None


@router.delete("/push-tokens", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_device_push_token(
    request: PushTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stop sending push notifications to this device, e.g. on sign-out."""
    await unregister_push_token(db, current_user.id, request.token)
    return None
