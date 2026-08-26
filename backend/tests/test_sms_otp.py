"""Tests for SMS Misr OTP delivery helpers."""

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
    # Reset in-memory buckets
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
    monkeypatch.setattr("app.services.sms.settings.SMSMISR_USERNAME", "")
    assert sms_delivery_configured() is False
    with pytest.raises(SmsDeliveryError):
        await send_otp_sms("201001234567", "123456")


@pytest.mark.asyncio
async def test_send_smsmisr_success(monkeypatch):
    monkeypatch.setattr("app.services.sms.settings.SMS_PROVIDER", "smsmisr")
    monkeypatch.setattr("app.services.sms.settings.SMSMISR_USERNAME", "user")
    monkeypatch.setattr("app.services.sms.settings.SMSMISR_PASSWORD", "pass")
    monkeypatch.setattr("app.services.sms.settings.SMSMISR_SENDER", "sender-token")
    monkeypatch.setattr("app.services.sms.settings.SMSMISR_OTP_TEMPLATE", "tpl-token")
    monkeypatch.setattr("app.services.sms.settings.SMSMISR_ENVIRONMENT", 2)
    monkeypatch.setattr(
        "app.services.sms.settings.SMSMISR_OTP_URL", "https://smsmisr.com/api/OTP/"
    )

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.text = '{"code":"1901","SMSID":"99","Cost":"1"}'
    mock_response.json.return_value = {"code": "1901", "SMSID": "99", "Cost": "1"}

    mock_client = AsyncMock()
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = None
    mock_client.post = AsyncMock(return_value=mock_response)

    with patch("app.services.sms.httpx.AsyncClient", return_value=mock_client):
        await send_otp_sms("201001234567", "654321")

    mock_client.post.assert_awaited_once()
    args, kwargs = mock_client.post.await_args
    assert args[0] == "https://smsmisr.com/api/OTP/"
    assert kwargs["data"]["mobile"] == "201001234567"
    assert kwargs["data"]["otp"] == "654321"
    assert kwargs["data"]["environment"] == "2"
