import asyncio

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.models.all  # noqa: F401
from app.crud.account import (
    create_or_get_pending_deletion_request,
    get_or_create_preferences,
    update_preferences,
)
from app.crud.referral import (
    DuplicateReferralError,
    SelfReferralError,
    create_referral_invite,
    redeem_referral,
)
from app.models.enums import AccountDeletionStatus, ReferralInviteStatus
from app.db.base import Base
from app.models.user import User
from app.schemas.account import UserPreferencesUpdate


async def add_user(db_session, email: str) -> User:
    user = User(
        name=email.split("@")[0],
        email=email,
        password_hash="test",
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


async def with_session(exercise):
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
    )
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        await exercise(session)
    await engine.dispose()


def test_referral_codes_are_unique_and_redeem_once():
    async def exercise(db_session):
        inviter = await add_user(db_session, "inviter@example.com")
        accepted = await add_user(db_session, "accepted@example.com")
        other_inviter = await add_user(db_session, "other@example.com")

        first = await create_referral_invite(db_session, inviter.id)
        second = await create_referral_invite(db_session, other_inviter.id)
        assert first.code != second.code

        redeemed = await redeem_referral(db_session, first.code, accepted.id)
        assert redeemed.status == ReferralInviteStatus.ACCEPTED
        assert redeemed.accepted_user_id == accepted.id
        assert redeemed.accepted_at is not None

        with pytest.raises(DuplicateReferralError):
            await redeem_referral(db_session, second.code, accepted.id)

    asyncio.run(with_session(exercise))


def test_referral_rejects_self_referral():
    async def exercise(db_session):
        inviter = await add_user(db_session, "self@example.com")
        invite = await create_referral_invite(db_session, inviter.id)

        with pytest.raises(SelfReferralError):
            await redeem_referral(db_session, invite.code, inviter.id)

        assert invite.status == ReferralInviteStatus.PENDING
        assert invite.accepted_user_id is None

    asyncio.run(with_session(exercise))


def test_preferences_are_lazy_and_patch_contract_fields():
    async def exercise(db_session):
        user = await add_user(db_session, "preferences@example.com")

        defaults = await get_or_create_preferences(db_session, user.id)
        again = await get_or_create_preferences(db_session, user.id)
        assert defaults.id == again.id
        assert defaults.push_notifications is True
        assert defaults.digest_enabled is True
        assert defaults.community_notifications is True
        assert defaults.marketplace_notifications is True

        updated = await update_preferences(
            db_session,
            user.id,
            UserPreferencesUpdate(
                push_notifications=False,
                weekly_digest=False,
                business_recommendations=False,
                locale="ar",
            ),
        )
        assert updated.push_notifications is False
        assert updated.digest_enabled is False
        assert updated.marketplace_notifications is False
        assert updated.community_notifications is True
        assert updated.preferences["locale"] == "ar"

    asyncio.run(with_session(exercise))


def test_pending_deletion_request_is_idempotent():
    async def exercise(db_session):
        user = await add_user(db_session, "delete@example.com")

        first, first_created = await create_or_get_pending_deletion_request(
            db_session, user.id, "No longer needed"
        )
        second, second_created = await create_or_get_pending_deletion_request(
            db_session, user.id, "A different reason"
        )

        assert first_created is True
        assert second_created is False
        assert first.id == second.id
        assert second.status == AccountDeletionStatus.PENDING
        assert second.reason == "No longer needed"

    asyncio.run(with_session(exercise))
