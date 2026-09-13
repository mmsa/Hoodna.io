"""Growth measurement: first-touch attribution, timestamps, and admin KPIs."""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.api import beta_metrics as beta_metrics_api
from app.core.dependencies import get_current_user
from app.crud.referral import create_referral_invite
from app.crud.user_compound_membership import ensure_user_compound_membership
from app.db.session import get_db
from app.models.compound import Compound
from app.models.enums import PostCategory, UserRole, UserStatus
from app.models.post import Post
from app.models.telemetry import AnalyticsEvent
from app.models.user import User
from app.services.growth import (
    apply_first_touch_attribution,
    mark_resident_verified,
    maybe_set_activated_at,
)
from app.services.growth_metrics import get_growth_metrics


async def _user_by_email(db_session, email: str) -> User:
    return (await db_session.execute(select(User).where(User.email == email))).scalar_one()


def _disable_otp_delivery(monkeypatch):
    """Signup may generate OTP codes locally; providers must not be called."""

    def _sms_must_not_send(*_args, **_kwargs):
        raise AssertionError("SMS OTP must not be sent")

    monkeypatch.setattr("app.services.sms.sms_delivery_configured", lambda: False)
    monkeypatch.setattr("app.services.sms.send_otp_sms", _sms_must_not_send)
    monkeypatch.setattr("app.api.auth.send_email_verification_email", lambda *_a, **_k: False)


