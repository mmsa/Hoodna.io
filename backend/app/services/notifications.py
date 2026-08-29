"""Service for creating in-app notifications for community events."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.notification import create_notification
from app.i18n import get_user_locale
from app.i18n.notifications import notification_text
from app.models.enums import NotificationType, UserStatus
from app.models.user import User
from app.schemas.notification import NotificationCreate

# Cap compound-wide fan-out so large groups don't stall a request
COMPOUND_NOTIFY_CAP = 200


def _preview(text: str | None, limit: int = 80) -> str:
    cleaned = (text or "").strip().replace("\n", " ")
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1].rstrip() + "…"


async def _compound_recipient_ids(
    db: AsyncSession,
    compound_id: int,
    *,
    exclude_user_id: int,
) -> list[int]:
    result = await db.execute(
        select(User.id)
        .where(
            User.compound_id == compound_id,
            User.id != exclude_user_id,
            User.status == UserStatus.APPROVED,
        )
        .order_by(User.id.desc())
        .limit(COMPOUND_NOTIFY_CAP)
    )
    return list(result.scalars().all())


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
        message += notification_text(
            locale, "new_message_preview", preview=_preview(preview, 50)
        )

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
    if listing_owner_id <= 0:
        return
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


async def notify_listing_saved(
    db: AsyncSession,
    listing_owner_id: int,
    saver_name: str,
    listing_id: int,
    listing_title: str,
) -> None:
    """Notify listing owner when someone saves their listing."""
    if listing_owner_id <= 0:
        return
    locale = await get_user_locale(db, listing_owner_id)
    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=listing_owner_id,
            type=NotificationType.LISTING_SAVED,
            title=notification_text(locale, "listing_saved_title"),
            message=notification_text(
                locale,
                "listing_saved_body",
                name=saver_name,
                title=listing_title,
            ),
            related_id=listing_id,
            related_type="listing",
            extra_data={"saver_name": saver_name, "listing_title": listing_title},
        ),
    )


async def notify_comment_on_post(
    db: AsyncSession,
    *,
    post_author_id: int,
    commenter_id: int,
    commenter_name: str,
    post_id: int,
    comment_id: int,
    comment_content: str,
) -> None:
    """Notify post author about a new comment (skips self-comments)."""
    if post_author_id == commenter_id:
        return
    locale = await get_user_locale(db, post_author_id)
    preview = _preview(comment_content)
    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=post_author_id,
            type=NotificationType.COMMENT,
            title=notification_text(locale, "comment_title"),
            message=notification_text(
                locale, "comment_body", name=commenter_name, preview=preview
            ),
            related_id=post_id,
            related_type="post",
            extra_data={
                "comment_id": comment_id,
                "commenter_id": commenter_id,
                "commenter_name": commenter_name,
            },
        ),
    )


async def notify_post_reaction(
    db: AsyncSession,
    *,
    post_author_id: int,
    reactor_id: int,
    reactor_name: str,
    post_id: int,
    reaction: str,
) -> None:
    """Notify post author when someone reacts (skips self-reactions)."""
    if post_author_id == reactor_id:
        return
    locale = await get_user_locale(db, post_author_id)
    await create_notification(
        db=db,
        notification_data=NotificationCreate(
            user_id=post_author_id,
            type=NotificationType.POST_LIKE,
            title=notification_text(locale, "post_like_title", name=reactor_name),
            message=notification_text(locale, "post_like_body", name=reactor_name),
            related_id=post_id,
            related_type="post",
            extra_data={
                "reactor_id": reactor_id,
                "reactor_name": reactor_name,
                "reaction": reaction,
            },
        ),
    )


async def notify_new_post_in_compound(
    db: AsyncSession,
    *,
    compound_id: int,
    author_id: int,
    author_name: str,
    post_id: int,
    content: str,
) -> None:
    """Fan out a 'neighbour shared' notification to compound members."""
    preview = _preview(content)
    recipient_ids = await _compound_recipient_ids(
        db, compound_id, exclude_user_id=author_id
    )
    for user_id in recipient_ids:
        locale = await get_user_locale(db, user_id)
        await create_notification(
            db=db,
            notification_data=NotificationCreate(
                user_id=user_id,
                type=NotificationType.NEW_POST,
                title=notification_text(locale, "new_post_title"),
                message=notification_text(
                    locale, "new_post_body", name=author_name, preview=preview
                ),
                related_id=post_id,
                related_type="post",
                extra_data={"author_id": author_id, "author_name": author_name},
            ),
        )


async def notify_new_listing_in_compound(
    db: AsyncSession,
    *,
    compound_id: int,
    owner_id: int,
    owner_name: str,
    listing_id: int,
    listing_title: str,
) -> None:
    """Fan out a marketplace listing notification to compound members."""
    recipient_ids = await _compound_recipient_ids(
        db, compound_id, exclude_user_id=owner_id
    )
    for user_id in recipient_ids:
        locale = await get_user_locale(db, user_id)
        await create_notification(
            db=db,
            notification_data=NotificationCreate(
                user_id=user_id,
                type=NotificationType.NEW_LISTING,
                title=notification_text(locale, "new_listing_title"),
                message=notification_text(
                    locale,
                    "new_listing_body",
                    name=owner_name,
                    title=listing_title,
                ),
                related_id=listing_id,
                related_type="listing",
                extra_data={
                    "owner_id": owner_id,
                    "owner_name": owner_name,
                    "listing_title": listing_title,
                },
            ),
        )
