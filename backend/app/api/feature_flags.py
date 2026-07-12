from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.compound import Compound
from app.models.enums import FeatureFlagScope, UserRole
from app.models.feature_flag import FeatureFlag, FeatureFlagOverride
from app.models.user import User
from app.schemas.feature_flags import (
    FeatureConfigResponse,
    FeatureFlagCreate,
    FeatureFlagOverrideResponse,
    FeatureFlagOverrideWrite,
    FeatureFlagResponse,
    FeatureFlagWrite,
)
from app.services.feature_flags import (
    FEATURE_FLAG_KEYS,
    FlagContext,
    clear_feature_flag_cache,
    evaluate_feature_flag,
)

router = APIRouter()
admin_router = APIRouter()


def _geo_enabled(value: str | None, allowed: set[str]) -> bool:
    return not allowed or (value is not None and value.strip().casefold() in allowed)


async def _config(
    db: AsyncSession,
    context: FlagContext,
) -> FeatureConfigResponse:
    from app.core.config import settings

    decisions = {
        key: (await evaluate_feature_flag(db, key, context)).enabled
        for key in FEATURE_FLAG_KEYS
    }
    return FeatureConfigResponse(
        flags=decisions,
        city_enabled=_geo_enabled(context.city, settings.feature_enabled_cities),
        neighbourhood_enabled=_geo_enabled(
            context.neighbourhood, settings.feature_enabled_neighbourhoods
        ),
        fetched_at=datetime.now(timezone.utc),
    )


@router.get("/config", response_model=FeatureConfigResponse)
async def get_public_feature_config(
    city: str | None = Query(default=None, max_length=120),
    neighbourhood: str | None = Query(default=None, max_length=160),
    anonymous_id: str | None = Query(default=None, max_length=128),
    db: AsyncSession = Depends(get_db),
):
    return await _config(
        db,
        FlagContext(
            city=city,
            neighbourhood=neighbourhood,
            anonymous_id=anonymous_id,
        ),
    )


@router.get("/config/me", response_model=FeatureConfigResponse)
async def get_authenticated_feature_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    compound = (
        await db.get(Compound, current_user.compound_id)
        if current_user.compound_id is not None
        else None
    )
    return await _config(
        db,
        FlagContext(
            user_id=current_user.id,
            compound_id=current_user.compound_id,
            city=compound.city if compound else None,
            neighbourhood=compound.name if compound else None,
        ),
    )


async def _admin_only(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


@admin_router.get("", response_model=list[FeatureFlagResponse])
async def list_feature_flags(
    _: User = Depends(_admin_only),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(FeatureFlag).order_by(FeatureFlag.key))
    return list(result.scalars().all())


@admin_router.post(
    "", response_model=FeatureFlagResponse, status_code=status.HTTP_201_CREATED
)
async def create_feature_flag(
    body: FeatureFlagCreate,
    _: User = Depends(_admin_only),
    db: AsyncSession = Depends(get_db),
):
    flag = FeatureFlag(**body.model_dump())
    db.add(flag)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Feature flag already exists")
    await db.refresh(flag)
    clear_feature_flag_cache()
    return flag


@admin_router.put("/{key}", response_model=FeatureFlagResponse)
async def update_feature_flag(
    key: str,
    body: FeatureFlagWrite,
    _: User = Depends(_admin_only),
    db: AsyncSession = Depends(get_db),
):
    flag = await db.scalar(select(FeatureFlag).where(FeatureFlag.key == key))
    if flag is None:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    for field, value in body.model_dump().items():
        setattr(flag, field, value)
    await db.commit()
    await db.refresh(flag)
    clear_feature_flag_cache()
    return flag


@admin_router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feature_flag(
    key: str,
    _: User = Depends(_admin_only),
    db: AsyncSession = Depends(get_db),
):
    flag = await db.scalar(select(FeatureFlag).where(FeatureFlag.key == key))
    if flag is None:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    await db.delete(flag)
    await db.commit()
    clear_feature_flag_cache()


@admin_router.get(
    "/{key}/overrides", response_model=list[FeatureFlagOverrideResponse]
)
async def list_feature_flag_overrides(
    key: str,
    _: User = Depends(_admin_only),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(FeatureFlagOverride)
        .join(FeatureFlag)
        .where(FeatureFlag.key == key)
        .order_by(FeatureFlagOverride.id)
    )
    return list(result.scalars().all())


@admin_router.post(
    "/{key}/overrides",
    response_model=FeatureFlagOverrideResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_feature_flag_override(
    key: str,
    body: FeatureFlagOverrideWrite,
    _: User = Depends(_admin_only),
    db: AsyncSession = Depends(get_db),
):
    flag = await db.scalar(select(FeatureFlag).where(FeatureFlag.key == key))
    if flag is None:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    target_key = {
        "USER": str(body.user_id),
        "COMPOUND": str(body.compound_id),
        "CITY": body.city.strip().casefold() if body.city else "",
    }[body.scope]
    override = FeatureFlagOverride(
        feature_flag_id=flag.id,
        scope=FeatureFlagScope(body.scope),
        target_key=target_key,
        **body.model_dump(exclude={"scope"}),
    )
    db.add(override)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Override already exists")
    await db.refresh(override)
    clear_feature_flag_cache()
    return override


@admin_router.delete(
    "/{key}/overrides/{override_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_feature_flag_override(
    key: str,
    override_id: int,
    _: User = Depends(_admin_only),
    db: AsyncSession = Depends(get_db),
):
    override = await db.scalar(
        select(FeatureFlagOverride)
        .join(FeatureFlag)
        .where(
            FeatureFlag.key == key,
            FeatureFlagOverride.id == override_id,
        )
    )
    if override is None:
        raise HTTPException(status_code=404, detail="Override not found")
    await db.delete(override)
    await db.commit()
    clear_feature_flag_cache()
