import asyncio

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.models.all  # noqa: F401
from app.crud.account import (
    create_or_get_pending_deletion_request,
    get_or_create_preferences,
    update_preferences,
)
from app.core.config import resolve_public_frontend_url
from app.crud.referral import (
    DuplicateReferralError,
    SelfReferralError,
    create_referral_invite,
    get_or_create_referral_invite,
    get_referral_stats,
    redeem_referral,
    referral_invite_response,
)
from app.models.compound import Compound
from app.models.compound_moderator import CompoundModeratorProfile
from app.models.enums import (
    AccountDeletionStatus,
    ModeratorStatus,
    ReferralInviteStatus,
    UserRole,
    UserStatus,
)
from app.db.base import Base
from app.models.user import User
from app.models.user_compound_membership import UserCompoundMembership
from app.schemas.account import UserPreferencesUpdate
from app.services.moderator_invite import grant_moderator_invite_access


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


def test_production_frontend_url_rejects_vercel_preview_hosts():
    from app.core.config import production_frontend_url_issue

    url = resolve_public_frontend_url("production", "https://eljiran.vercel.app")
    assert url == "https://eljiran.io"
    assert "vercel.app" not in url
    assert (
        resolve_public_frontend_url("production", "https://eljiran.io")
        == "https://eljiran.io"
    )
    assert (
        resolve_public_frontend_url("development", "https://eljiran.vercel.app")
        == "https://eljiran.vercel.app"
    )
    assert production_frontend_url_issue("https://eljiran.vercel.app")
    assert production_frontend_url_issue("https://eljiran.io") is None


def test_invite_url_uses_auth_signup_and_keeps_ref_and_utm():
    async def exercise(db_session):
        inviter = await add_user(db_session, "invite-url@example.com")
        invite = await create_referral_invite(db_session, inviter.id)
        payload = referral_invite_response(invite)
        assert "/auth/signup?ref=" in payload.invite_url
        assert f"ref={invite.code}" in payload.invite_url
        assert "utm_source=referral" in payload.invite_url
        assert "utm_medium=referral" in payload.invite_url
        assert "utm_campaign=invite" in payload.invite_url
        assert "://signup?" not in payload.invite_url
        assert "vercel.app" not in payload.invite_url

    asyncio.run(with_session(exercise))


def test_referral_stats_ignore_unused_pending_invite_from_get_or_create():
    async def exercise(db_session):
        inviter = await add_user(db_session, "stats-inviter@example.com")
        neighbour = await add_user(db_session, "stats-neighbour@example.com")

        await get_or_create_referral_invite(db_session, inviter.id)
        sent, joined = await get_referral_stats(db_session, inviter.id)
        assert sent == 0
        assert joined == 0

        unused = await get_or_create_referral_invite(db_session, inviter.id)
        unused.status = ReferralInviteStatus.EXPIRED
        await db_session.flush()
        sent, joined = await get_referral_stats(db_session, inviter.id)
        assert sent == 0
        assert joined == 0

        invite = await get_or_create_referral_invite(db_session, inviter.id)
        await redeem_referral(db_session, invite.code, neighbour.id)
        sent, joined = await get_referral_stats(db_session, inviter.id)
        assert sent == 1
        assert joined == 1

    asyncio.run(with_session(exercise))


def test_moderator_invite_skips_document_verification():
    async def exercise(db_session):
        compound = Compound(name="VGK", country="Egypt")
        db_session.add(compound)
        await db_session.flush()
        moderator = User(
            name="mod",
            email="mod-invite@example.com",
            password_hash="test",
            role=UserRole.COMPOUND_MOD,
            status=UserStatus.APPROVED,
        )
        neighbour = User(
            name="neighbour",
            email="mod-invitee@example.com",
            password_hash="test",
            status=UserStatus.PENDING_VERIFICATION,
        )
        db_session.add_all([moderator, neighbour])
        await db_session.flush()
        db_session.add(
            CompoundModeratorProfile(
                user_id=moderator.id,
                compound_id=compound.id,
                moderator_status=ModeratorStatus.APPROVED,
            )
        )
        await db_session.flush()

        granted = await grant_moderator_invite_access(
            db_session, moderator.id, neighbour.id
        )
        assert granted is True
        assert neighbour.status == UserStatus.APPROVED
        assert neighbour.compound_id == compound.id
        assert neighbour.role == UserRole.RESIDENT
        membership = (
            await db_session.execute(
                select(UserCompoundMembership).where(
                    UserCompoundMembership.user_id == neighbour.id,
                    UserCompoundMembership.compound_id == compound.id,
                )
            )
        ).scalar_one()
        assert membership.verification_status == "VERIFIED"
        assert membership.verification_source == "MODERATOR_INVITE"

    asyncio.run(with_session(exercise))


def test_resident_invite_does_not_skip_verification():
    async def exercise(db_session):
        compound = Compound(name="La Mirada", country="Egypt")
        db_session.add(compound)
        await db_session.flush()
        resident = User(
            name="resident",
            email="resident-invite@example.com",
            password_hash="test",
            role=UserRole.RESIDENT,
            status=UserStatus.APPROVED,
            compound_id=compound.id,
        )
        neighbour = User(
            name="neighbour",
            email="resident-invitee@example.com",
            password_hash="test",
            status=UserStatus.PENDING_VERIFICATION,
        )
        db_session.add_all([resident, neighbour])
        await db_session.flush()

        granted = await grant_moderator_invite_access(
            db_session, resident.id, neighbour.id
        )
        assert granted is False
        assert neighbour.status == UserStatus.PENDING_VERIFICATION
        assert neighbour.compound_id is None

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
