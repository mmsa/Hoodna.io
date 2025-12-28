from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.models.notification import Notification
from app.models.enums import NotificationType
from app.schemas.notification import NotificationCreate
from typing import Optional


async def create_notification(
    db: AsyncSession,
    notification_data: NotificationCreate,
) -> Notification:
    """Create a new notification."""
    notification = Notification(
        user_id=notification_data.user_id,
        type=notification_data.type,
        title=notification_data.title,
        message=notification_data.message,
        related_id=notification_data.related_id,
        related_type=notification_data.related_type,
        metadata=notification_data.metadata,
    )
    db.add(notification)
    await db.flush()
    await db.refresh(notification)
    return notification


async def get_user_notifications(
    db: AsyncSession,
    user_id: int,
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
) -> tuple[list[Notification], int, int]:
    """
    Get notifications for a user.
    Returns (notifications, total_count, unread_count).
    """
    # Base query
    query = select(Notification).where(Notification.user_id == user_id)
    count_query = select(func.count()).select_from(Notification).where(Notification.user_id == user_id)
    
    # Filter by read status if needed
    if unread_only:
        query = query.where(Notification.read == False)
        count_query = count_query.where(Notification.read == False)
    
    # Get unread count
    unread_query = select(func.count()).select_from(Notification).where(
        Notification.user_id == user_id,
        Notification.read == False
    )
    unread_result = await db.execute(unread_query)
    unread_count = unread_result.scalar() or 0
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply ordering and pagination
    query = query.order_by(desc(Notification.created_at))
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    notifications = list(result.scalars().all())
    
    return notifications, total, unread_count


async def mark_notification_read(
    db: AsyncSession,
    notification_id: int,
    user_id: int,
) -> Optional[Notification]:
    """Mark a notification as read."""
    notification = await db.get(Notification, notification_id)
    if not notification or notification.user_id != user_id:
        return None
    
    notification.read = True
    from datetime import datetime
    notification.read_at = datetime.utcnow()
    
    await db.flush()
    await db.refresh(notification)
    return notification


async def mark_all_notifications_read(
    db: AsyncSession,
    user_id: int,
) -> int:
    """Mark all notifications as read for a user. Returns count of updated notifications."""
    from datetime import datetime
    
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.read == False
        )
    )
    notifications = result.scalars().all()
    
    count = 0
    for notification in notifications:
        notification.read = True
        notification.read_at = datetime.utcnow()
        count += 1
    
    await db.flush()
    return count


async def delete_notification(
    db: AsyncSession,
    notification_id: int,
    user_id: int,
) -> bool:
    """Delete a notification. Returns True if deleted, False if not found or unauthorized."""
    notification = await db.get(Notification, notification_id)
    if not notification or notification.user_id != user_id:
        return False
    
    await db.delete(notification)
    await db.flush()
    return True

