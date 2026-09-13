"""Growth measurement: first-touch attribution, verified_at, activated_at."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Mapping

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import UserRole, UserStatus
from app.models.listing import Listing
from app.models.post import Post
from app.models.user import User
from app.models.user_compound_membership import UserCompoundMembership

SAFE_ATTR = re.compile(r"^[A-Za-z0-9_.:/-]{1,100}$")
ATTR_KEYS = (
    "source",
    "medium",
    "campaign",
    "content",
    "term",
    "referrer_host",
    "landing_path",
)
EXCLUDED_CREATION_SOURCES = ("DEMO", "SEED_ADMIN")
MARKETING_ROLES = (UserRole.RESIDENT, UserRole.USER)
PLATFORMS = ("web", "ios", "android")

REFERRER_SOURCE = {
    "wa.me": ("whatsapp", "social"),
    "whatsapp.com": ("whatsapp", "social"),
    "web.whatsapp.com": ("whatsapp", "social"),
    "api.whatsapp.com": ("whatsapp", "social"),
    "facebook.com": ("facebook", "social"),
    "m.facebook.com": ("facebook", "social"),
    "l.facebook.com": ("facebook", "social"),
    "fb.com": ("facebook", "social"),
    "instagram.com": ("instagram", "social"),
    "l.instagram.com": ("instagram", "social"),
    "tiktok.com": ("tiktok", "social"),
    "vm.tiktok.com": ("tiktok", "social"),
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _sanitize(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    trimmed = value.strip()[:100]
    if not trimmed or not SAFE_ATTR.fullmatch(trimmed):
        return None
    return trimmed


def normalize_attribution(
    payload: Mapping[str, Any] | None,
    *,
    referral_code: str | None = None,
) -> dict[str, str]:
    raw = dict(payload or {})
    out: dict[str, str] = {}
    for key in ATTR_KEYS:
        cleaned = _sanitize(raw.get(key))
        if cleaned:
            if key in ("source", "medium"):
                cleaned = cleaned.lower()
            out[key] = cleaned
    if not out.get("source") and referral_code:
        out["source"] = "referral"
        out.setdefault("medium", "referral")
    return out


def normalize_platform(value: Any) -> str | None:
    if isinstance(value, str) and value.strip().lower() in PLATFORMS:
        return value.strip().lower()
    return None


def apply_first_touch_attribution(
    user: User,
    *,
    attribution: Mapping[str, Any] | None = None,
    platform: str | None = None,
    referral_code: str | None = None,
) -> None:
    """Write-once first touch. Existing keys are never overwritten."""
    incoming = normalize_attribution(attribution, referral_code=referral_code)
    platform_norm = normalize_platform(platform)
    if platform_norm and not user.registration_platform:
        user.registration_platform = platform_norm

    existing = user.attribution if isinstance(user.attribution, dict) else {}
    if not existing:
        user.attribution = incoming or None
        return
    merged = dict(existing)
    for key, value in incoming.items():
        if key not in merged or not merged[key]:
            merged[key] = value
    user.attribution = merged


def mark_resident_verified(
    user: User,
    membership: UserCompoundMembership | None = None,
    *,
    at: datetime | None = None,
) -> None:
    """Set verified_at once on membership and user."""
    when = at or _now()
    if membership is not None and membership.verified_at is None:
        membership.verified_at = when
    if user.verified_at is None:
        user.verified_at = when


async def maybe_set_activated_at(db: AsyncSession, user: User) -> None:
    """First gated write after verification. Never overwrite."""
    if user.activated_at is not None:
        return
    if user.role not in MARKETING_ROLES and user.role is not None:
        return
    if user.verified_at is None:
        return
    user.activated_at = _now()
    await db.flush()


async def maybe_activate_chat_import(db: AsyncSession, user: User) -> None:
    """Imported neighbours with published content are activated at verification."""
    if user.activated_at is not None or user.verified_at is None:
        return
    if (user.creation_source or "") != "CHAT_IMPORT":
        return
    post_count = await db.scalar(
        select(func.count(Post.id)).where(
            Post.author_id == user.id, Post.deleted_at.is_(None)
        )
    )
    listing_count = await db.scalar(
        select(func.count(Listing.id)).where(Listing.owner_id == user.id)
    )
    if int(post_count or 0) or int(listing_count or 0):
        user.activated_at = user.verified_at
        await db.flush()


def marketing_resident_filter():
    return (
        User.role.in_(MARKETING_ROLES),
        User.status == UserStatus.APPROVED,
        User.verified_at.is_not(None),
        or_(
            User.creation_source.is_(None),
            User.creation_source.notin_(EXCLUDED_CREATION_SOURCES),
        ),
    )
