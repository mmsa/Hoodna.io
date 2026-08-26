"""OTP delivery via SMS.to, Twilio SMS, or WhatsApp Cloud API."""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from threading import Lock

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class SmsDeliveryError(Exception):
    """Raised when an OTP message could not be sent."""


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
    """True when a production OTP channel is configured."""
    return settings.otp_delivery_configured


def _to_e164(phone_digits: str) -> str:
    digits = "".join(ch for ch in phone_digits if ch.isdigit())
    if not digits:
        raise SmsDeliveryError("Invalid phone number")
    return f"+{digits}"


def _otp_message_body(code: str) -> str:
    return f"Your Eljiran verification code is {code}"


async def send_otp_sms(phone_digits: str, code: str) -> None:
    """
    Send an OTP via the configured provider.
    phone_digits: normalized digits without '+' (e.g. 201001234567).
    """
    if settings.smsto_configured:
        await _send_smsto_otp(phone_digits, code)
        return
    if settings.twilio_configured:
        await _send_twilio_otp(phone_digits, code)
        return
    if settings.whatsapp_configured:
        await _send_whatsapp_auth_otp(phone_digits, code)
        return
    raise SmsDeliveryError("OTP delivery is not configured")


async def _send_smsto_otp(phone_digits: str, code: str) -> None:
    """Send OTP via SMS.to /sms/send API."""
    to = _to_e164(phone_digits)
    url = "https://api.sms.to/sms/send"
    payload: dict[str, str | bool] = {
        "message": _otp_message_body(code),
        "to": to,
        "bypass_optout": True,
    }
    sender_id = (settings.SMSTO_SENDER_ID or "").strip()
    if sender_id:
        payload["sender_id"] = sender_id[:11]

    headers = {
        "Authorization": f"Bearer {settings.SMSTO_API_KEY.strip()}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        logger.error("smsto_otp_request_failed", extra={"error": str(exc)})
        raise SmsDeliveryError("Failed to reach SMS.to API") from exc

    message_id = None
    error_message = None
    try:
        data = response.json()
        if isinstance(data, dict):
            message_id = data.get("message_id") or data.get("id")
            error_message = data.get("message") if response.status_code >= 400 else None
            if isinstance(data.get("success"), bool) and not data["success"]:
                error_message = data.get("message") or error_message or "SMS.to send failed"
    except Exception:
        data = None

    if response.status_code >= 400 or (
        isinstance(data, dict) and data.get("success") is False
    ):
        logger.error(
            "smsto_otp_http_error",
            extra={
                "status_code": response.status_code,
                "error": error_message,
                "body": (response.text or "")[:500],
            },
        )
        raise SmsDeliveryError(error_message or "SMS.to rejected the OTP message")

    logger.info(
        "smsto_otp_sent",
        extra={
            "message_id": message_id,
            "mobile_suffix": phone_digits[-4:] if len(phone_digits) >= 4 else "****",
        },
    )


async def _send_twilio_otp(phone_digits: str, code: str) -> None:
    """Send OTP via Twilio Messages API (form-urlencoded)."""
    account_sid = settings.TWILIO_ACCOUNT_SID.strip()
    auth_token = settings.TWILIO_AUTH_TOKEN.strip()
    from_number = settings.TWILIO_FROM_NUMBER.strip()
    to = _to_e164(phone_digits)
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                url,
                auth=(account_sid, auth_token),
                data={
                    "To": to,
                    "From": from_number,
                    "Body": _otp_message_body(code),
                },
            )
    except httpx.HTTPError as exc:
        logger.error("twilio_otp_request_failed", extra={"error": str(exc)})
        raise SmsDeliveryError("Failed to reach Twilio API") from exc

    sid = None
    error_message = None
    try:
        data = response.json()
        if isinstance(data, dict):
            sid = data.get("sid")
            error_message = data.get("message") or data.get("error_message")
    except Exception:
        data = None

    if response.status_code >= 400:
        logger.error(
            "twilio_otp_http_error",
            extra={
                "status_code": response.status_code,
                "error": error_message,
                "body": (response.text or "")[:500],
            },
        )
        raise SmsDeliveryError(error_message or "Twilio rejected the OTP message")

    logger.info(
        "twilio_otp_sent",
        extra={
            "sid": sid,
            "mobile_suffix": phone_digits[-4:] if len(phone_digits) >= 4 else "****",
        },
    )


async def _send_whatsapp_auth_otp(phone_digits: str, code: str) -> None:
    """
    Send a WhatsApp AUTHENTICATION template with copy-code button.
    Docs: Meta Cloud API auth OTP / copy_code templates.
    """
    to = _to_e164(phone_digits)
    phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID.strip()
    version = (settings.WHATSAPP_GRAPH_VERSION or "v21.0").strip().lstrip("/")
    url = f"https://graph.facebook.com/{version}/{phone_number_id}/messages"
    template_name = settings.WHATSAPP_OTP_TEMPLATE.strip()
    language = (settings.WHATSAPP_OTP_TEMPLATE_LANG or "en_US").strip()

    # Body + button both receive the OTP for AUTHENTICATION copy_code templates.
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to.lstrip("+"),  # Cloud API accepts digits; + also ok — use digits
        "type": "template",
        "template": {
            "name": template_name,
            "language": {"code": language},
            "components": [
                {
                    "type": "body",
                    "parameters": [{"type": "text", "text": code}],
                },
                {
                    "type": "button",
                    "sub_type": "url",
                    "index": "0",
                    "parameters": [{"type": "text", "text": code}],
                },
            ],
        },
    }

    headers = {
        "Authorization": f"Bearer {settings.WHATSAPP_TOKEN.strip()}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        logger.error("whatsapp_otp_request_failed", extra={"error": str(exc)})
        raise SmsDeliveryError("Failed to reach WhatsApp API") from exc

    message_id = None
    error_message = None
    try:
        data = response.json()
        if isinstance(data, dict):
            messages = data.get("messages") or []
            if messages and isinstance(messages[0], dict):
                message_id = messages[0].get("id")
            err = data.get("error")
            if isinstance(err, dict):
                error_message = err.get("message") or str(err)
    except Exception:
        data = None

    if response.status_code >= 400:
        logger.error(
            "whatsapp_otp_http_error",
            extra={
                "status_code": response.status_code,
                "error": error_message,
                "body": (response.text or "")[:500],
            },
        )
        raise SmsDeliveryError(
            error_message or "WhatsApp API rejected the OTP message"
        )

    logger.info(
        "whatsapp_otp_sent",
        extra={
            "message_id": message_id,
            "mobile_suffix": phone_digits[-4:] if len(phone_digits) >= 4 else "****",
            "template": template_name,
        },
    )
