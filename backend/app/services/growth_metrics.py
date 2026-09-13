"""Admin growth KPIs from first-party tables (no warehouse)."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.compound import Compound
from app.models.enums import ReferralInviteStatus
from app.models.launch_accounts import ReferralInvite
from app.models.listing import Listing
from app.models.message import Message
from app.models.post import Comment, Post
from app.models.telemetry import AnalyticsEvent
from app.models.user import User
from app.services.growth import EXCLUDED_CREATION_SOURCES, MARKETING_ROLES
from app.models.enums import UserStatus


def utc_week_bounds(week_start: date | None = None) -> tuple[datetime, datetime, date]:
    today = datetime.now(timezone.utc).date()
    start_date = week_start or (today - timedelta(days=today.weekday()))
    start = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    end = start + timedelta(days=7)
    return start, end, start_date


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _real_user_filter():
    return or_(
        User.creation_source.is_(None),
        User.creation_source.notin_(EXCLUDED_CREATION_SOURCES),
    )


def _marketing_filter():
    return (
        User.role.in_(MARKETING_ROLES),
        User.status == UserStatus.APPROVED,
        User.verified_at.is_not(None),
        _real_user_filter(),
    )


async def _load_activity_times(
    db: AsyncSession, start: datetime, end: datetime
) -> dict[int, list[datetime]]:
    times: dict[int, list[datetime]] = {}

    def add(user_id: int | None, occurred: datetime | None) -> None:
        if user_id is None or occurred is None:
            return
        times.setdefault(int(user_id), []).append(_aware(occurred) or occurred)

    rows = [
        *(
            await db.execute(
                select(Post.author_id, Post.created_at).where(
                    Post.created_at >= start,
                    Post.created_at < end,
                    Post.deleted_at.is_(None),
                )
            )
        ).all(),
        *(
            await db.execute(
                select(Comment.author_id, Comment.created_at).where(
                    Comment.created_at >= start, Comment.created_at < end
                )
            )
        ).all(),
        *(
            await db.execute(
                select(Listing.owner_id, Listing.created_at).where(
                    Listing.created_at >= start, Listing.created_at < end
                )
            )
        ).all(),
        *(
            await db.execute(
                select(Message.sender_id, Message.created_at).where(
                    Message.created_at >= start, Message.created_at < end
                )
            )
        ).all(),
        *(
            await db.execute(
                select(AnalyticsEvent.user_id, AnalyticsEvent.occurred_at).where(
                    AnalyticsEvent.event_name == "app_opened",
                    AnalyticsEvent.user_id.is_not(None),
                    AnalyticsEvent.occurred_at >= start,
                    AnalyticsEvent.occurred_at < end,
                )
            )
        ).all(),
    ]
    for user_id, occurred in rows:
        add(user_id, occurred)
    return times


def _active_ids(times: dict[int, list[datetime]], start: datetime, end: datetime) -> set[int]:
    active: set[int] = set()
    for user_id, stamps in times.items():
        if any(start <= stamp < end for stamp in stamps if stamp):
            active.add(user_id)
    return active


def _empty_row(key: str) -> dict:
    return {
        "key": key,
        "registrations": 0,
        "verified": 0,
        "activated": 0,
        "wavr": 0,
    }


def _top_rows(bucket: dict[str, dict], limit: int = 25) -> list[dict]:
    rows = list(bucket.values())
    rows.sort(
        key=lambda row: (-row["wavr"], -row["verified"], -row["registrations"], row["key"])
    )
    return rows[:limit]


def _source_of(user: User) -> str:
    attr = user.attribution if isinstance(user.attribution, dict) else {}
    value = attr.get("source") if isinstance(attr.get("source"), str) else None
    if (user.creation_source or "") == "CHAT_IMPORT" and not value:
        return "chat_import"
    return (value or "unknown")[:80]


def _campaign_of(user: User) -> str:
    attr = user.attribution if isinstance(user.attribution, dict) else {}
    value = attr.get("campaign") if isinstance(attr.get("campaign"), str) else None
    return (value or "unknown")[:80]


async def get_growth_metrics(
    db: AsyncSession, week_start: date | None = None
) -> dict:
    as_of = datetime.now(timezone.utc)
    week_from, week_to, start_date = utc_week_bounds(week_start)
    lookback = as_of - timedelta(days=400)
    activity_times = await _load_activity_times(db, lookback, as_of + timedelta(seconds=1))

    week_active = _active_ids(activity_times, week_from, week_to)
    wau_active = _active_ids(activity_times, as_of - timedelta(days=7), as_of)
    mau_active = _active_ids(activity_times, as_of - timedelta(days=30), as_of)

    total_registrations = int(
        (await db.scalar(select(func.count(User.id)).where(_real_user_filter()))) or 0
    )
    marketing = list(
        (await db.execute(select(User).where(*_marketing_filter()))).scalars().all()
    )
    verified_ids = {user.id for user in marketing}
    activated_count = sum(1 for user in marketing if user.activated_at is not None)
    wavr_ids = verified_ids & week_active

    compound_ids = {
        user.compound_id
        for user in marketing
        if user.id in wavr_ids and user.compound_id
    }

    referral_registrations = int(
        (
            await db.scalar(
                select(func.count(ReferralInvite.id)).where(
                    ReferralInvite.status == ReferralInviteStatus.ACCEPTED
                )
            )
        )
        or 0
    )

    def returned(user: User, days: int) -> bool:
        start = _aware(user.verified_at)
        if start is None:
            return False
        end = start + timedelta(days=days)
        stamps = activity_times.get(user.id, [])
        return any(start < stamp <= end for stamp in stamps if stamp)

    d7_eligible = [
        user
        for user in marketing
        if _aware(user.verified_at) and _aware(user.verified_at) <= as_of - timedelta(days=7)
    ]
    d30_eligible = [
        user
        for user in marketing
        if _aware(user.verified_at) and _aware(user.verified_at) <= as_of - timedelta(days=30)
    ]
    d7_returned = sum(1 for user in d7_eligible if returned(user, 7))
    d30_returned = sum(1 for user in d30_eligible if returned(user, 30))

    name_rows = (await db.execute(select(Compound.id, Compound.name))).all()
    compound_names = {row[0]: row[1] for row in name_rows}

    by_source: dict[str, dict] = {}
    by_campaign: dict[str, dict] = {}
    by_platform: dict[str, dict] = {}
    by_compound: dict[str, dict] = {}

    def bump(bucket: dict[str, dict], key: str, field: str) -> None:
        if key not in bucket:
            bucket[key] = _empty_row(key)
        bucket[key][field] += 1

    all_real = list((await db.execute(select(User).where(_real_user_filter()))).scalars().all())
    for user in all_real:
        bump(by_source, _source_of(user), "registrations")
        bump(by_campaign, _campaign_of(user), "registrations")
        bump(by_platform, user.registration_platform or "unknown", "registrations")
        compound_key = (
            compound_names.get(user.compound_id, f"compound-{user.compound_id}")
            if user.compound_id
            else "none"
        )
        bump(by_compound, compound_key, "registrations")

    for user in marketing:
        keys = (
            (by_source, _source_of(user)),
            (by_campaign, _campaign_of(user)),
            (by_platform, user.registration_platform or "unknown"),
            (
                by_compound,
                compound_names.get(user.compound_id, f"compound-{user.compound_id}")
                if user.compound_id
                else "none",
            ),
        )
        for bucket, key in keys:
            bump(bucket, key, "verified")
            if user.activated_at:
                bump(bucket, key, "activated")
            if user.id in wavr_ids:
                bump(bucket, key, "wavr")

    verified_count = len(marketing)
    return {
        "week_start": start_date.isoformat(),
        "week_end": week_to.date().isoformat(),
        "as_of": as_of.isoformat(),
        "total_registrations": total_registrations,
        "verified_residents": verified_count,
        "activated_verified_residents": activated_count,
        "activation_rate": (
            min(activated_count / verified_count, 1.0) if verified_count else 0.0
        ),
        "wavr": len(wavr_ids),
        "wau": len(verified_ids & wau_active),
        "mau": len(verified_ids & mau_active),
        "active_compounds": len(compound_ids),
        "referral_registrations": referral_registrations,
        "referral_share": (
            min(referral_registrations / total_registrations, 1.0)
            if total_registrations
            else 0.0
        ),
        "d7_eligible": len(d7_eligible),
        "d7_returned": d7_returned,
        "d7_return_rate": (
            min(d7_returned / len(d7_eligible), 1.0) if d7_eligible else 0.0
        ),
        "d30_eligible": len(d30_eligible),
        "d30_returned": d30_returned,
        "d30_return_rate": (
            min(d30_returned / len(d30_eligible), 1.0) if d30_eligible else 0.0
        ),
        "by_source": _top_rows(by_source),
        "by_campaign": _top_rows(by_campaign),
        "by_platform": _top_rows(by_platform),
        "by_compound": _top_rows(by_compound),
    }