@pytest.mark.asyncio
@pytest.mark.unit
async def test_signup_persists_utm_after_landing_path_only_first_touch(
    async_client, db_session, monkeypatch
):
    """Browser first-touch was landing_path-only; later UTMs must persist on signup.

    Mirrors production: localStorage {landing_path: '/'} then
    /auth/signup?utm_source=chatgpt_test&utm_medium=test&utm_campaign=growth_tracking_test&utm_content=manual_test
    Shared mergeFirstTouch would then send this attribution blob. No SMS/email.
    """
    _disable_otp_delivery(monkeypatch)

    stored = {"landing_path": "/"}
    later_utm = {
        "source": "chatgpt_test",
        "medium": "test",
        "campaign": "growth_tracking_test",
        "content": "manual_test",
        "landing_path": "/auth/signup",
    }
    marketing_keys = ("source", "medium", "campaign", "content", "term")
    merged = later_utm if not any(stored.get(key) for key in marketing_keys) else stored

    response = await async_client.post(
        "/api/auth/signup",
        json={
            "name": "UTM After Landing",
            "email": "utm-after-landing@example.com",
            "phone": "+201555000099",
            "password": "password123",
            "platform": "web",
            "attribution": merged,
        },
    )
    assert response.status_code == 201
    user = await _user_by_email(db_session, "utm-after-landing@example.com")
    assert user.registration_platform == "web"
    assert user.attribution["source"] == "chatgpt_test"
    assert user.attribution["medium"] == "test"
    assert user.attribution["campaign"] == "growth_tracking_test"
    assert user.attribution["content"] == "manual_test"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_email_signup_persists_first_touch_attribution(async_client, db_session):
    response = await async_client.post(
        "/api/auth/signup",
        json={
            "name": "Growth Email",
            "email": "growth-email@example.com",
            "phone": "+201555000001",
            "password": "password123",
            "platform": "web",
            "attribution": {
                "source": "facebook",
                "medium": "cpc",
                "campaign": "launch",
            },
        },
    )
    assert response.status_code == 201
    user = await _user_by_email(db_session, "growth-email@example.com")
    assert user.registration_platform == "web"
    assert user.attribution["source"] == "facebook"
    assert user.attribution["campaign"] == "launch"
    me = await async_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {response.json()['access_token']}"},
    )
    assert me.status_code == 200
    assert "attribution" not in me.json()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_email_signup_referral_and_write_once_attribution(async_client, db_session):
    inviter = User(
        name="Inviter",
        email="growth-inviter@example.com",
        password_hash="x",
        role=UserRole.RESIDENT,
        status=UserStatus.APPROVED,
    )
    db_session.add(inviter)
    await db_session.flush()
    invite = await create_referral_invite(db_session, inviter.id)
    await db_session.commit()

    first = await async_client.post(
        "/api/auth/signup",
        json={
            "name": "Referred Email",
            "email": "growth-referred@example.com",
            "phone": "+201555000002",
            "password": "password123",
            "platform": "ios",
            "referral_code": invite.code,
            "attribution": {"source": "referral", "medium": "referral", "campaign": "invite"},
        },
    )
    assert first.status_code == 201
    user = await _user_by_email(db_session, "growth-referred@example.com")
    assert user.attribution["source"] == "referral"
    assert user.registration_platform == "ios"

    apply_first_touch_attribution(
        user,
        attribution={"source": "google", "campaign": "later"},
        platform="android",
    )
    assert user.attribution["source"] == "referral"
    assert user.attribution.get("campaign") == "invite"
    assert user.registration_platform == "ios"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_phone_otp_registration_attribution_and_referral(async_client, db_session):
    import time

    from app.api.auth import otp_storage
    from app.utils.phone import normalize_phone

    inviter = User(
        name="Phone Inviter",
        email="growth-phone-inviter@example.com",
        password_hash="x",
        role=UserRole.RESIDENT,
        status=UserStatus.APPROVED,
    )
    db_session.add(inviter)
    await db_session.flush()
    invite = await create_referral_invite(db_session, inviter.id)
    await db_session.commit()

    phone = "+201555000003"
    normalized = normalize_phone(phone)
    otp_storage[normalized] = {"otp": "222333", "expires_at": time.time() + 600}

    response = await async_client.post(
        "/api/auth/verify",
        json={
            "phone": phone,
            "otp_code": "222333",
            "name": "Growth Phone",
            "platform": "android",
            "referral_code": invite.code,
            "attribution": {"source": "whatsapp", "medium": "social", "campaign": "invite"},
        },
    )
    assert response.status_code == 200
    user = (
        await db_session.execute(select(User).where(User.phone == normalized))
    ).scalar_one()
    assert user.registration_platform == "android"
    assert user.attribution["source"] == "whatsapp"
    assert user.attribution["campaign"] == "invite"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_verified_and_activated_timestamps_are_write_once(db_session):
    user = User(
        name="Activated",
        email="growth-activated@example.com",
        password_hash="x",
        role=UserRole.RESIDENT,
        status=UserStatus.APPROVED,
    )
    db_session.add(user)
    await db_session.flush()
    first = datetime(2026, 1, 1, tzinfo=timezone.utc)
    mark_resident_verified(user, at=first)
    mark_resident_verified(user, at=datetime(2026, 2, 1, tzinfo=timezone.utc))
    assert user.verified_at == first

    await maybe_set_activated_at(db_session, user)
    first_activated = user.activated_at
    await maybe_set_activated_at(db_session, user)
    assert user.activated_at == first_activated


@pytest.mark.asyncio
@pytest.mark.unit
async def test_membership_sets_verified_at(db_session):
    compound = Compound(name="Growth Compound", country="Egypt")
    user = User(
        name="Verified",
        email="growth-verified@example.com",
        password_hash="x",
        role=UserRole.RESIDENT,
        status=UserStatus.APPROVED,
    )
    db_session.add_all([compound, user])
    await db_session.flush()
    await ensure_user_compound_membership(db_session, user.id, compound.id)
    await db_session.refresh(user)
    assert user.verified_at is not None


