"""
Service for creating notifications for various events.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from app.crud.notification import create_notification
from app.schemas.notification import NotificationCreate
from app.models.enums import NotificationType
from app.i18n import get_user_locale
from app.i18n.notifications import notification_text


async def notify_verification_approved(
    db: AsyncSession,
    user_id: int,
) -> None:
    """Create a notification when user verification is approved."""
    locale = await get_user_locale(db, user_id)
    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=user_id,
            type=NotificationType.VERIFICATION_APPROVED,
            title=notification_text(locale, "verification_approved_title"),
            message=notification_text(locale, "verification_approved_body"),
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
    locale = await get_user_locale(db, user_id)
    message = notification_text(locale, "verification_rejected_body")
    if reason:
        message += notification_text(locale, "rejection_reason", reason=reason)

    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=user_id,
            type=NotificationType.VERIFICATION_REJECTED,
            title=notification_text(locale, "verification_rejected_title"),
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
    locale = await get_user_locale(db, user_id)
    message = notification_text(locale, "verification_more_body")
    if details:
        message += notification_text(locale, "more_details", details=details)

    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=user_id,
            type=NotificationType.VERIFICATION_REQUEST_MORE,
            title=notification_text(locale, "verification_more_title"),
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
    locale = await get_user_locale(db, user_id)
    message = notification_text(locale, "new_message_body", name=sender_name)
    if preview:
        trimmed = preview[:50] + ("..." if len(preview) > 50 else "")
        message += notification_text(locale, "new_message_preview", preview=trimmed)

    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=user_id,
            type=NotificationType.MESSAGE,
            title=notification_text(locale, "new_message_title", name=sender_name),
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
    locale = await get_user_locale(db, listing_owner_id)
    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=listing_owner_id,
            type=NotificationType.LISTING_INQUIRY,
            title=notification_text(locale, "listing_inquiry_title", title=listing_title),
            message=notification_text(
                locale, "listing_inquiry_body", name=inquirer_name
            ),
            related_id=listing_id,
            related_type="listing",
            extra_data={"inquirer_name": inquirer_name, "listing_title": listing_title},
        ),
    )
