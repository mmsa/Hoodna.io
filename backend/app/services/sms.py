"""SMS delivery for phone OTP (SMS Misr Egypt)."""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from threading import Lock

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# SMS Misr success codes commonly returned for accepted OTP/SMS sends
_SMSMISR_SUCCESS_CODES = {"1901", "4901", "200"}


class SmsDeliveryError(Exception):
    """Raised when an OTP SMS could not be sent."""


class OtpRateLimitError(Exception):
    """Raised when OTP send rate limits are exceeded."""


_rate_lock = Lock()
_phone_hits: dict[str, list[float]] = defaultdict(list)
_ip_hits: dict[str, list[float]] = defaultdict(list)


def _prune(timestamps: list[float], window_seconds: float) -> list[float]:
    cutoff = time.time() - window_seconds
    return [ts for ts in timestamps if ts >= cutoff]


def check_otp_rate_limits(*, phone: str, client_ip: str | None) -> None:
    """Enforce per-phone and per-IP OTP start limits (in-memory, single instance)."""
    window = 3600.0
    phone_limit = max(1, int(settings.OTP_MAX_PER_PHONE_PER_HOUR or 5))
    ip_limit = max(1, int(settings.OTP_MAX_PER_IP_PER_HOUR or 20))

    with _rate_lock:
        phone_key = phone
        _phone_hits[phone_key] = _prune(_phone_hits[phone_key], window)
        if len(_phone_hits[phone_key]) >= phone_limit:
            raise OtpRateLimitError(
                "Too many verification codes requested for this phone. Try again later."
            )

        if client_ip:
            _ip_hits[client_ip] = _prune(_ip_hits[client_ip], window)
            if len(_ip_hits[client_ip]) >= ip_limit:
                raise OtpRateLimitError(
                    "Too many verification codes requested. Try again later."
                )

        now = time.time()
        _phone_hits[phone_key].append(now)
        if client_ip:
            _ip_hits[client_ip].append(now)


def sms_delivery_configured() -> bool:
    return settings.smsmisr_configured


async def send_otp_sms(phone_digits: str, code: str) -> None:
    """
    Send an OTP via the configured provider.
    phone_digits: normalized digits without '+' (e.g. 201001234567).
    """
    if not settings.smsmisr_configured:
        raise SmsDeliveryError("SMS delivery is not configured")
    await _send_smsmisr_otp(phone_digits, code)


async def _send_smsmisr_otp(phone_digits: str, code: str) -> None:
    mobile = "".join(ch for ch in phone_digits if ch.isdigit())
    if not mobile:
        raise SmsDeliveryError("Invalid phone number for SMS")

    payload = {
        "environment": str(int(settings.SMSMISR_ENVIRONMENT)),
        "username": settings.SMSMISR_USERNAME.strip(),
        "password": settings.SMSMISR_PASSWORD.strip(),
        "sender": settings.SMSMISR_SENDER.strip(),
        "mobile": mobile,
        "template": settings.SMSMISR_OTP_TEMPLATE.strip(),
        "otp": code,
    }
    url = (settings.SMSMISR_OTP_URL or "https://smsmisr.com/api/OTP/").strip()

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(url, data=payload)
    except httpx.HTTPError as exc:
        logger.error("smsmisr_otp_request_failed", extra={"error": str(exc)})
        raise SmsDeliveryError("Failed to reach SMS provider") from exc

    raw_text = (response.text or "").strip()
    code_value: str | None = None
    sms_id: str | None = None
    cost: str | None = None

    try:
        data = response.json()
        if isinstance(data, dict):
            code_value = str(data.get("code") or data.get("Code") or "")
            sms_id = str(data.get("SMSID") or data.get("smsid") or "") or None
            cost = str(data.get("Cost") or data.get("cost") or "") or None
    except Exception:
        # Some older responses may be plain text
        code_value = raw_text[:32] if raw_text else None

    if response.status_code >= 400:
        logger.error(
            "smsmisr_otp_http_error",
            extra={
                "status_code": response.status_code,
                "provider_code": code_value,
                "sms_id": sms_id,
            },
        )
        raise SmsDeliveryError("SMS provider rejected the request")

    if code_value and code_value not in _SMSMISR_SUCCESS_CODES:
        logger.error(
            "smsmisr_otp_rejected",
            extra={"provider_code": code_value, "sms_id": sms_id, "cost": cost},
        )
        raise SmsDeliveryError(f"SMS provider error code {code_value}")

    logger.info(
        "smsmisr_otp_sent",
        extra={
            "provider_code": code_value or "ok",
            "sms_id": sms_id,
            "cost": cost,
            "mobile_suffix": mobile[-4:] if len(mobile) >= 4 else "****",
        },
    )
