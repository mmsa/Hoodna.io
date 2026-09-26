"""Tests for phone OTP send throttling."""

import pytest

from app.services.sms import OtpRateLimitError, check_otp_rate_limits, check_otp_resend_cooldown, mark_otp_sent


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


def test_resend_cooldown(monkeypatch):
    monkeypatch.setattr("app.services.sms.settings.OTP_RESEND_COOLDOWN_SECONDS", 60)
    phone = "447911123456"
    check_otp_resend_cooldown(phone)
    mark_otp_sent(phone)
    with pytest.raises(OtpRateLimitError):
        check_otp_resend_cooldown(phone)
