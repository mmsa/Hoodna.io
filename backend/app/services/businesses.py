import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud import business as business_crud
from app.models.business import BusinessClaim, BusinessMembership, IndependentBusiness
from app.models.enums import (
    BusinessClaimStatus,
    BusinessMembershipRole,
    BusinessVerificationStatus,
)
from app.schemas.business import (
    BusinessClaimCreate,
    BusinessClaimResponse,
    BusinessResponse,
    BusinessOfferResponse,
)

logger = logging.getLogger(__name__)


class BusinessError(ValueError):
    pass


class BusinessNotFoundError(BusinessError):
    pass


class ActiveClaimExistsError(BusinessError):
    pass


class ClaimTransitionError(BusinessError):
    pass


def public_status(status: BusinessVerificationStatus) -> str:
    return status.value.lower()


async def business_response(
    db: AsyncSession, business: IndependentBusiness, viewer_id: int | None = None
) -> BusinessResponse:
    claim_status = None
    membership_role = None
    if viewer_id is not None:
        claim = await business_crud.get_current_claim(db, viewer_id, business.id)
        membership = await business_crud.get_membership(db, viewer_id, business.id)
        claim_status = claim.status if claim else None
        membership_role = membership.role if membership else None
    values = {column.name: getattr(business, column.name) for column in business.__table__.columns}
    # Eager offers if loaded; otherwise fetch active (or all for owners)
    offers = list(getattr(business, "offers", []) or [])
    if not offers:
        from sqlalchemy.orm import selectinload
        from app.models.business import BusinessOffer

        loaded = await db.get(
            IndependentBusiness,
            business.id,
            options=[selectinload(IndependentBusiness.offers)],
        )
        offers = list(loaded.offers) if loaded else []
    show_all = membership_role in (
        BusinessMembershipRole.OWNER,
        BusinessMembershipRole.MANAGER,
    )
    offer_models = [
        o
        for o in offers
        if show_all or o.is_active
    ]
    values.update(
        public_status=public_status(business.verification_status),
        viewer_claim_status=claim_status,
        viewer_membership_role=membership_role,
        profile_views=getattr(business, "profile_views", 0) or 0,
        offers=[BusinessOfferResponse.model_validate(o) for o in offer_models],
    )
    return BusinessResponse.model_validate(values)


async def claim_response(
    db: AsyncSession, claim: BusinessClaim
) -> BusinessClaimResponse:
    business = await db.get(IndependentBusiness, claim.business_id)
    if business is None:
        raise BusinessNotFoundError("Business not found")
    values = {column.name: getattr(claim, column.name) for column in claim.__table__.columns}
    values.update(
        business_slug=business.slug,
        business_name=business.name,
        business_verification_status=business.verification_status,
        public_status=public_status(business.verification_status),
    )
    return BusinessClaimResponse.model_validate(values)


async def submit_claim(
    db: AsyncSession,
    *,
    business: IndependentBusiness,
    claimant_id: int,
    data: BusinessClaimCreate,
) -> BusinessClaim:
    if not business.is_active or business.is_hidden:
        raise BusinessNotFoundError("Business not found")
    if await business_crud.get_active_claim(db, claimant_id, business.id):
        raise ActiveClaimExistsError(
            "An active claim already exists for this user and business"
        )

    claim = BusinessClaim(
        business_id=business.id,
        claimant_id=claimant_id,
        **data.model_dump(mode="json"),
    )
    db.add(claim)
    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        logger.warning(
            "business_claim_duplicate",
            extra={"business_id": business.id, "claimant_id": claimant_id},
        )
        raise ActiveClaimExistsError(
            "An active claim already exists for this user and business"
        ) from exc
    await db.refresh(claim)
    logger.info(
        "business_claim_submitted",
        extra={
            "claim_id": claim.id,
            "business_id": business.id,
            "claimant_id": claimant_id,
        },
    )
    return claim


async def review_claim(
    db: AsyncSession,
    *,
    claim_id: int,
    reviewer_id: int,
    decision: BusinessClaimStatus,
    review_notes: str | None = None,
    membership_role: BusinessMembershipRole = BusinessMembershipRole.OWNER,
) -> BusinessClaim:
    if decision not in (BusinessClaimStatus.APPROVED, BusinessClaimStatus.REJECTED):
        raise ClaimTransitionError("Review decision must be APPROVED or REJECTED")

    result = await db.execute(
        select(BusinessClaim)
        .where(BusinessClaim.id == claim_id)
        .with_for_update()
    )
    claim = result.scalar_one_or_none()
    if claim is None:
        raise BusinessNotFoundError("Business claim not found")
    if claim.status != BusinessClaimStatus.PENDING:
        raise ClaimTransitionError("Only pending claims can be reviewed")
    if claim.claimant_id is None:
        raise ClaimTransitionError("Cannot approve a claim whose claimant was deleted")

    business = await db.get(IndependentBusiness, claim.business_id)
    if business is None:
        raise BusinessNotFoundError("Business not found")

    claim.status = decision
    claim.reviewed_at = datetime.now(timezone.utc)
    claim.reviewer_id = reviewer_id
    claim.review_notes = review_notes

    if decision == BusinessClaimStatus.APPROVED:
        membership = await business_crud.get_membership(
            db, claim.claimant_id, claim.business_id
        )
        if membership is None:
            db.add(
                BusinessMembership(
                    business_id=claim.business_id,
                    user_id=claim.claimant_id,
                    role=membership_role,
                )
            )
        else:
            membership.role = membership_role

        # Approval claims an unverified record. VERIFIED is never downgraded.
        if business.verification_status == BusinessVerificationStatus.UNVERIFIED:
            business.verification_status = BusinessVerificationStatus.CLAIMED

    await db.flush()
    await db.refresh(claim)
    logger.info(
        "business_claim_reviewed",
        extra={
            "claim_id": claim.id,
            "business_id": claim.business_id,
            "claimant_id": claim.claimant_id,
            "reviewer_id": reviewer_id,
            "decision": decision.value,
            "membership_role": membership_role.value
            if decision == BusinessClaimStatus.APPROVED
            else None,
        },
    )
    return claim
