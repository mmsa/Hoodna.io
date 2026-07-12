"""Aggregate private-beta product and operational metrics."""

from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.business import BusinessClaim
from app.models.enums import ReferralInviteStatus
from app.models.launch_accounts import ReferralInvite
from app.models.post import Comment, Post
from app.models.report import Report
from app.models.telemetry import AnalyticsEvent, ClientErrorReport
from app.models.user import User


async def _count(db: AsyncSession, query) -> int:
    return int((await db.scalar(query)) or 0)


def _bounds(date_from: date, date_to: date) -> tuple[datetime, datetime]:
    return (
        datetime.combine(date_from, time.min, tzinfo=timezone.utc),
        datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc),
    )


async def get_beta_metrics(
    db: AsyncSession, date_from: date, date_to: date
) -> dict:
    start, end = _bounds(date_from, date_to)

    total_registered_users = await _count(
        db, select(func.count(User.id)).where(User.created_at < end)
    )
    new_user_rows = (
        await db.execute(
            select(func.date(User.created_at), func.count(User.id))
            .where(User.created_at >= start, User.created_at < end)
            .group_by(func.date(User.created_at))
            .order_by(func.date(User.created_at))
        )
    ).all()
    new_users_by_date = {str(day): int(value) for day, value in new_user_rows}
    new_users_by_day = []
    day = date_from
    while day <= date_to:
        new_users_by_day.append(
            {"date": day, "value": new_users_by_date.get(day.isoformat(), 0)}
        )
        day += timedelta(days=1)

    registration_count = await _count(
        db,
        select(func.count(func.distinct(AnalyticsEvent.user_id))).where(
            AnalyticsEvent.event_name == "registration_completed",
            AnalyticsEvent.user_id.is_not(None),
            AnalyticsEvent.occurred_at >= start,
            AnalyticsEvent.occurred_at < end,
        ),
    )
    onboarding_count = await _count(
        db,
        select(func.count(func.distinct(AnalyticsEvent.user_id))).where(
            AnalyticsEvent.event_name == "onboarding_completed",
            AnalyticsEvent.user_id.is_not(None),
            AnalyticsEvent.occurred_at >= start,
            AnalyticsEvent.occurred_at < end,
        ),
    )
    onboarding_completion_rate = (
        min(onboarding_count / registration_count, 1.0)
        if registration_count
        else 0.0
    )

    active_users = await _count(
        db,
        select(func.count(func.distinct(AnalyticsEvent.user_id))).where(
            AnalyticsEvent.user_id.is_not(None),
            AnalyticsEvent.occurred_at >= start,
            AnalyticsEvent.occurred_at < end,
        ),
    )
    posts_created = await _count(
        db,
        select(func.count(Post.id)).where(
            Post.created_at >= start,
            Post.created_at < end,
            Post.deleted_at.is_(None),
        ),
    )
    comments_created = await _count(
        db,
        select(func.count(Comment.id)).where(
            Comment.created_at >= start, Comment.created_at < end
        ),
    )
    searches_performed = await _count(
        db,
        select(func.count(AnalyticsEvent.id)).where(
            AnalyticsEvent.event_name == "search_performed",
            AnalyticsEvent.occurred_at >= start,
            AnalyticsEvent.occurred_at < end,
        ),
    )
    business_claims = await _count(
        db,
        select(func.count(BusinessClaim.id)).where(
            BusinessClaim.submitted_at >= start,
            BusinessClaim.submitted_at < end,
        ),
    )
    reports_awaiting_review = await _count(
        db,
        select(func.count(Report.id)).where(
            Report.status == "PENDING",
            Report.created_at >= start,
            Report.created_at < end,
        ),
    )
    invitations_sent = await _count(
        db,
        select(func.count(ReferralInvite.id)).where(
            ReferralInvite.created_at >= start,
            ReferralInvite.created_at < end,
        ),
    )
    successful_referrals = await _count(
        db,
        select(func.count(ReferralInvite.id)).where(
            ReferralInvite.status == ReferralInviteStatus.ACCEPTED,
            ReferralInvite.accepted_at >= start,
            ReferralInvite.accepted_at < end,
        ),
    )
    client_errors = await _count(
        db,
        select(func.count(ClientErrorReport.id)).where(
            ClientErrorReport.created_at >= start,
            ClientErrorReport.created_at < end,
        ),
    )

    return {
        "date_from": date_from,
        "date_to": date_to,
        "total_registered_users": total_registered_users,
        "new_users_by_day": new_users_by_day,
        "onboarding_completion_rate": onboarding_completion_rate,
        "active_users": active_users,
        "posts_created": posts_created,
        "comments_created": comments_created,
        "searches_performed": searches_performed,
        "business_claims": business_claims,
        "reports_awaiting_review": reports_awaiting_review,
        "invitations_sent": invitations_sent,
        "successful_referrals": successful_referrals,
        "client_errors": client_errors,
    }
