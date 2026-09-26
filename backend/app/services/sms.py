"""In-memory rate limits for phone OTP requests.

Akedly sends and checks the codes. This module only throttles how often
this API will ask for one.
"""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from app.core.config import settings


class OtpRateLimitError(Exception):
    """Raised when OTP send rate limits are exceeded."""


_rate_lock = Lock()
_phone_hits: dict[str, list[float]] = defaultdict(list)
_ip_hits: dict[str, list[float]] = defaultdict(list)
_last_phone_send: dict[str, float] = {}


def _prune(timestamps: list[float], window_seconds: float) -> list[float]:
    cutoff = time.time() - window_seconds
    return [ts for ts in timestamps if ts >= cutoff]


def check_otp_resend_cooldown(phone: str) -> None:
    """Block a second code for the same number until the resend cooldown ends."""
    cooldown = max(0, int(settings.OTP_RESEND_COOLDOWN_SECONDS or 0))
    if cooldown <= 0:
        return
    last = _last_phone_send.get(phone)
    if last is None:
        return
    if time.time() - last < cooldown:
        raise OtpRateLimitError(
            "Too many verification codes requested for this phone. Try again later."
        )


def mark_otp_sent(phone: str) -> None:
    """Start the resend cooldown after a code was actually issued."""
    _last_phone_send[phone] = time.time()


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
