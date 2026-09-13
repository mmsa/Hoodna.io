"""Regression tests for launch-critical authentication hardening.

Each test here maps to a specific account-takeover or abuse path, so a failure
means a real security regression rather than a style change.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
@pytest.mark.unit
async def test_otp_verify_locks_out_after_repeated_wrong_codes(
    async_client: AsyncClient, db_session
):
    """A 6-digit code must not be brute forceable."""
    from app.api.auth import OTP_MAX_VERIFY_ATTEMPTS, _store_phone_otp, otp_storage
    from app.crud.user import create_user_by_phone
    from app.utils.phone import normalize_phone

    phone = "+201001234567"
    await create_user_by_phone(db_session, phone, "Neighbour")
    await db_session.commit()

    normalized = normalize_phone(phone)
    _store_phone_otp(normalized, "123456")

    for _ in range(OTP_MAX_VERIFY_ATTEMPTS - 1):
        wrong = await async_client.post(
            "/api/auth/verify",
            json={"phone": phone, "otp_code": "000000"},
        )
        assert wrong.status_code == 401

    locked = await async_client.post(
        "/api/auth/verify",
        json={"phone": phone, "otp_code": "000000"},
    )
    assert locked.status_code == 429

    # The stored code is destroyed, so the real code no longer works either.
    assert normalized not in otp_storage
    after = await async_client.post(
        "/api/auth/verify",
        json={"phone": phone, "otp_code": "123456"},
    )
    assert after.status_code == 400


@pytest.mark.asyncio
@pytest.mark.unit
async def test_otp_verify_keeps_code_when_new_user_name_is_missing(
    async_client: AsyncClient,
):
    """Phone OTP must still work after the UI asks for a display name."""
    from app.api.auth import _store_phone_otp, otp_storage
    from app.utils.phone import normalize_phone

    phone = "+201009998877"
    normalized = normalize_phone(phone)
    _store_phone_otp(normalized, "654321")

    missing_name = await async_client.post(
        "/api/auth/verify",
        json={"phone": phone, "otp_code": "654321"},
    )
    assert missing_name.status_code == 400
    assert "name" in missing_name.json()["detail"].lower()
    assert any(key in otp_storage for key in (normalized, phone))

    created = await async_client.post(
        "/api/auth/verify",
        json={"phone": phone, "otp_code": "654321", "name": "New Neighbour"},
    )
    assert created.status_code == 200
    assert created.json()["user"]["name"] == "New Neighbour"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_login_is_rate_limited_per_identifier(async_client: AsyncClient):
    """Password login must not allow unlimited guesses."""
    signup = await async_client.post(
        "/api/auth/signup",
        json={
            "name": "Rate Limited",
            "phone": "+201002223344",
            "email": "rate@example.com",
            "password": "correct-horse",
        },
    )
    assert signup.status_code == 201

    statuses = []
    for _ in range(15):
        response = await async_client.post(
            "/api/auth/login",
            json={"email": "rate@example.com", "password": "wrong-password"},
        )
        statuses.append(response.status_code)

    assert 429 in statuses, "login should start rejecting repeated failures"
    # The correct password is also blocked while the lockout window is open,
    # which is the intended trade-off against credential stuffing.
    assert statuses.count(401) <= 10


@pytest.mark.asyncio
@pytest.mark.unit
async def test_signup_rejects_weak_and_oversized_passwords(async_client: AsyncClient):
    """Password policy is enforced server-side, not only in the client."""
    short = await async_client.post(
        "/api/auth/signup",
        json={
            "name": "Short Pass",
            "phone": "+201003334455",
            "password": "abc123",
        },
    )
    assert short.status_code == 422

    # bcrypt truncates past 72 bytes; longer input must be rejected, not silently cut.
    too_long = await async_client.post(
        "/api/auth/signup",
        json={
            "name": "Long Pass",
            "phone": "+201003334456",
            "password": "a" * 200,
        },
    )
    assert too_long.status_code == 422


@pytest.mark.asyncio
@pytest.mark.unit
async def test_password_reset_token_cannot_be_reused(async_client: AsyncClient, db_session):
    """A reset link must be single-use so a leaked email cannot be replayed."""
    from app.api.auth import _password_fingerprint
    from app.core.security import create_password_reset_token
    from app.crud.user import get_user_by_email
    from app.schemas.auth import UserSignup
    from app.crud.user import create_user

    user = await create_user(
        db_session,
        UserSignup(
            name="Reset User",
            phone="+201004445566",
            email="reset@example.com",
            password="original-password",
        ),
    )
    await db_session.commit()

    token = create_password_reset_token(
        data={
            "sub": user.id,
            "email": user.email,
            "pwd": _password_fingerprint(user.password_hash),
        }
    )

    first = await async_client.post(
        "/api/auth/reset-password",
        json={"token": token, "new_password": "brand-new-password"},
    )
    assert first.status_code == 200

    replay = await async_client.post(
        "/api/auth/reset-password",
        json={"token": token, "new_password": "attacker-password"},
    )
    assert replay.status_code == 400

    refreshed = await get_user_by_email(db_session, "reset@example.com")
    from app.core.security import verify_password

    assert verify_password("brand-new-password", refreshed.password_hash)
    assert not verify_password("attacker-password", refreshed.password_hash)


@pytest.mark.asyncio
@pytest.mark.unit
async def test_reset_password_response_never_echoes_the_token(async_client: AsyncClient):
    """Failure responses must not disclose why a token was rejected."""
    response = await async_client.post(
        "/api/auth/reset-password",
        json={"token": "a" * 40, "new_password": "brand-new-password"},
    )
    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "a" * 40 not in detail
    assert "invalid or has expired" in detail.lower()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_access_token_is_not_accepted_where_refresh_is_required(
    async_client: AsyncClient, db_session
):
    """Token types must not be interchangeable."""
    from app.core.security import create_access_token

    access = create_access_token(data={"sub": 1})
    response = await async_client.post(
        "/api/auth/refresh", json={"refresh_token": access}
    )
    assert response.status_code == 401


@pytest.mark.asyncio
@pytest.mark.unit
async def test_password_reset_token_is_not_accepted_as_bearer_credential(
    async_client: AsyncClient, db_session
):
    """A reset token must not authenticate API calls."""
    from app.core.security import create_password_reset_token

    reset = create_password_reset_token(data={"sub": 1})
    response = await async_client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {reset}"}
    )
    assert response.status_code == 401
