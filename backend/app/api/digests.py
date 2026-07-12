from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.digest import DigestDelivery, DigestRun
from app.models.enums import DigestChannel, DigestDeliveryStatus, NotificationType
from app.models.notification import Notification
from app.models.user import User


router = APIRouter()


@router.get("/me/latest")
async def get_latest_digest(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    delivery = await db.scalar(
        select(DigestDelivery)
        .join(DigestRun, DigestRun.id == DigestDelivery.digest_run_id)
        .where(
            DigestDelivery.user_id == current_user.id,
            DigestDelivery.channel == DigestChannel.IN_APP,
            DigestDelivery.status == DigestDeliveryStatus.SENT,
        )
        .order_by(DigestRun.period_end.desc(), DigestDelivery.id.desc())
        .limit(1)
    )
    if delivery is None or not delivery.content_summary:
        return None

    notification_id = await db.scalar(
        select(Notification.id)
        .where(
            Notification.user_id == current_user.id,
            Notification.type == NotificationType.WEEKLY_DIGEST,
            Notification.related_type == "digest",
            Notification.related_id == delivery.id,
        )
        .order_by(Notification.id.desc())
        .limit(1)
    )
    return {
        **delivery.content_summary,
        "id": delivery.id,
        "notification_id": notification_id,
    }
