"""Push notification delivery via the Expo Push service.

Talks to Expo's HTTP API directly with httpx rather than adding the
`expo-server-sdk` dependency: the surface we need is one POST, and the receipt
handling below is the part that actually matters.

Delivery is best-effort by design. A push that fails must never fail the request
that triggered it — the in-app notification row is the source of truth and the
user still sees it in the notification list.
"""

from __future__ import annotations

import logging

import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.launch_accounts import UserPreference
from app.models.push_token import PushToken

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
# Expo accepts up to 100 messages per request.
EXPO_BATCH_SIZE = 100
PUSH_TIMEOUT_SECONDS = 10.0

# Expo returns these when a token will never be deliverable again. Anything else
# (rate limits, transient provider errors) is left alone and retried next time.
_DEAD_TOKEN_ERRORS = {"DeviceNotRegistered", "InvalidCredentials"}


def _chunk(items: list, size: int):
    for start in range(0, len(items), size):
        yield items[start : start + size]


async def _tokens_for_users(db: AsyncSession, user_ids: list[int]) -> list[PushToken]:
    """Tokens for users who have not switched push off.

    Users with no preferences row have never opened settings; the column default
    is on, so they are included.
    """
    if not user_ids:
        return []

    opted_out = await db.execute(
        select(UserPreference.user_id).where(
            UserPreference.user_id.in_(user_ids),
            UserPreference.push_notifications.is_(False),
        )
    )
    excluded = set(opted_out.scalars().all())
    eligible = [uid for uid in user_ids if uid not in excluded]
    if not eligible:
        return []

    result = await db.execute(
        select(PushToken).where(PushToken.user_id.in_(eligible))
    )
    return list(result.scalars().all())


async def _prune_tokens(db: AsyncSession, tokens: list[str]) -> None:
    if not tokens:
        return
    await db.execute(delete(PushToken).where(PushToken.token.in_(tokens)))
    logger.info("pruned_dead_push_tokens count=%d", len(tokens))


async def send_push_to_users(
    db: AsyncSession,
    user_ids: list[int],
    *,
    title: str,
    body: str,
    data: dict | None = None,
) -> int:
    """Deliver a push to every registered device of the given users.

    Returns the number of messages Expo accepted. Never raises: callers are
    request handlers whose primary work has already succeeded.
    """
    try:
        tokens = await _tokens_for_users(db, user_ids)
    except Exception:
        logger.exception("push_token_lookup_failed")
        return 0

    if not tokens:
        return 0

    messages = [
        {
            "to": token.token,
            "title": title,
            "body": body,
            "sound": "default",
            "data": data or {},
            # Lets the OS replace an earlier alert rather than stacking them.
            "channelId": "default",
        }
        for token in tokens
    ]

    accepted = 0
    dead: list[str] = []

    try:
        async with httpx.AsyncClient(timeout=PUSH_TIMEOUT_SECONDS) as client:
            for batch in _chunk(messages, EXPO_BATCH_SIZE):
                response = await client.post(
                    EXPO_PUSH_URL,
                    json=batch,
                    headers={"Accept": "application/json"},
                )
                if response.status_code >= 400:
                    logger.warning(
                        "expo_push_http_error status=%s", response.status_code
                    )
                    continue

                receipts = response.json().get("data") or []
                for message, receipt in zip(batch, receipts):
                    if receipt.get("status") == "ok":
                        accepted += 1
                        continue
                    error = (receipt.get("details") or {}).get("error")
                    if error in _DEAD_TOKEN_ERRORS:
                        dead.append(message["to"])
                    else:
                        logger.warning("expo_push_rejected error=%s", error)
    except Exception:
        # Network failure, timeout, malformed body — all non-fatal here.
        logger.exception("expo_push_send_failed")

    if dead:
        try:
            await _prune_tokens(db, dead)
        except Exception:
            logger.exception("push_token_prune_failed")

    return accepted


async def register_push_token(
    db: AsyncSession,
    user_id: int,
    token: str,
    *,
    platform: str | None = None,
    device_name: str | None = None,
) -> PushToken:
    """Upsert a device token, reassigning it if the device changed hands.

    Reassignment matters on a shared or resold phone: without it the previous
    account would keep receiving the new owner's notifications.
    """
    existing = await db.execute(select(PushToken).where(PushToken.token == token))
    row = existing.scalar_one_or_none()

    if row:
        row.user_id = user_id
        row.platform = platform or row.platform
        row.device_name = device_name or row.device_name
        await db.flush()
        return row

    row = PushToken(
        user_id=user_id,
        token=token,
        platform=platform,
        device_name=device_name,
    )
    db.add(row)
    await db.flush()
    return row


async def unregister_push_token(db: AsyncSession, user_id: int, token: str) -> bool:
    """Remove a token at sign-out. Scoped to the owner so one user cannot
    silence another user's device by guessing a token."""
    result = await db.execute(
        delete(PushToken).where(
            PushToken.token == token, PushToken.user_id == user_id
        )
    )
    return (result.rowcount or 0) > 0
