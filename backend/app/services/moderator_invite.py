"""Skip document verification when a compound moderator invites a neighbour."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.compound import Compound
from app.models.enums import ModeratorStatus, UserRole, UserStatus
from app.models.user import User

STAFF_INVITE_ROLES = {UserRole.ADMIN, UserRole.MODERATOR, UserRole.COMPOUND_MOD}


async def resolve_moderator_invite_compound_id(
    db: AsyncSession,
    inviter: User,
) -> int | None:
    """Compound the invitee should join when the inviter is trusted staff."""
    if inviter.role not in STAFF_INVITE_ROLES:
        return None

    from app.crud.moderator import get_moderator_profile

    profile = await get_moderator_profile(db, inviter.id)
    if profile and profile.compound_id:
        if inviter.role in (UserRole.ADMIN, UserRole.MODERATOR):
            return int(profile.compound_id)
        if profile.moderator_status == ModeratorStatus.APPROVED:
            return int(profile.compound_id)

    assigned = await db.scalar(
        select(Compound.id).where(Compound.moderator_id == inviter.id).limit(1)
    )
    if assigned:
        return int(assigned)
    if inviter.compound_id:
        return int(inviter.compound_id)
    return None


async def grant_moderator_invite_access(
    db: AsyncSession,
    inviter_id: int,
    accepted_user_id: int,
) -> bool:
    """Approve the invitee for the moderator's compound. No document upload."""
    inviter = await db.get(User, inviter_id)
    accepted = await db.get(User, accepted_user_id)
    if not inviter or not accepted:
        return False

    compound_id = await resolve_moderator_invite_compound_id(db, inviter)
    if not compound_id:
        return False

    from app.crud.user_compound_membership import ensure_user_compound_membership

    await ensure_user_compound_membership(
        db, accepted.id, compound_id, source="MODERATOR_INVITE"
    )
    if accepted.compound_id is None:
        accepted.compound_id = compound_id
    if accepted.status == UserStatus.PENDING_VERIFICATION:
        accepted.status = UserStatus.APPROVED
    if accepted.role is None:
        accepted.role = UserRole.RESIDENT
    await db.flush()
    return True
