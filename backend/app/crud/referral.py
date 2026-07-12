import secrets
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.enums import ReferralInviteStatus
from app.models.launch_accounts import ReferralInvite
from app.schemas.referral import ReferralInviteResponse


class ReferralError(ValueError):
    pass


class ReferralNotFoundError(ReferralError):
    pass


class ReferralUnavailableError(ReferralError):
    pass


class SelfReferralError(ReferralError):
    pass


class DuplicateReferralError(ReferralError):
    pass


async def generate_referral_code(db: AsyncSession) -> str:
    """Generate a URL-safe code and verify uniqueness before insertion."""
    for _ in range(10):
        code = secrets.token_urlsafe(9)
        exists = await db.scalar(
            select(ReferralInvite.id).where(ReferralInvite.code == code)
        )
        if exists is None:
            return code
    raise RuntimeError("Unable to generate a unique referral code")


async def create_referral_invite(
    db: AsyncSession,
    inviter_id: int,
) -> ReferralInvite:
    invite = ReferralInvite(
        code=await generate_referral_code(db),
        inviter_id=inviter_id,
        status=ReferralInviteStatus.PENDING,
    )
    db.add(invite)
    await db.flush()
    await db.refresh(invite)
    return invite


async def get_or_create_referral_invite(
    db: AsyncSession,
    inviter_id: int,
) -> ReferralInvite:
    invite = await db.scalar(
        select(ReferralInvite)
        .where(
            ReferralInvite.inviter_id == inviter_id,
            ReferralInvite.status == ReferralInviteStatus.PENDING,
        )
        .order_by(ReferralInvite.created_at.desc(), ReferralInvite.id.desc())
        .limit(1)
    )
    if invite is not None:
        return invite
    return await create_referral_invite(db, inviter_id)


async def redeem_referral(
    db: AsyncSession,
    code: str,
    accepted_user_id: int,
) -> ReferralInvite:
    already_accepted = await db.scalar(
        select(ReferralInvite.id).where(
            ReferralInvite.accepted_user_id == accepted_user_id
        )
    )
    if already_accepted is not None:
        raise DuplicateReferralError("User has already redeemed a referral")

    invite = await db.scalar(
        select(ReferralInvite)
        .where(ReferralInvite.code == code.strip())
        .with_for_update()
    )
    if invite is None:
        raise ReferralNotFoundError("Referral code not found")
    if invite.inviter_id == accepted_user_id:
        raise SelfReferralError("Users cannot redeem their own referral")
    if invite.status != ReferralInviteStatus.PENDING:
        raise ReferralUnavailableError("Referral code has already been used")

    now = datetime.now(timezone.utc)
    expires_at = invite.expires_at
    if expires_at is not None:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= now:
            raise ReferralUnavailableError("Referral code has expired")

    invite.accepted_user_id = accepted_user_id
    invite.status = ReferralInviteStatus.ACCEPTED
    invite.accepted_at = now
    await db.flush()
    await db.refresh(invite)
    return invite


async def get_referral_stats(db: AsyncSession, inviter_id: int) -> tuple[int, int]:
    invitations_sent = await db.scalar(
        select(func.count(ReferralInvite.id)).where(
            ReferralInvite.inviter_id == inviter_id
        )
    )
    registrations = await db.scalar(
        select(func.count(ReferralInvite.id)).where(
            ReferralInvite.inviter_id == inviter_id,
            ReferralInvite.status == ReferralInviteStatus.ACCEPTED,
        )
    )
    return int(invitations_sent or 0), int(registrations or 0)


def referral_invite_response(invite: ReferralInvite) -> ReferralInviteResponse:
    status_map = {
        ReferralInviteStatus.PENDING: "PENDING",
        ReferralInviteStatus.ACCEPTED: "REGISTERED",
        ReferralInviteStatus.EXPIRED: "EXPIRED",
        ReferralInviteStatus.CANCELLED: "REVOKED",
    }
    reward_map = {
        "NOT_ELIGIBLE": "NOT_APPLICABLE",
        "PENDING": "PENDING",
        "EARNED": "GRANTED",
        "PAID": "GRANTED",
        "VOIDED": "NOT_APPLICABLE",
    }
    invite_url = (
        f"{settings.effective_frontend_url}/signup?ref={invite.code}"
    )
    return ReferralInviteResponse(
        id=invite.id,
        code=invite.code,
        inviter_id=invite.inviter_id,
        accepted_user_id=invite.accepted_user_id,
        status=status_map[invite.status],
        reward_status=reward_map.get(invite.reward_status.value),
        created_at=invite.created_at,
        registered_at=invite.accepted_at,
        expires_at=invite.expires_at,
        invite_url=invite_url,
    )
