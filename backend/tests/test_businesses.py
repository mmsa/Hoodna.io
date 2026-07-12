import pytest
from fastapi import HTTPException
from sqlalchemy import select

import app.models.all  # noqa: F401
from app.core.dependencies import get_current_platform_admin, get_current_user
from app.crud.business import create_business
from app.models.business import BusinessMembership
from app.models.enums import (
    BusinessClaimStatus,
    BusinessMembershipRole,
    BusinessVerificationStatus,
    UserRole,
    UserStatus,
)
from app.models.feature_flag import FeatureFlag
from app.models.user import User
from app.schemas.business import BusinessClaimCreate, BusinessCreate
from app.services.businesses import ActiveClaimExistsError, review_claim, submit_claim
from app.services.business_feature_flags import require_business_claiming
from app.services.feature_flags import clear_feature_flag_cache


def make_user(email: str, role: UserRole = UserRole.USER) -> User:
    return User(
        name=email.split("@")[0],
        email=email,
        password_hash="not-used",
        role=role,
        status=UserStatus.APPROVED,
    )


def claim_data() -> BusinessClaimCreate:
    return BusinessClaimCreate(
        full_name="Business Owner",
        relationship_role="Owner",
        phone="+201001234567",
        email="owner@example.com",
        supporting_info="I can provide the commercial registration.",
        supporting_documents=["s3://claims/registration.pdf"],
    )


async def seed_business(db_session, status=BusinessVerificationStatus.UNVERIFIED):
    return await create_business(
        db_session,
        BusinessCreate(
            name="Local Bakery",
            city="Cairo",
            category="Bakery",
            verification_status=status,
        ),
    )


@pytest.mark.asyncio
async def test_submit_claim_and_reject_duplicate_active_claim(db_session):
    user = make_user("claimant@example.com")
    db_session.add(user)
    await db_session.flush()
    business = await seed_business(db_session)

    claim = await submit_claim(
        db_session, business=business, claimant_id=user.id, data=claim_data()
    )

    assert claim.status == BusinessClaimStatus.PENDING
    assert claim.claimant_id == user.id
    with pytest.raises(ActiveClaimExistsError, match="active claim"):
        await submit_claim(
            db_session, business=business, claimant_id=user.id, data=claim_data()
        )


@pytest.mark.asyncio
async def test_approve_claim_creates_membership_and_claims_business(db_session):
    claimant = make_user("claimant@example.com")
    admin = make_user("admin@example.com", UserRole.ADMIN)
    db_session.add_all([claimant, admin])
    await db_session.flush()
    business = await seed_business(db_session)
    claim = await submit_claim(
        db_session, business=business, claimant_id=claimant.id, data=claim_data()
    )

    reviewed = await review_claim(
        db_session,
        claim_id=claim.id,
        reviewer_id=admin.id,
        decision=BusinessClaimStatus.APPROVED,
        membership_role=BusinessMembershipRole.MANAGER,
        review_notes="Documents matched.",
    )
    membership = (
        await db_session.execute(
            select(BusinessMembership).where(
                BusinessMembership.business_id == business.id,
                BusinessMembership.user_id == claimant.id,
            )
        )
    ).scalar_one()

    assert reviewed.status == BusinessClaimStatus.APPROVED
    assert reviewed.reviewed_at is not None
    assert reviewed.reviewer_id == admin.id
    assert membership.role == BusinessMembershipRole.MANAGER
    assert business.verification_status == BusinessVerificationStatus.CLAIMED
    assert claimant.role == UserRole.USER


@pytest.mark.asyncio
async def test_approve_claim_does_not_downgrade_verified_business(db_session):
    claimant = make_user("claimant@example.com")
    admin = make_user("admin@example.com", UserRole.ADMIN)
    db_session.add_all([claimant, admin])
    await db_session.flush()
    business = await seed_business(db_session, BusinessVerificationStatus.VERIFIED)
    claim = await submit_claim(
        db_session, business=business, claimant_id=claimant.id, data=claim_data()
    )

    await review_claim(
        db_session,
        claim_id=claim.id,
        reviewer_id=admin.id,
        decision=BusinessClaimStatus.APPROVED,
    )

    assert business.verification_status == BusinessVerificationStatus.VERIFIED


@pytest.mark.asyncio
async def test_business_claiming_requires_auth_and_enabled_feature(db_session):
    with pytest.raises(HTTPException) as unauthenticated:
        await get_current_user(credentials=None, db=db_session)
    assert unauthenticated.value.status_code == 401

    user = make_user("claimant@example.com")
    flag = FeatureFlag(key="business_claiming", enabled=False)
    db_session.add_all([user, flag])
    await db_session.flush()
    clear_feature_flag_cache()

    with pytest.raises(HTTPException) as disabled:
        await require_business_claiming(current_user=user, db=db_session)
    assert disabled.value.status_code == 403

    flag.enabled = True
    await db_session.flush()
    clear_feature_flag_cache()
    assert await require_business_claiming(current_user=user, db=db_session) is user


@pytest.mark.asyncio
async def test_business_admin_requires_platform_admin_role():
    regular_user = make_user("user@example.com")
    moderator = make_user("moderator@example.com", UserRole.MODERATOR)
    admin = make_user("admin@example.com", UserRole.ADMIN)

    for user in (regular_user, moderator):
        with pytest.raises(HTTPException) as forbidden:
            await get_current_platform_admin(current_user=user)
        assert forbidden.value.status_code == 403

    assert await get_current_platform_admin(current_user=admin) is admin
