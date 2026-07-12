"""Privacy-preserving telemetry persistence and optional JSON forwarding."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import re
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

EMAIL = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE = re.compile(r"(?<!\w)\+?[\d][\d\s().-]{6,}[\d](?!\w)")
SECRET = re.compile(
    r"(?i)\b(password|token|authorization|secret|api[_-]?key)=([^&\s]+)"
)


def scrub_pii(value: str | None, *, max_length: int) -> str | None:
    if value is None:
        return None
    scrubbed = EMAIL.sub("[redacted-email]", value)
    scrubbed = PHONE.sub("[redacted-phone]", scrubbed)
    scrubbed = SECRET.sub(r"\1=[redacted]", scrubbed)
    return scrubbed[:max_length]


def safe_route(route: str | None) -> str | None:
    if route is None:
        return None
    # Query strings and fragments often contain search text, tokens, or contact data.
    return scrub_pii(route.split("?", 1)[0].split("#", 1)[0], max_length=200)


def anonymized_user_id(user_id: int | None) -> str | None:
    if user_id is None:
        return None
    secret = settings.TELEMETRY_ANONYMIZATION_SECRET or settings.SECRET_KEY
    return hmac.new(
        secret.encode("utf-8"),
        str(user_id).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()[:32]


def structured_log(event: str, **fields: Any) -> None:
    logger.info(
        json.dumps({"event": event, **fields}, default=str, separators=(",", ":"))
    )


async def forward_json(url: str, payload: dict[str, Any]) -> None:
    if not url.strip():
        return
    try:
        async with httpx.AsyncClient(
            timeout=settings.TELEMETRY_FORWARD_TIMEOUT_SECONDS
        ) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning(
            json.dumps(
                {
                    "event": "telemetry_forward_failed",
                    "error_type": type(exc).__name__,
                },
                separators=(",", ":"),
            )
        )
