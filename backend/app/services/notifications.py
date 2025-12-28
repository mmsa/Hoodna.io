"""
Service for creating notifications for various events.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud.notification import create_notification
from app.schemas.notification import NotificationCreate
from app.models.enums import NotificationType


async def notify_verification_approved(
    db: AsyncSession,
    user_id: int,
) -> None:
    """Create a notification when user verification is approved."""
    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=user_id,
            type=NotificationType.VERIFICATION_APPROVED,
            title="Verification Approved! ✅",
            message="Your account has been verified. You can now post, comment, and create listings in your community.",
            related_type="verification",
            extra_data={"action": "approved"},
        ),
    )


async def notify_verification_rejected(
    db: AsyncSession,
    user_id: int,
    reason: str | None = None,
) -> None:
    """Create a notification when user verification is rejected."""
    message = "Your verification documents were rejected."
    if reason:
        message += f" Reason: {reason}"
    
    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=user_id,
            type=NotificationType.VERIFICATION_REJECTED,
            title="Verification Rejected",
            message=message,
            related_type="verification",
            extra_data={"action": "rejected", "reason": reason},
        ),
    )


async def notify_verification_request_more(
    db: AsyncSession,
    user_id: int,
    details: str | None = None,
) -> None:
    """Create a notification when more verification details are requested."""
    message = "We need more information to verify your account."
    if details:
        message += f" {details}"
    
    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=user_id,
            type=NotificationType.VERIFICATION_REQUEST_MORE,
            title="More Information Needed",
            message=message,
            related_type="verification",
            extra_data={"action": "request_more", "details": details},
        ),
    )


async def notify_new_message(
    db: AsyncSession,
    user_id: int,
    sender_name: str,
    conversation_id: int,
    preview: str | None = None,
) -> None:
    """Create a notification when a user receives a new message."""
    message = f"You received a new message from {sender_name}."
    if preview:
        message += f" \"{preview[:50]}{'...' if len(preview) > 50 else ''}\""
    
    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=user_id,
            type=NotificationType.MESSAGE,
            title=f"New message from {sender_name}",
            message=message,
            related_id=conversation_id,
            related_type="message",
            extra_data={"sender_name": sender_name, "preview": preview},
        ),
    )


async def notify_listing_inquiry(
    db: AsyncSession,
    listing_owner_id: int,
    inquirer_name: str,
    listing_id: int,
    listing_title: str,
) -> None:
    """Create a notification when someone inquires about a listing."""
    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=listing_owner_id,
            type=NotificationType.LISTING_INQUIRY,
            title=f"New inquiry for {listing_title}",
            message=f"{inquirer_name} is interested in your listing.",
            related_id=listing_id,
            related_type="listing",
            extra_data={"inquirer_name": inquirer_name, "listing_title": listing_title},
        ),
    )

