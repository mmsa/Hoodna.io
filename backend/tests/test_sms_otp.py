"""Tests for SMS.to / Twilio / WhatsApp OTP delivery helpers."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.sms import (
    OtpRateLimitError,
    SmsDeliveryError,
    check_otp_rate_limits,
    send_otp_sms,
    sms_delivery_configured,
)


def test_rate_limit_per_phone(monkeypatch):
    monkeypatch.setattr("app.services.sms.settings.OTP_MAX_PER_PHONE_PER_HOUR", 2)
    monkeypatch.setattr("app.services.sms.settings.OTP_MAX_PER_IP_PER_HOUR", 100)
    from app.services import sms as sms_mod

    sms_mod._phone_hits.clear()
    sms_mod._ip_hits.clear()

    check_otp_rate_limits(phone="201001234567", client_ip="1.1.1.1")
    check_otp_rate_limits(phone="201001234567", client_ip="1.1.1.1")
    with pytest.raises(OtpRateLimitError):
        check_otp_rate_limits(phone="201001234567", client_ip="1.1.1.1")


@pytest.mark.asyncio
async def test_send_otp_requires_config(monkeypatch):
    monkeypatch.setattr("app.services.sms.settings.SMS_PROVIDER", "none")
    monkeypatch.setattr("app.services.sms.settings.SMSTO_API_KEY", "")
    monkeypatch.setattr("app.services.sms.settings.TWILIO_ACCOUNT_SID", "")
    monkeypatch.setattr("app.services.sms.settings.WHATSAPP_TOKEN", "")
    assert sms_delivery_configured() is False
    with pytest.raises(SmsDeliveryError):
        await send_otp_sms("201001234567", "123456")


@pytest.mark.asyncio
async def test_send_smsto_success(monkeypatch):
    monkeypatch.setattr("app.services.sms.settings.SMS_PROVIDER", "smsto")
    monkeypatch.setattr("app.services.sms.settings.SMSTO_API_KEY", "smsto_test_key")
    monkeypatch.setattr("app.services.sms.settings.SMSTO_SENDER_ID", "Eljiran")

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.text = '{"success":true,"message_id":"abc"}'
    mock_response.json.return_value = {"success": True, "message_id": "abc"}

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.post = AsyncMock(return_value=mock_response)

    with patch("app.services.sms.httpx.AsyncClient", return_value=mock_client):
        await send_otp_sms("201001234567", "654321")

    mock_client.post.assert_awaited_once()
    args, kwargs = mock_client.post.await_args
    assert args[0] == "https://api.sms.to/sms/send"
    assert kwargs["headers"]["Authorization"] == "Bearer smsto_test_key"
    body = kwargs["json"]
    assert body["to"] == "+201001234567"
    assert body["sender_id"] == "Eljiran"
    assert "654321" in body["message"]
    assert "Eljiran" in body["message"]


@pytest.mark.asyncio
async def test_send_twilio_success(monkeypatch):
    monkeypatch.setattr("app.services.sms.settings.SMS_PROVIDER", "twilio")
    monkeypatch.setattr("app.services.sms.settings.TWILIO_ACCOUNT_SID", "ACtest")
    monkeypatch.setattr("app.services.sms.settings.TWILIO_AUTH_TOKEN", "tokensecret")
    monkeypatch.setattr("app.services.sms.settings.TWILIO_FROM_NUMBER", "+15005550006")
    monkeypatch.setattr("app.services.sms.settings.SMSTO_API_KEY", "")

    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.text = '{"sid":"SMxxxx"}'
    mock_response.json.return_value = {"sid": "SMxxxx", "status": "queued"}

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.post = AsyncMock(return_value=mock_response)

    with patch("app.services.sms.httpx.AsyncClient", return_value=mock_client):
        await send_otp_sms("201001234567", "654321")

    mock_client.post.assert_awaited_once()
    args, kwargs = mock_client.post.await_args
    assert args[0] == "https://api.twilio.com/2010-04-01/Accounts/ACtest/Messages.json"
    assert kwargs["data"]["To"] == "+201001234567"


@pytest.mark.asyncio
async def test_send_whatsapp_success(monkeypatch):
    monkeypatch.setattr("app.services.sms.settings.SMS_PROVIDER", "whatsapp")
    monkeypatch.setattr("app.services.sms.settings.WHATSAPP_TOKEN", "EAATEST")
    monkeypatch.setattr("app.services.sms.settings.WHATSAPP_PHONE_NUMBER_ID", "123456")
    monkeypatch.setattr("app.services.sms.settings.WHATSAPP_OTP_TEMPLATE", "eljiran_auth_otp")
    monkeypatch.setattr("app.services.sms.settings.WHATSAPP_OTP_TEMPLATE_LANG", "en_US")
    monkeypatch.setattr("app.services.sms.settings.WHATSAPP_GRAPH_VERSION", "v21.0")
    monkeypatch.setattr("app.services.sms.settings.SMSTO_API_KEY", "")
    monkeypatch.setattr("app.services.sms.settings.TWILIO_ACCOUNT_SID", "")

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.text = '{"messages":[{"id":"wamid.TEST"}]}'
    mock_response.json.return_value = {"messages": [{"id": "wamid.TEST"}]}

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.post = AsyncMock(return_value=mock_response)

    with patch("app.services.sms.httpx.AsyncClient", return_value=mock_client):
        await send_otp_sms("201001234567", "654321")

    mock_client.post.assert_awaited_once()
    args, kwargs = mock_client.post.await_args
    assert args[0] == "https://graph.facebook.com/v21.0/123456/messages"
