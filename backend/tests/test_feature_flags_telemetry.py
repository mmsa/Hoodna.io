from datetime import datetime, timezone

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.api import auth as auth_api
from app.api import feature_flags as feature_api
from app.api import telemetry as telemetry_api
from app.core.config import settings
from app.core.dependencies import get_current_user, get_current_user_optional
from app.db.session import get_db
from app.models.compound import Compound
from app.models.enums import FeatureFlagScope, UserRole, UserStatus
from app.models.feature_flag import FeatureFlag, FeatureFlagOverride
from app.models.telemetry import AnalyticsEvent, ClientErrorReport
from app.models.user import User
from app.schemas.telemetry import AnalyticsBatchInput
from app.services.feature_flags import (
    FlagContext,
    clear_feature_flag_cache,
    evaluate_feature_flag,
    referral_invitations_enabled,
    require_business_reviews,
    require_community_posting,
)


def make_user(email: str, role: UserRole = UserRole.USER) -> User:
    return User(
        name="Telemetry Test",
        email=email,
        password_hash="not-used",
        role=role,
        status=UserStatus.APPROVED,
    )


@pytest.mark.asyncio
async def test_flag_precedence_scoping_rollout_and_geography(db_session, monkeypatch):
    compound = Compound(name="Palm Hills", city="Cairo")
    user = make_user("flag-user@example.com")
    db_session.add_all([compound, user])
    await db_session.flush()
    user.compound_id = compound.id

    flag = FeatureFlag(
        key="community_posting",
        enabled=False,
        config={"rollout_percentage": 100},
    )
    db_session.add(flag)
    await db_session.flush()
    db_session.add_all(
        [
            FeatureFlagOverride(
                feature_flag_id=flag.id,
                scope=FeatureFlagScope.CITY,
                target_key="cairo",
                city="cairo",
                enabled=True,
                config={},
            ),
            FeatureFlagOverride(
                feature_flag_id=flag.id,
                scope=FeatureFlagScope.COMPOUND,
                target_key=str(compound.id),
                compound_id=compound.id,
                enabled=False,
                config={},
            ),
            FeatureFlagOverride(
                feature_flag_id=flag.id,
                scope=FeatureFlagScope.USER,
                target_key=str(user.id),
                user_id=user.id,
                enabled=True,
                config={},
            ),
        ]
    )
    await db_session.commit()
    clear_feature_flag_cache()

    decision = await evaluate_feature_flag(
        db_session,
        "community_posting",
        FlagContext(user_id=user.id, compound_id=compound.id, city="CAIRO"),
    )
    assert decision.enabled is True
    assert decision.source == "user"

    decision = await evaluate_feature_flag(
        db_session,
        "community_posting",
        FlagContext(compound_id=compound.id, city="Cairo"),
    )
    assert decision.enabled is False
    assert decision.source == "compound"

    flag.config = {"rollout_percentage": 0}
    await db_session.commit()
    clear_feature_flag_cache()
    decision = await evaluate_feature_flag(
        db_session,
        "community_posting",
        FlagContext(city="Cairo", anonymous_id="stable-browser"),
    )
    assert decision.enabled is False

    monkeypatch.setattr(settings, "FEATURE_ENABLED_CITIES", "Alexandria")
    clear_feature_flag_cache()
    decision = await evaluate_feature_flag(
        db_session,
        "community_posting",
        FlagContext(user_id=user.id, compound_id=compound.id, city="Cairo"),
    )
    assert decision.enabled is False


@pytest.mark.asyncio
async def test_registration_flag_is_enforced(db_session, monkeypatch):
    monkeypatch.setattr(settings, "FEATURE_USER_REGISTRATION_ENABLED", False)
    clear_feature_flag_cache()
    app = FastAPI()
    app.include_router(auth_api.router, prefix="/api/auth")

    async def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/api/auth/signup",
            json={
                "name": "Closed Registration",
                "email": "closed@example.com",
                "password": "password123",
                "role": "USER",
            },
        )
    assert response.status_code == 403
    assert "unavailable" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_disabled_launch_features_are_enforced_server_side(db_session, monkeypatch):
    user = make_user("feature-enforcement@example.com")
    db_session.add(user)
    await db_session.commit()
    monkeypatch.setattr(settings, "FEATURE_INVITATIONS_ENABLED", False)
    monkeypatch.setattr(settings, "FEATURE_COMMUNITY_POSTING_ENABLED", False)
    monkeypatch.setattr(settings, "FEATURE_BUSINESS_REVIEWS_ENABLED", False)
    clear_feature_flag_cache()

    assert await referral_invitations_enabled(db_session, user) is False
    for dependency in (require_community_posting, require_business_reviews):
        with pytest.raises(HTTPException) as forbidden:
            await dependency(current_user=user, db=db_session)
        assert forbidden.value.status_code == 403


