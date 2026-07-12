from datetime import date, datetime, timezone

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient

from app.api import beta_metrics as beta_metrics_api
from app.api.beta_metrics import require_admin_only
from app.api.internal import require_cron_secret
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.business import BusinessClaim, IndependentBusiness
from app.models.compound import Compound
from app.models.enums import (
    BusinessClaimStatus,
    ReferralInviteStatus,
    UserRole,
    UserStatus,
)
from app.models.launch_accounts import ReferralInvite
from app.models.post import Comment, Post
from app.models.report import Report
from app.models.telemetry import AnalyticsEvent, ClientErrorReport
from app.models.user import User
from app.services.beta_metrics import get_beta_metrics


@pytest.mark.asyncio
async def test_beta_metrics_requires_admin_role():
    moderator = User(role=UserRole.MODERATOR)
    with pytest.raises(HTTPException) as error:
        await require_admin_only(moderator)
    assert error.value.status_code == 403

    admin = User(role=UserRole.ADMIN)
    assert await require_admin_only(admin) is admin


@pytest.mark.asyncio
async def test_beta_metrics_endpoint_rejects_non_admin(db_session):
    app = FastAPI()
    app.include_router(beta_metrics_api.router, prefix="/api/admin")
    moderator = User(role=UserRole.MODERATOR)
    admin = User(role=UserRole.ADMIN)

    async def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: moderator
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        denied = await client.get("/api/admin/beta-metrics")
        assert denied.status_code == 403

        app.dependency_overrides[get_current_user] = lambda: admin
        allowed = await client.get("/api/admin/beta-metrics")
        assert allowed.status_code == 200


def test_weekly_digest_job_requires_constant_secret(monkeypatch):
    monkeypatch.setattr(settings, "CRON_SECRET", "expected-secret")
    with pytest.raises(HTTPException) as error:
        require_cron_secret("wrong-secret", None)
    assert error.value.status_code == 401
    assert require_cron_secret("expected-secret", None) is None
    assert require_cron_secret(None, "Bearer expected-secret") is None


@pytest.mark.asyncio
async def test_beta_metrics_totals_and_rate(db_session):
    occurred = datetime(2026, 7, 10, 12, tzinfo=timezone.utc)
    compound = Compound(name="Metrics Compound", country="Egypt")
    db_session.add(compound)
    await db_session.flush()

    users = [
        User(
            name=f"User {number}",
            email=f"metrics-{number}@example.com",
            password_hash="not-used",
            role=UserRole.USER,
            status=UserStatus.APPROVED,
            compound_id=compound.id,
            created_at=occurred,
        )
        for number in (1, 2)
    ]
    db_session.add_all(users)
    await db_session.flush()

    post = Post(
        compound_id=compound.id,
        author_id=users[0].id,
        content="Metrics post",
        created_at=occurred,
    )
    db_session.add(post)
    await db_session.flush()
    db_session.add(
        Comment(
            post_id=post.id,
            author_id=users[1].id,
            content="Metrics comment",
            created_at=occurred,
        )
    )

    business = IndependentBusiness(
        slug="metrics-business",
        name="Metrics Business",
        compound_id=compound.id,
        city="Cairo",
        category="Services",
        created_at=occurred,
    )
    db_session.add(business)
    await db_session.flush()
    db_session.add(
        BusinessClaim(
            business_id=business.id,
            claimant_id=users[0].id,
            full_name="Owner",
            relationship_role="Owner",
            phone="01000000000",
            email="owner@example.com",
            status=BusinessClaimStatus.PENDING,
            submitted_at=occurred,
        )
    )
    db_session.add(
        Report(
            reporter_id=users[0].id,
            reported_type="post",
            reported_id=post.id,
            reason="spam",
            status="PENDING",
            created_at=occurred,
        )
    )
    db_session.add(
        ReferralInvite(
            code="metrics-referral",
            inviter_id=users[0].id,
            accepted_user_id=users[1].id,
            status=ReferralInviteStatus.ACCEPTED,
            accepted_at=occurred,
            created_at=occurred,
        )
    )
    db_session.add(
        ClientErrorReport(
            user_id=users[0].id,
            message="Safe aggregate test error",
            created_at=occurred,
        )
    )
    db_session.add_all(
        [
            AnalyticsEvent(
                event_name="registration_completed",
                user_id=user.id,
                occurred_at=occurred,
            )
            for user in users
        ]
        + [
            AnalyticsEvent(
                event_name="onboarding_completed",
                user_id=users[0].id,
                occurred_at=occurred,
            ),
            AnalyticsEvent(
                event_name="search_performed",
                user_id=users[0].id,
                occurred_at=occurred,
            ),
        ]
    )
    await db_session.commit()

    metrics = await get_beta_metrics(
        db_session, date(2026, 7, 10), date(2026, 7, 10)
    )

    assert metrics["total_registered_users"] == 2
    assert metrics["new_users_by_day"] == [
        {"date": date(2026, 7, 10), "value": 2}
    ]
    assert metrics["onboarding_completion_rate"] == 0.5
    assert metrics["active_users"] == 2
    assert metrics["posts_created"] == 1
    assert metrics["comments_created"] == 1
    assert metrics["searches_performed"] == 1
    assert metrics["business_claims"] == 1
    assert metrics["reports_awaiting_review"] == 1
    assert metrics["invitations_sent"] == 1
    assert metrics["successful_referrals"] == 1
    assert metrics["client_errors"] == 1
