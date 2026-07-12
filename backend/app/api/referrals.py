import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.crud.referral import (
    DuplicateReferralError,
    ReferralNotFoundError,
    ReferralUnavailableError,
    SelfReferralError,
    create_referral_invite,
    get_referral_invites,
    get_or_create_referral_invite,
    get_referral_stats,
    redeem_referral,
    referral_invite_response,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.referral import (
    ReferralCreate,
    ReferralMeResponse,
    ReferralRedeem,
    ReferralRedeemResponse,
    ReferralStatsResponse,
    ReferralInviteResponse,
)
from app.services.feature_flags import referral_invitations_enabled


router = APIRouter()
logger = logging.getLogger(__name__)


async def require_referral_invitations(
    db: AsyncSession,
    user: User,
) -> None:
    if not await referral_invitations_enabled(db, user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Referral invitations are not available",
        )


@router.get("/me", response_model=ReferralMeResponse)
async def referral_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_referral_invitations(db, current_user)
    invite = await get_or_create_referral_invite(db, current_user.id)
    response = referral_invite_response(invite)
    return ReferralMeResponse(
        code=invite.code,
        invite_url=response.invite_url,
        invite=response,
    )


@router.post(
    "/invites",
    response_model=ReferralInviteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_invite(
    request: ReferralCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_referral_invitations(db, current_user)
    invite = await create_referral_invite(db, current_user.id)
    logger.info(
        "referral_invite_created",
        extra={
            "user_id": current_user.id,
            "referral_invite_id": invite.id,
            "source": request.source,
        },
    )
    return referral_invite_response(invite)


@router.get("/invites", response_model=list[ReferralInviteResponse])
async def list_invites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_referral_invitations(db, current_user)
    invites = await get_referral_invites(db, current_user.id)
    return [referral_invite_response(invite) for invite in invites]


@router.post("/redeem", response_model=ReferralRedeemResponse)
async def redeem_invite(
    request: ReferralRedeem,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        invite = await redeem_referral(db, request.code, current_user.id)
    except ReferralNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except (SelfReferralError, DuplicateReferralError) as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except ReferralUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail=str(exc))

    logger.info(
        "referral_redeemed",
        extra={
            "user_id": current_user.id,
            "referral_invite_id": invite.id,
            "inviter_id": invite.inviter_id,
        },
    )
    return ReferralRedeemResponse(
        redeemed=True,
        invite=referral_invite_response(invite),
    )


@router.get("/stats", response_model=ReferralStatsResponse)
async def referral_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    invitations_sent, successful_registrations = await get_referral_stats(
        db, current_user.id
    )
    return ReferralStatsResponse(
        invitations_sent=invitations_sent,
        successful_registrations=successful_registrations,
    )