@pytest.mark.asyncio
@pytest.mark.unit
async def test_growth_metrics_exclude_demo_and_include_wavr(db_session):
    now = datetime.now(timezone.utc)
    week_start = now.date() - timedelta(days=now.weekday())
    compound = Compound(name="WAVR Compound", country="Egypt")
    db_session.add(compound)
    await db_session.flush()

    resident = User(
        name="WAVR Resident",
        email="wavr@example.com",
        password_hash="x",
        role=UserRole.RESIDENT,
        status=UserStatus.APPROVED,
        compound_id=compound.id,
        creation_source="EMAIL_SIGNUP",
        attribution={"source": "facebook", "campaign": "launch"},
        registration_platform="web",
        verified_at=now - timedelta(days=2),
        activated_at=now - timedelta(days=1),
    )
    lurker = User(
        name="WAVR Lurker",
        email="lurker@example.com",
        password_hash="x",
        role=UserRole.RESIDENT,
        status=UserStatus.APPROVED,
        compound_id=compound.id,
        creation_source="EMAIL_SIGNUP",
        attribution={"source": "google", "campaign": "search"},
        registration_platform="ios",
        verified_at=now - timedelta(days=40),
    )
    demo = User(
        name="Demo",
        email="demo@example.com",
        password_hash="x",
        role=UserRole.RESIDENT,
        status=UserStatus.APPROVED,
        creation_source="DEMO",
        verified_at=now,
        activated_at=now,
    )
    imported = User(
        name="Imported",
        email="import@example.com",
        password_hash="x",
        role=UserRole.RESIDENT,
        status=UserStatus.APPROVED,
        compound_id=compound.id,
        creation_source="CHAT_IMPORT",
        attribution={"source": "chat_import", "medium": "import"},
        verified_at=now - timedelta(days=3),
        activated_at=now - timedelta(days=3),
    )
    db_session.add_all([resident, lurker, demo, imported])
    await db_session.flush()
    db_session.add(
        Post(
            compound_id=compound.id,
            author_id=resident.id,
            content="hello neighbours",
            category=PostCategory.GENERAL,
            created_at=now,
        )
    )
    db_session.add(
        AnalyticsEvent(
            event_name="app_opened",
            user_id=lurker.id,
            properties={},
            occurred_at=now,
        )
    )
    await db_session.flush()

    metrics = await get_growth_metrics(db_session, week_start)
    assert metrics["total_registrations"] == 3
    assert metrics["verified_residents"] == 3
    assert metrics["activated_verified_residents"] == 2
    assert metrics["wavr"] == 2
    assert metrics["active_compounds"] == 1
    sources = {row["key"]: row for row in metrics["by_source"]}
    assert "facebook" in sources
    assert "chat_import" in sources
    assert "DEMO" not in sources
    assert sources["facebook"]["wavr"] == 1
    assert sources["google"]["wavr"] == 1


@pytest.mark.asyncio
@pytest.mark.unit
async def test_d7_return_retention_window(db_session):
    now = datetime.now(timezone.utc)
    compound = Compound(name="Retention Compound", country="Egypt")
    db_session.add(compound)
    await db_session.flush()
    verified_at = now - timedelta(days=10)
    returned = User(
        name="Returned",
        email="d7-yes@example.com",
        password_hash="x",
        role=UserRole.RESIDENT,
        status=UserStatus.APPROVED,
        compound_id=compound.id,
        verified_at=verified_at,
        activated_at=verified_at + timedelta(days=1),
    )
    silent = User(
        name="Silent",
        email="d7-no@example.com",
        password_hash="x",
        role=UserRole.RESIDENT,
        status=UserStatus.APPROVED,
        compound_id=compound.id,
        verified_at=verified_at,
    )
    db_session.add_all([returned, silent])
    await db_session.flush()
    db_session.add(
        Post(
            compound_id=compound.id,
            author_id=returned.id,
            content="back again",
            created_at=verified_at + timedelta(days=3),
        )
    )
    await db_session.flush()
    metrics = await get_growth_metrics(db_session)
    assert metrics["d7_eligible"] == 2
    assert metrics["d7_returned"] == 1


@pytest.mark.asyncio
async def test_growth_metrics_endpoint_admin_only(db_session):
    app = FastAPI()
    app.include_router(beta_metrics_api.router, prefix="/api/admin")
    resident = User(role=UserRole.RESIDENT)
    admin = User(role=UserRole.ADMIN)

    async def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: resident
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        denied = await client.get("/api/admin/growth-metrics")
        assert denied.status_code == 403
        app.dependency_overrides[get_current_user] = lambda: admin
        allowed = await client.get("/api/admin/growth-metrics")
        assert allowed.status_code == 200
        body = allowed.json()
        assert "wavr" in body
        assert "by_source" in body
