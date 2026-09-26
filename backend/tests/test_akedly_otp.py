"""Akedly phone OTP: request, confirm, and failure handling."""

import json

import pytest
from httpx import AsyncClient

from app.services.akedly import _solve_pow


class _Response:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload
        self.text = json.dumps(payload)

    def json(self):
        return self._payload


class _Client:
    def __init__(self, handler):
        self.handler = handler
        self.calls: list[dict] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args):
        return None

    async def request(self, method, url, params=None, json=None, headers=None):
        self.calls.append(
            {"method": method, "url": url, "params": params, "json": json, "headers": headers}
        )
        return self.handler(method, url, json)


def _install_client(monkeypatch, handler) -> _Client:
    client = _Client(handler)

    def _factory(*_args, **_kwargs):
        return client

    monkeypatch.setattr("app.services.akedly.httpx.AsyncClient", _factory)
    return client


def _enable_akedly(monkeypatch):
    monkeypatch.setattr("app.services.akedly.settings.AKEDLY_API_KEY", "test-api-key")
    monkeypatch.setattr("app.services.akedly.settings.AKEDLY_PIPELINE_ID", "pipe-1")
    monkeypatch.setattr("app.services.sms.settings.OTP_RESEND_COOLDOWN_SECONDS", 0)
    monkeypatch.setattr("app.services.sms.settings.OTP_MAX_PER_PHONE_PER_HOUR", 20)
    monkeypatch.setattr("app.services.sms.settings.OTP_MAX_PER_IP_PER_HOUR", 100)


def _challenge(required: bool = False, difficulty: int = 1) -> _Response:
    data = {
        "challengeRequired": required,
        "turnstile": {"required": False, "siteKey": None},
    }
    if required:
        data.update(
            {
                "challenge": "abc123",
                "difficulty": difficulty,
                "challengeToken": "token-1",
            }
        )
    return _Response(200, {"status": "success", "data": data})


def _sent(transaction_req_id: str = "tx-1") -> _Response:
    return _Response(
        200,
        {
            "status": "success",
            "data": {
                "transactionID": "main-1",
                "transactionReqID": transaction_req_id,
                "channels": ["whatsapp"],
                "expiresAt": "2099-01-01T00:00:00Z",
            },
            "message": "OTP sent successfully",
        },
    )


def test_solve_pow_matches_provider_algorithm():
    nonce = _solve_pow("abc123", 1)
    import hashlib

    digest = hashlib.sha256(f"abc123:{nonce}".encode()).hexdigest()
    assert digest.startswith("0")


@pytest.mark.asyncio
@pytest.mark.unit
async def test_otp_request_calls_akedly_over_whatsapp(async_client: AsyncClient, monkeypatch):
    _enable_akedly(monkeypatch)
    seen = {}

    def handler(method, url, body):
        if url.endswith("/challenge"):
            return _challenge(required=True, difficulty=1)
        seen["body"] = body
        return _sent()

    client = _install_client(monkeypatch, handler)
    phone = "+447911123456"
    response = await async_client.post("/api/auth/start", json={"phone": phone})

    assert response.status_code == 200
    payload = response.json()
    assert payload["message"] == "OTP sent successfully"
    assert payload.get("otp_code") in (None, "")
    assert "akedly" not in response.text.lower()
    assert "test-api-key" not in response.text
    assert seen["body"]["channel"] == "whatsapp"
    assert seen["body"]["verificationAddress"]["phoneNumber"] == "+447911123456"
    assert "otp" not in seen["body"]
    assert seen["body"]["powSolution"]["challengeToken"] == "token-1"
    assert isinstance(seen["body"]["powSolution"]["nonce"], int)

    from app.api.auth import otp_storage
    from app.utils.phone import normalize_phone

    stored = otp_storage[normalize_phone(phone)]
    assert stored["transaction_req_id"] == "tx-1"
    assert "otp" not in stored
    assert any(call["url"].endswith("/send") for call in client.calls)


