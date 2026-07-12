"""Feature flag evaluation with scoped precedence and a short-lived cache."""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from typing import Any

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.enums import FeatureFlagScope
from app.models.feature_flag import FeatureFlag
from app.models.user import User

FEATURE_FLAG_KEYS = (
    "invitations", "business_claiming", "weekly_digest", "community_posting",
    "business_reviews", "user_registration",
)


@dataclass(frozen=True)
class FlagContext:
    user_id: int | None = None
    compound_id: int | None = None
    city: str | None = None
    neighbourhood: str | None = None
    anonymous_id: str | None = None


@dataclass(frozen=True)
class FlagDecision:
    enabled: bool
    source: str
    config: dict[str, Any]


_cache: tuple[float, dict[str, dict[str, Any]]] | None = None


def clear_feature_flag_cache() -> None:
    global _cache
    _cache = None


async def _load_flags(db: AsyncSession) -> dict[str, dict[str, Any]]:
    global _cache
    now = time.monotonic()
    if _cache and now - _cache[0] < max(0, settings.FEATURE_FLAG_CACHE_TTL_SECONDS):
        return _cache[1]
    result = await db.execute(
        select(FeatureFlag).options(selectinload(FeatureFlag.overrides))
    )
    flags = {
        flag.key: {
            "enabled": bool(flag.enabled),
            "config": dict(flag.config or {}),
            "overrides": [
                {
                    "scope": item.scope.value,
                    "target_key": item.target_key,
                    "enabled": bool(item.enabled),
                    "config": dict(item.config or {}),
                }
                for item in flag.overrides
            ],
        }
        for flag in result.scalars().unique().all()
    }
    _cache = (now, flags)
    return flags


def _normalize(value: str | None) -> str | None:
    return value.strip().casefold() if value and value.strip() else None


def _rollout_allows(key: str, context: FlagContext, config: dict[str, Any]) -> bool:
    try:
        percentage = min(100.0, max(0.0, float(config.get("rollout_percentage", 100))))
    except (TypeError, ValueError):
        percentage = 100
    if percentage in (0, 100):
        return percentage == 100
    subject = (
        str(context.user_id) if context.user_id is not None else
        context.anonymous_id or
        (f"compound:{context.compound_id}" if context.compound_id is not None else
         f"geo:{_normalize(context.city)}:{_normalize(context.neighbourhood)}")
    )
    bucket = int.from_bytes(
        hashlib.sha256(f"{key}:{subject}".encode()).digest()[:8], "big"
    ) % 10_000
    return bucket < round(percentage * 100)


def _geography_allows(context: FlagContext) -> bool:
    city, neighbourhood = _normalize(context.city), _normalize(context.neighbourhood)
    return not (
        (settings.feature_enabled_cities and city not in settings.feature_enabled_cities)
        or (settings.feature_enabled_neighbourhoods and
            neighbourhood not in settings.feature_enabled_neighbourhoods)
    )


async def evaluate_feature_flag(
    db: AsyncSession, key: str, context: FlagContext | None = None
) -> FlagDecision:
    if key not in FEATURE_FLAG_KEYS:
        raise ValueError(f"Unknown feature flag: {key}")
    context = context or FlagContext()
    stored = (await _load_flags(db)).get(key)
    enabled, config, source = settings.feature_flag_defaults[key], {}, "environment"
    if stored:
        enabled, config, source = stored["enabled"], stored["config"], "database"
        targets = (
            (FeatureFlagScope.CITY.value, _normalize(context.city)),
            (FeatureFlagScope.COMPOUND.value,
             str(context.compound_id) if context.compound_id is not None else None),
            (FeatureFlagScope.USER.value,
             str(context.user_id) if context.user_id is not None else None),
        )
        overrides = {
            (item["scope"], _normalize(item["target_key"])): item
            for item in stored["overrides"]
        }
        for scope, target in targets:
            item = overrides.get((scope, target)) if target is not None else None
            if item:
                enabled, config, source = (
                    item["enabled"], {**config, **item["config"]}, scope.lower()
                )
    enabled = enabled and _geography_allows(context)
    enabled = enabled and _rollout_allows(key, context, config)
    return FlagDecision(enabled=enabled, source=source, config=config)


async def is_feature_enabled(
    db: AsyncSession, key: str, *, user_id: int | None = None,
    compound_id: int | None = None, city: str | None = None,
    neighbourhood: str | None = None, anonymous_id: str | None = None,
) -> bool:
    decision = await evaluate_feature_flag(
        db, key, FlagContext(user_id, compound_id, city, neighbourhood, anonymous_id)
    )
    return decision.enabled


async def require_business_claiming(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not await is_feature_enabled(
        db, "business_claiming",
        user_id=current_user.id, compound_id=current_user.compound_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Business claiming is not currently available",
        )
    return current_user


async def referral_invitations_enabled(
    db: AsyncSession, user: User | None = None
) -> bool:
    return await is_feature_enabled(
        db, "invitations",
        user_id=user.id if user else None,
        compound_id=user.compound_id if user else None,
    )