def test_event_taxonomy_and_safe_metadata_validation():
    now = datetime.now(timezone.utc).isoformat()
    valid = AnalyticsBatchInput.model_validate(
        {
            "events": [
                {
                    "event": "search_performed",
                    "properties": {"category": "services", "result_count": 3},
                    "occurred_at": now,
                }
            ]
        }
    )
    assert valid.events[0].event == "search_performed"

    with pytest.raises(ValueError):
        AnalyticsBatchInput.model_validate(
            {
                "events": [
                    {
                        "event": "not_in_taxonomy",
                        "properties": {},
                        "occurred_at": now,
                    }
                ]
            }
        )
    for unsafe in (
        {"query": "plumber"},
        {"category": "person@example.com"},
        {"message": "hello"},
    ):
        with pytest.raises(ValueError):
            AnalyticsBatchInput.model_validate(
                {
                    "events": [
                        {
                            "event": "search_performed",
                            "properties": unsafe,
                            "occurred_at": now,
                        }
                    ]
                }
            )


@pytest.mark.asyncio
async def test_feature_flag_admin_is_strictly_admin_only(db_session):
    user = make_user("flag-ordinary@example.com")
    admin = make_user("flag-admin@example.com", UserRole.ADMIN)
    db_session.add_all([user, admin])
    await db_session.commit()
    app = FastAPI()
    app.include_router(feature_api.admin_router, prefix="/admin/feature-flags")

    async def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: user
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        denied = await client.post(
            "/admin/feature-flags",
            json={"key": "invitations", "enabled": True, "config": {}},
        )
        assert denied.status_code == 403

        app.dependency_overrides[get_current_user] = lambda: admin
        created = await client.post(
            "/admin/feature-flags",
            json={"key": "invitations", "enabled": True, "config": {}},
        )
        assert created.status_code == 201
        assert created.json()["key"] == "invitations"


@pytest.mark.asyncio
async def test_error_auth_scrubbing_and_admin_authorization(db_session):
    user = make_user("error-user@example.com")
    admin = make_user("error-admin@example.com", UserRole.ADMIN)
    db_session.add_all([user, admin])
    await db_session.commit()

    app = FastAPI()
    app.include_router(telemetry_api.router, prefix="/telemetry")
    app.include_router(telemetry_api.admin_router, prefix="/admin/telemetry")

    async def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user_optional] = lambda: user
    app.dependency_overrides[get_current_user] = lambda: user

    payload = {
        "error_code": "render_failed",
        "error_kind": "render",
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "platform": "web",
        "environment": "production",
        "release": "web-1.2.3",
        "route": "/profile/person@example.com?token=secret",
        "anonymous_user_id": "spoofed-client-value",
    }
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post("/telemetry/errors", json=payload)
        assert response.status_code == 202
        report = await db_session.scalar(select(ClientErrorReport))
        assert report.user_id == user.id
        assert "example.com" not in report.context["route"]
        assert "token" not in report.context["route"]
        assert report.context["anonymous_user_id"] != "spoofed-client-value"

        forbidden = await client.get("/admin/telemetry/errors")
        assert forbidden.status_code == 403

        app.dependency_overrides[get_current_user] = lambda: admin
        allowed = await client.get("/admin/telemetry/errors")
        assert allowed.status_code == 200
        assert allowed.json()[0]["error_code"] == "render_failed"


@pytest.mark.asyncio
async def test_analytics_endpoint_enriches_authenticated_user(db_session):
    user = make_user("analytics-user@example.com")
    db_session.add(user)
    await db_session.commit()
    app = FastAPI()
    app.include_router(telemetry_api.router, prefix="/telemetry")

    async def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user_optional] = lambda: user
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/telemetry/events",
            json={
                "events": [
                    {
                        "event": "app_opened",
                        "properties": {"platform": "web", "app_version": "1.2.3"},
                        "occurred_at": datetime.now(timezone.utc).isoformat(),
                    }
                ]
            },
        )
    assert response.status_code == 202
    event = await db_session.scalar(select(AnalyticsEvent))
    assert event.user_id == user.id
    assert event.platform == "web"
    assert event.app_version == "1.2.3"