@pytest.mark.asyncio
@pytest.mark.unit
async def test_otp_request_uses_e164_for_international_numbers(
    async_client: AsyncClient, monkeypatch
):
    _enable_akedly(monkeypatch)
    sent_to: list[str] = []

    def handler(method, url, body):
        if url.endswith("/challenge"):
            return _challenge()
        sent_to.append(body["verificationAddress"]["phoneNumber"])
        return _sent(transaction_req_id=f"tx-{len(sent_to)}")

    _install_client(monkeypatch, handler)

    for raw, expected in (
        ("+447911123456", "+447911123456"),
        ("+33612345678", "+33612345678"),
        ("+12025550123", "+12025550123"),
        ("01001234567", "+201001234567"),
    ):
        response = await async_client.post("/api/auth/start", json={"phone": raw})
        assert response.status_code == 200, response.text

    assert sent_to == [
        "+447911123456",
        "+33612345678",
        "+12025550123",
        "+201001234567",
    ]


@pytest.mark.asyncio
@pytest.mark.unit
async def test_otp_confirmation_issues_session(async_client: AsyncClient, monkeypatch):
    _enable_akedly(monkeypatch)
    verify_calls = []

    def handler(method, url, body):
        if url.endswith("/challenge"):
            return _challenge()
        if url.endswith("/verify"):
            verify_calls.append(body["otp"])
            if body["otp"] == "123456":
                return _Response(
                    200,
                    {"status": "success", "data": {"verified": True}, "message": "OTP verified successfully"},
                )
            return _Response(403, {"status": "error", "code": "INVALID_OTP", "message": "Invalid OTP"})
        return _sent()

    _install_client(monkeypatch, handler)
    phone = "+447911123456"
    started = await async_client.post("/api/auth/start", json={"phone": phone})
    assert started.status_code == 200

    missing_name = await async_client.post(
        "/api/auth/verify",
        json={"phone": phone, "otp_code": "123456"},
    )
    assert missing_name.status_code == 400
    body = missing_name.json()
    assert body["detail"] == "Name is required for new users"
    signup_token = body["signup_token"]
    assert isinstance(signup_token, str)
    assert "tx-1" not in signup_token
    assert "akedly" not in missing_name.text.lower()

    from app.core.security import decode_token
    from app.utils.phone import normalize_phone

    claims = decode_token(signup_token)
    assert claims["purpose"] == "complete_signup"
    assert claims["phone_verified"] is True
    assert claims["phone"] == normalize_phone(phone)
    assert claims["type"] == "signup_verification"
    assert "transaction" not in claims

    from app.api.auth import otp_storage

    assert normalize_phone(phone) not in otp_storage

    reused_otp = await async_client.post(
        "/api/auth/verify",
        json={"phone": phone, "otp_code": "123456", "name": "Neighbour"},
    )
    assert reused_otp.status_code == 400

    verified = await async_client.post(
        "/api/auth/complete-signup",
        json={"signup_token": signup_token, "name": "Neighbour"},
    )
    assert verified.status_code == 200
    created = verified.json()
    assert created["access_token"]
    assert created["refresh_token"]
    assert created["user"]["phone_verified"] is True
    assert created["user"]["name"] == "Neighbour"
    assert verify_calls == ["123456"]
    assert "akedly" not in verified.text.lower()

    replay = await async_client.post(
        "/api/auth/complete-signup",
        json={"signup_token": signup_token, "name": "Neighbour"},
    )
    assert replay.status_code == 400
    assert replay.json()["detail"] == "That signup step is no longer valid. Request a new code."


