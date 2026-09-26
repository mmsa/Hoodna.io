"""Server-side Akedly phone OTP. The API key never leaves this process."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import time
from datetime import datetime, timezone

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_PREFERRED_CHANNEL = "whatsapp"
_MAX_POW_ATTEMPTS = 5_000_000


class AkedlyError(Exception):
    """Base error for Akedly OTP calls."""

    def __init__(self, message: str, *, code: str | None = None):
        super().__init__(message)
        self.code = code


class AkedlyDeliveryError(AkedlyError):
    """The provider could not issue a code."""


class AkedlyRateLimitError(AkedlyError):
    """Akedly refused the send because a provider rate limit was hit."""


class AkedlyOtpIncorrect(AkedlyError):
    """The submitted code does not match."""


class AkedlyOtpExpired(AkedlyError):
    """The Akedly transaction is expired or no longer usable."""


class AkedlyOtpLocked(AkedlyError):
    """Too many wrong attempts on this Akedly transaction."""


def akedly_configured() -> bool:
    return settings.akedly_configured


def _to_e164(phone_digits: str) -> str:
    digits = "".join(ch for ch in phone_digits if ch.isdigit())
    if not 8 <= len(digits) <= 15:
        raise AkedlyDeliveryError("Invalid phone number")
    return f"+{digits}"


def _api_base() -> str:
    return (settings.AKEDLY_API_BASE or "https://api.akedly.io/api/v1.2").rstrip("/")


def _solve_pow(challenge: str, difficulty: int) -> int:
    """Find nonce where SHA256(challenge + ':' + nonce) has `difficulty` leading zeros."""
    target = "0" * max(0, int(difficulty))
    prefix = f"{challenge}:".encode()
    for nonce in range(_MAX_POW_ATTEMPTS):
        digest = hashlib.sha256(prefix + str(nonce).encode()).hexdigest()
        if digest.startswith(target):
            return nonce
    raise AkedlyDeliveryError("Could not complete verification challenge")


def _error_payload(response: httpx.Response) -> dict:
    try:
        data = response.json()
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def _parse_expires_at(value: object) -> float:
    if isinstance(value, str) and value.strip():
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.timestamp()
        except ValueError:
            pass
    return time.time() + 180


async def _get_json(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    params: dict | None = None,
    json_body: dict | None = None,
    headers: dict | None = None,
) -> httpx.Response:
    try:
        response = await client.request(
            method,
            url,
            params=params,
            json=json_body,
            headers=headers,
        )
    except httpx.HTTPError as exc:
        logger.error("akedly_request_failed", extra={"error": type(exc).__name__})
        raise AkedlyDeliveryError("Failed to reach verification provider") from exc
    return response


def _raise_for_send_status(response: httpx.Response) -> dict:
    data = _error_payload(response)
    code = data.get("code") if isinstance(data.get("code"), str) else None
    if response.status_code == 429 or (code or "").startswith("RATE_LIMIT_"):
        logger.warning("akedly_rate_limited", extra={"code": code})
        raise AkedlyRateLimitError("Rate limit exceeded", code=code)
    if response.status_code >= 400 or data.get("status") == "error":
        logger.error(
            "akedly_send_failed",
            extra={"status_code": response.status_code, "code": code},
        )
        raise AkedlyDeliveryError("Verification provider rejected the request", code=code)
    return data


async def request_phone_otp(
    phone_digits: str, client_ip: str | None = None
) -> tuple[str, float]:
    """Ask Akedly to send a code. Returns (transaction_req_id, expires_at_unix)."""
    if not akedly_configured():
        raise AkedlyDeliveryError("OTP delivery is not configured")

    phone_e164 = _to_e164(phone_digits)
    api_key = settings.AKEDLY_API_KEY.strip()
    pipeline_id = settings.AKEDLY_PIPELINE_ID.strip()
    base = _api_base()

    send_headers = {"Content-Type": "application/json"}
    if client_ip:
        send_headers["x-end-user-ip"] = client_ip

    async def _send_once(client: httpx.AsyncClient, channel: str | None) -> httpx.Response:
        challenge_response = await _get_json(
            client,
            "GET",
            f"{base}/transactions/challenge",
            params={"APIKey": api_key, "pipelineID": pipeline_id},
        )
        challenge = _error_payload(challenge_response)
        if challenge_response.status_code >= 400 or challenge.get("status") == "error":
            code = challenge.get("code") if isinstance(challenge.get("code"), str) else None
            logger.error(
                "akedly_challenge_failed",
                extra={"status_code": challenge_response.status_code, "code": code},
            )
            raise AkedlyDeliveryError("Could not start verification", code=code)

        challenge_data = (
            challenge.get("data") if isinstance(challenge.get("data"), dict) else challenge
        )
        turnstile = challenge_data.get("turnstile") if isinstance(challenge_data, dict) else None
        if isinstance(turnstile, dict) and turnstile.get("required"):
            logger.error("akedly_turnstile_required")
            raise AkedlyDeliveryError("Verification provider requires an unsupported check")

        body: dict = {
            "APIKey": api_key,
            "pipelineID": pipeline_id,
            "verificationAddress": {"phoneNumber": phone_e164},
            "digits": 6,
        }
        if isinstance(challenge_data, dict) and challenge_data.get("challengeRequired"):
            nonce = await asyncio.to_thread(
                _solve_pow,
                str(challenge_data.get("challenge") or ""),
                int(challenge_data.get("difficulty") or 0),
            )
            body["powSolution"] = {
                "challengeToken": challenge_data.get("challengeToken"),
                "nonce": nonce,
            }
        if channel:
            body["channel"] = channel
        return await _get_json(
            client,
            "POST",
            f"{base}/transactions/send",
            json_body=body,
            headers=send_headers,
        )

    async with httpx.AsyncClient(timeout=20.0) as client:
        send_response = await _send_once(client, _PREFERRED_CHANNEL)
        data = _raise_for_send_status(send_response)

    payload = data.get("data") if isinstance(data.get("data"), dict) else {}
    transaction_req_id = payload.get("transactionReqID")
    if data.get("status") != "success" or not isinstance(transaction_req_id, str) or not transaction_req_id:
        logger.error("akedly_send_missing_transaction")
        raise AkedlyDeliveryError("Verification provider did not accept the request")

    logger.info(
        "akedly_otp_sent",
        extra={"mobile_suffix": phone_e164[-4:]},
    )
    return transaction_req_id, _parse_expires_at(payload.get("expiresAt"))


async def verify_phone_otp(transaction_req_id: str, otp_code: str) -> None:
    """Validate a code with Akedly. Raises a typed error on failure."""
    if not transaction_req_id:
        raise AkedlyOtpExpired("Missing verification transaction")

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await _get_json(
            client,
            "POST",
            f"{_api_base()}/transactions/verify",
            json_body={
                "transactionReqID": transaction_req_id,
                "otp": (otp_code or "").strip(),
            },
            headers={"Content-Type": "application/json"},
        )

    data = _error_payload(response)
    code = data.get("code") if isinstance(data.get("code"), str) else None
    verified = isinstance(data.get("data"), dict) and data["data"].get("verified") is True
    if response.status_code < 400 and data.get("status") == "success" and verified:
        return

    logger.info(
        "akedly_verify_rejected",
        extra={"status_code": response.status_code, "code": code},
    )
    if code == "INVALID_OTP" or response.status_code == 403:
        raise AkedlyOtpIncorrect("Invalid code", code=code)
    if code == "MAX_ATTEMPTS_EXCEEDED":
        raise AkedlyOtpLocked("Too many attempts", code=code)
    if code in {"TRANSACTION_EXPIRED", "ALREADY_VERIFIED"} or response.status_code == 410:
        raise AkedlyOtpExpired("Code expired", code=code)
    if response.status_code == 429:
        raise AkedlyOtpLocked("Too many attempts", code=code)
    raise AkedlyDeliveryError("Could not verify the code", code=code)
