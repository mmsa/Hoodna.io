from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import AccountDeletionStatus
from app.models.launch_accounts import AccountDeletionRequest, UserPreference
from app.schemas.account import (
    AccountDeletionRequestResponse,
    UserPreferencesResponse,
    UserPreferencesUpdate,
)


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