@pytest.mark.asyncio
@pytest.mark.unit
async def test_wrong_otp(async_client: AsyncClient, monkeypatch):
    _enable_akedly(monkeypatch)

    def handler(method, url, body):
        if url.endswith("/challenge"):
            return _challenge()
        if url.endswith("/verify"):
            return _Response(403, {"status": "error", "code": "INVALID_OTP", "message": "Invalid OTP"})
        return _sent()

    _install_client(monkeypatch, handler)
    phone = "+201555555555"
    assert (await async_client.post("/api/auth/start", json={"phone": phone})).status_code == 200
    response = await async_client.post(
        "/api/auth/verify",
        json={"phone": phone, "otp_code": "000000", "name": "Neighbour"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "That code is incorrect."
    assert "akedly" not in response.text.lower()
    assert "Invalid OTP" not in response.text


@pytest.mark.asyncio
@pytest.mark.unit
async def test_expired_otp(async_client: AsyncClient, monkeypatch):
    _enable_akedly(monkeypatch)

    def handler(method, url, body):
        if url.endswith("/challenge"):
            return _challenge()
        if url.endswith("/verify"):
            return _Response(
                410,
                {"status": "error", "code": "TRANSACTION_EXPIRED", "message": "Transaction expired"},
            )
        return _sent()

    _install_client(monkeypatch, handler)
    phone = "+201555555556"
    assert (await async_client.post("/api/auth/start", json={"phone": phone})).status_code == 200
    response = await async_client.post(
        "/api/auth/verify",
        json={"phone": phone, "otp_code": "123456", "name": "Neighbour"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "That code has expired. Request a new one."


@pytest.mark.asyncio
@pytest.mark.unit
async def test_provider_failure_on_send(async_client: AsyncClient, monkeypatch):
    _enable_akedly(monkeypatch)

    def handler(method, url, body):
        if url.endswith("/challenge"):
            return _challenge()
        return _Response(500, {"status": "error", "code": "SEND_OTP_FAILED", "message": "boom api key test-api-key"})

    _install_client(monkeypatch, handler)
    response = await async_client.post("/api/auth/start", json={"phone": "+447911123456"})
    assert response.status_code == 502
    assert response.json()["detail"] == "Could not send verification code. Please try again."
    assert "test-api-key" not in response.text
    assert "akedly" not in response.text.lower()

    from app.api.auth import otp_storage

    assert otp_storage == {}


@pytest.mark.asyncio
@pytest.mark.unit
async def test_rate_limit_and_resend_cooldown(async_client: AsyncClient, monkeypatch):
    _enable_akedly(monkeypatch)
    monkeypatch.setattr("app.services.sms.settings.OTP_MAX_PER_PHONE_PER_HOUR", 5)
    monkeypatch.setattr("app.services.sms.settings.OTP_RESEND_COOLDOWN_SECONDS", 60)

    def handler(method, url, body):
        if url.endswith("/challenge"):
            return _challenge()
        return _sent()

    _install_client(monkeypatch, handler)
    phone = "+447911000111"
    first = await async_client.post("/api/auth/start", json={"phone": phone})
    assert first.status_code == 200
    assert first.json()["resend_after_seconds"] == 60

    second = await async_client.post("/api/auth/start", json={"phone": phone})
    assert second.status_code == 429
    assert "too many" in second.json()["detail"].lower()

    from app.services import sms as sms_mod
    from app.utils.phone import normalize_phone

    sms_mod._last_phone_send[normalize_phone(phone)] = 0
    third = await async_client.post("/api/auth/start", json={"phone": phone})
    assert third.status_code == 200


@pytest.mark.asyncio
@pytest.mark.unit
async def test_whatsapp_failure_does_not_choose_another_channel(
    async_client: AsyncClient, monkeypatch
):
    _enable_akedly(monkeypatch)
    send_bodies = []

    def handler(method, url, body):
        if url.endswith("/challenge"):
            return _challenge()
        send_bodies.append(body)
        return _Response(
            400,
            {
                "status": "error",
                "code": "channel_choice_not_enabled",
                "message": "channel choice is not enabled",
            },
        )

    _install_client(monkeypatch, handler)
    response = await async_client.post("/api/auth/start", json={"phone": "+33612345678"})
    assert response.status_code == 502
    assert response.json()["detail"] == "Could not send verification code. Please try again."
    assert len(send_bodies) == 1
    assert send_bodies[0]["channel"] == "whatsapp"
    assert "akedly" not in response.text.lower()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_expired_signup_token(async_client: AsyncClient):
    from datetime import datetime, timedelta

    from jose import jwt

    from app.core.config import settings
    from app.utils.phone import normalize_phone

    phone = normalize_phone("+447911123499")
    token = jwt.encode(
        {
            "phone": phone,
            "phone_verified": True,
            "purpose": "complete_signup",
            "jti": "expired-signup",
            "exp": datetime.utcnow() - timedelta(minutes=1),
            "type": "signup_verification",
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    response = await async_client.post(
        "/api/auth/complete-signup",
        json={"signup_token": token, "name": "Neighbour"},
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "That signup step is no longer valid. Request a new code."
