"""Personalized, retry-safe weekly in-app digests."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import desc, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.business import IndependentBusiness
from app.models.digest import DigestDelivery, DigestRun
from app.models.enums import (
    DigestChannel,
    DigestDeliveryStatus,
    DigestFrequency,
    DigestRunStatus,
    NotificationType,
    PostCategory,
    UserStatus,
)
from app.models.launch_accounts import UserPreference
from app.models.notification import Notification
from app.models.post import Comment, Post, PostReaction
from app.models.user import User
from app.services.feature_flags import is_feature_enabled

logger = logging.getLogger(__name__)


def weekly_period(now: datetime | None = None) -> tuple[datetime, datetime]:
    """Return the most recently completed Monday-to-Monday UTC period."""
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    current_midnight = current.replace(hour=0, minute=0, second=0, microsecond=0)
    period_end = current_midnight - timedelta(days=current_midnight.weekday())
    return period_end - timedelta(days=7), period_end


def _preference_enabled(
    preference: UserPreference | None, key: str, default: bool = True
) -> bool:
    values = preference.preferences if preference and preference.preferences else {}
    value = values.get(key, default)
    return value if isinstance(value, bool) else default


def _post_item(post: Post, author_name: str | None = None) -> dict[str, Any]:
    category = post.category.value if hasattr(post.category, "value") else str(post.category)
    return {
        "id": post.id,
        "category": category,
        "author_name": author_name,
        "created_at": post.created_at.isoformat(),
    }


def _business_item(business: IndependentBusiness) -> dict[str, Any]:
    return {
        "id": business.id,
        "slug": business.slug,
        "name": business.name,
        "category": business.category,
        "city": business.city,
        "area": business.area,
    }


async def build_weekly_summary(
    db: AsyncSession,
    user: User,
    preference: UserPreference | None,
    period_start: datetime,
    period_end: datetime,
) -> dict[str, Any]:
    """Build digest content scoped to the user's primary neighbourhood."""
    compound_id = user.compound_id
    if compound_id is None:
        return {}

    engagement = func.count(func.distinct(Comment.id)) + func.count(
        func.distinct(PostReaction.id)
    )
    popular_rows = (
        await db.execute(
            select(Post, User.name)
            .join(User, User.id == Post.author_id)
            .outerjoin(Comment, Comment.post_id == Post.id)
            .outerjoin(PostReaction, PostReaction.post_id == Post.id)
            .where(
                Post.compound_id == compound_id,
                Post.deleted_at.is_(None),
                Post.created_at >= period_start,
                Post.created_at < period_end,
                Post.category.notin_(
                    [PostCategory.ANNOUNCEMENT, PostCategory.ALERT]
                ),
            )
            .group_by(Post.id, User.name)
            .order_by(desc(engagement), desc(Post.created_at))
            .limit(settings.WEEKLY_DIGEST_MAX_POSTS)
        )
    ).all()

    businesses = (
        (
            await db.execute(
                select(IndependentBusiness)
                .where(
                    IndependentBusiness.compound_id == compound_id,
                    IndependentBusiness.is_active.is_(True),
                    IndependentBusiness.is_hidden.is_(False),
                    IndependentBusiness.created_at >= period_start,
                    IndependentBusiness.created_at < period_end,
                )
                .order_by(desc(IndependentBusiness.created_at))
                .limit(settings.WEEKLY_DIGEST_MAX_BUSINESSES)
            )
        )
        .scalars()
        .all()
    )

    announcements: list[tuple[Post, str]] = []
    if _preference_enabled(preference, "community_announcements"):
        announcements = (
            await db.execute(
                select(Post, User.name)
                .join(User, User.id == Post.author_id)
                .where(
                    Post.compound_id == compound_id,
                    Post.deleted_at.is_(None),
                    Post.created_at >= period_start,
                    Post.created_at < period_end,
                    or_(
                        Post.category.in_(
                            [PostCategory.ANNOUNCEMENT, PostCategory.ALERT]
                        ),
                        Post.is_urgent.is_(True),
                    ),
                )
                .order_by(desc(Post.is_urgent), desc(Post.created_at))
                .limit(settings.WEEKLY_DIGEST_MAX_ANNOUNCEMENTS)
            )
        ).all()

    recommendations: list[dict[str, Any]] = []
    if _preference_enabled(preference, "business_recommendations"):
        activity_posts = (
            (
                await db.execute(
                    select(Post)
                    .where(
                        Post.compound_id == compound_id,
                        Post.deleted_at.is_(None),
                        Post.created_at >= period_start,
                        Post.created_at < period_end,
                        Post.category.in_([PostCategory.EVENT, PostCategory.HELP]),
                    )
                    .order_by(desc(Post.created_at))
                    .limit(settings.WEEKLY_DIGEST_MAX_RECOMMENDATIONS)
                )
            )
            .scalars()
            .all()
        )
        recommendations.extend(
            {
                "entity_type": "post",
                "entity_id": post.id,
                "category": (
                    post.category.value
                    if hasattr(post.category, "value")
                    else str(post.category)
                ),
            }
            for post in activity_posts
        )
        remaining = settings.WEEKLY_DIGEST_MAX_RECOMMENDATIONS - len(recommendations)
        recommendations.extend(
            {
                "entity_type": "business",
                "entity_id": business.id,
                "category": business.category,
            }
            for business in businesses[:remaining]
        )

    summary = {
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "popular_posts": [
            _post_item(post, author_name) for post, author_name in popular_rows
        ],
        "new_businesses": [_business_item(business) for business in businesses],
        "announcements": [
            _post_item(post, author_name) for post, author_name in announcements
        ],
        "recommended_local_activity": recommendations,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
    if not any(
        summary[key]
        for key in (
            "popular_posts",
            "new_businesses",
            "announcements",
            "recommended_local_activity",
        )
    ):
        return {}
    return summary


async def _get_delivery(
    db: AsyncSession, run_id: int, user_id: int
) -> DigestDelivery | None:
    return await db.scalar(
        select(DigestDelivery).where(
            DigestDelivery.digest_run_id == run_id,
            DigestDelivery.user_id == user_id,
            DigestDelivery.channel == DigestChannel.IN_APP,
        )
    )


async def _process_user(
    db: AsyncSession,
    run: DigestRun,
    user: User,
    preference: UserPreference | None,
    period_start: datetime,
    period_end: datetime,
) -> str:
    delivery = await _get_delivery(db, run.id, user.id)
    if delivery and delivery.status == DigestDeliveryStatus.SENT:
        return "duplicate"

    summary = await build_weekly_summary(
        db, user, preference, period_start, period_end
    )
    if delivery is None:
        delivery = DigestDelivery(
            digest_run_id=run.id,
            user_id=user.id,
            channel=DigestChannel.IN_APP,
            status=DigestDeliveryStatus.PENDING,
        )
        db.add(delivery)
        await db.flush()

    if not summary:
        delivery.status = DigestDeliveryStatus.SKIPPED
        delivery.content_summary = {}
        delivery.error_message = None
        return "empty"

    delivery.content_summary = summary
    delivery.status = DigestDeliveryStatus.PENDING
    delivery.error_message = None
    await db.flush()

    summary["id"] = delivery.id
    route = {"type": "digest", "id": delivery.id}
    notification = Notification(
        user_id=user.id,
        type=NotificationType.WEEKLY_DIGEST,
        title="Your week in Eljiran",
        message="See what happened in your neighbourhood this week.",
        related_id=delivery.id,
        related_type="digest",
        extra_data={
            "digest_id": delivery.id,
            "digest_run_id": run.id,
            "route": route,
            "summary": summary,
        },
    )
    db.add(notification)
    await db.flush()
    delivery.status = DigestDeliveryStatus.SENT
    delivery.provider_message_id = f"notification:{notification.id}"
    delivery.sent_at = datetime.now(timezone.utc)
    return "sent"


async def _mark_failed_delivery(
    db: AsyncSession, run_id: int, user_id: int, error: Exception
) -> None:
    delivery = await _get_delivery(db, run_id, user_id)
    if delivery is None:
        delivery = DigestDelivery(
            digest_run_id=run_id,
            user_id=user_id,
            channel=DigestChannel.IN_APP,
        )
        db.add(delivery)
    delivery.status = DigestDeliveryStatus.FAILED
    delivery.error_message = str(error)[:2000]
    await db.flush()


async def run_weekly_digest(
    db: AsyncSession,
    *,
    dry_run: bool = False,
    now: datetime | None = None,
    period_start: datetime | None = None,
    period_end: datetime | None = None,
) -> dict[str, Any]:
    """Generate one idempotent weekly in-app digest run."""
    if period_start is None or period_end is None:
        period_start, period_end = weekly_period(now)
    if period_start >= period_end:
        raise ValueError("period_start must be before period_end")

    key = f"weekly:{period_start.isoformat()}:{period_end.isoformat()}:all"
    run = await db.scalar(select(DigestRun).where(DigestRun.idempotency_key == key))
    completed_without_failures = (
        run is not None
        and run.status == DigestRunStatus.COMPLETED
        and int((run.stats or {}).get("failed", 0)) == 0
    )
    if run and (run.status == DigestRunStatus.RUNNING or completed_without_failures):
        result = dict(run.stats or {})
        result.update(
            {
                "run_id": run.id,
                "idempotency_key": key,
                "duplicate": True,
                "dry_run": dry_run,
            }
        )
        logger.info("weekly_digest_duplicate", extra={"digest": result})
        return result

    if run is None and not dry_run:
        try:
            async with db.begin_nested():
                run = DigestRun(
                    idempotency_key=key,
                    frequency=DigestFrequency.WEEKLY,
                    period_start=period_start,
                    period_end=period_end,
                )
                db.add(run)
                await db.flush()
        except IntegrityError:
            run = await db.scalar(
                select(DigestRun).where(DigestRun.idempotency_key == key)
            )
            if run is None:
                raise
            result = dict(run.stats or {})
            result.update(
                {
                    "run_id": run.id,
                    "idempotency_key": key,
                    "duplicate": True,
                    "dry_run": False,
                }
            )
            return result

    stats: dict[str, Any] = {
        "eligible_users": 0,
        "sent": 0,
        "skipped_empty": 0,
        "skipped_disabled": 0,
        "duplicates": 0,
        "failed": 0,
        "failures": [],
    }
    if run is not None:
        run.status = DigestRunStatus.RUNNING
        run.started_at = datetime.now(timezone.utc)
        run.error_message = None
        await db.flush()

    rows = (
        await db.execute(
            select(User, UserPreference)
            .outerjoin(UserPreference, UserPreference.user_id == User.id)
            .where(User.status == UserStatus.APPROVED, User.compound_id.is_not(None))
            .order_by(User.id)
        )
    ).all()

    for user, preference in rows:
        enabled = (
            await is_feature_enabled(
                db,
                "weekly_digest",
                user_id=user.id,
                compound_id=user.compound_id,
            )
            and (
                preference is None
                or (
                    preference.digest_enabled
                    and _preference_enabled(preference, "weekly_digest_enabled")
                    and _preference_enabled(preference, "weekly_digest")
                )
            )
        )
        if not enabled:
            stats["skipped_disabled"] += 1
            continue
        stats["eligible_users"] += 1
        try:
            if dry_run:
                summary = await build_weekly_summary(
                    db, user, preference, period_start, period_end
                )
                outcome = "sent" if summary else "empty"
            else:
                async with db.begin_nested():
                    outcome = await _process_user(
                        db, run, user, preference, period_start, period_end
                    )
            if outcome == "sent":
                stats["sent"] += 1
            elif outcome == "empty":
                stats["skipped_empty"] += 1
            else:
                stats["duplicates"] += 1
        except Exception as error:
            stats["failed"] += 1
            stats["failures"].append(
                {"user_id": user.id, "error": type(error).__name__}
            )
            logger.exception(
                "weekly_digest_user_failed",
                extra={"digest_run_id": run.id if run else None, "user_id": user.id},
            )
            if run is not None:
                try:
                    async with db.begin_nested():
                        await _mark_failed_delivery(db, run.id, user.id, error)
                except Exception:
                    logger.exception(
                        "weekly_digest_failure_record_failed",
                        extra={"digest_run_id": run.id, "user_id": user.id},
                    )

    if run is not None:
        run.stats = stats
        run.status = DigestRunStatus.COMPLETED
        run.completed_at = datetime.now(timezone.utc)
        await db.commit()

    result = {
        **stats,
        "run_id": run.id if run else None,
        "idempotency_key": key,
        "duplicate": False,
        "dry_run": dry_run,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
    }
    logger.info("weekly_digest_completed", extra={"digest": result})
    return result
