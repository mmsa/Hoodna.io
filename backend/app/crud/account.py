from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.models.enums import AccountDeletionStatus
from app.models.launch_accounts import AccountDeletionRequest, UserPreference
from app.schemas.account import (
    AccountDeletionRequestResponse,
    ProfileVisibility,
    UserPreferencesResponse,
    UserPreferencesUpdate,
)

SUPPORTED_LOCALES = {"en", "ar"}

DEFAULT_PROFILE_VISIBILITY = ProfileVisibility()


def _get_locale(preference: UserPreference) -> str:
    values = preference.preferences if preference.preferences else {}
    locale = values.get("locale", "en")
    return locale if locale in SUPPORTED_LOCALES else "en"


def _set_locale(preference: UserPreference, locale: str) -> None:
    values = dict(preference.preferences or {})
    values["locale"] = locale
    preference.preferences = values
    flag_modified(preference, "preferences")


def get_profile_visibility(preference: UserPreference | None) -> ProfileVisibility:
    if preference is None:
        return DEFAULT_PROFILE_VISIBILITY.model_copy()
    values = preference.preferences if preference.preferences else {}
    raw = values.get("profile_visibility") or {}
    if not isinstance(raw, dict):
        return DEFAULT_PROFILE_VISIBILITY.model_copy()
    try:
        return ProfileVisibility.model_validate(
            {**DEFAULT_PROFILE_VISIBILITY.model_dump(), **raw}
        )
    except Exception:
        return DEFAULT_PROFILE_VISIBILITY.model_copy()


def _set_profile_visibility(
    preference: UserPreference, visibility: ProfileVisibility
) -> None:
    values = dict(preference.preferences or {})
    values["profile_visibility"] = visibility.model_dump()
    preference.preferences = values
    flag_modified(preference, "preferences")


async def get_or_create_preferences(
    db: AsyncSession,
    user_id: int,
) -> UserPreference:
    preference = await db.scalar(
        select(UserPreference).where(UserPreference.user_id == user_id)
    )
    if preference is None:
        preference = UserPreference(user_id=user_id)
        db.add(preference)
        await db.flush()
        await db.refresh(preference)
    return preference


async def update_preferences(
    db: AsyncSession,
    user_id: int,
    update: UserPreferencesUpdate,
) -> UserPreference:
    preference = await get_or_create_preferences(db, user_id)
    field_map = {
        "push_notifications": "push_notifications",
        "weekly_digest": "digest_enabled",
        "community_announcements": "community_notifications",
        "business_recommendations": "marketplace_notifications",
    }
    for field, value in update.model_dump(exclude_unset=True).items():
        if field == "locale":
            if value is not None:
                _set_locale(preference, value)
            continue
        if field == "profile_visibility":
            if value is not None:
                _set_profile_visibility(
                    preference, ProfileVisibility.model_validate(value)
                )
            continue
        if value is not None:
            setattr(preference, field_map[field], value)
    await db.flush()
    await db.refresh(preference)
    return preference


def preferences_response(preference: UserPreference) -> UserPreferencesResponse:
    return UserPreferencesResponse(
        push_notifications=preference.push_notifications,
        weekly_digest=preference.digest_enabled,
        community_announcements=preference.community_notifications,
        business_recommendations=preference.marketplace_notifications,
        locale=_get_locale(preference),
        profile_visibility=get_profile_visibility(preference),
        updated_at=preference.updated_at,
    )


async def get_deletion_request(
    db: AsyncSession,
    user_id: int,
) -> AccountDeletionRequest | None:
    return await db.scalar(
        select(AccountDeletionRequest).where(
            AccountDeletionRequest.user_id == user_id
        )
    )


async def create_or_get_pending_deletion_request(
    db: AsyncSession,
    user_id: int,
    reason: str | None,
) -> tuple[AccountDeletionRequest, bool]:
    existing = await get_deletion_request(db, user_id)
    if existing is not None:
        return existing, False

    request = AccountDeletionRequest(
        user_id=user_id,
        reason=reason.strip() if reason and reason.strip() else None,
        status=AccountDeletionStatus.PENDING,
    )
    db.add(request)
    await db.flush()
    await db.refresh(request)
    return request, True


def deletion_request_response(
    request: AccountDeletionRequest,
) -> AccountDeletionRequestResponse:
    status_map = {
        AccountDeletionStatus.PENDING: "PENDING",
        AccountDeletionStatus.CANCELLED: "CANCELLED",
        AccountDeletionStatus.COMPLETED: "COMPLETED",
        AccountDeletionStatus.REJECTED: "CANCELLED",
    }
    return AccountDeletionRequestResponse(
        id=request.id,
        status=status_map[request.status],
        requested_at=request.requested_at,
        completed_at=request.completed_at,
    )
