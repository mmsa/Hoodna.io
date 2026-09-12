"""Fixed-window rate limiting for abuse-prone endpoints.

State is per-process and in-memory, which matches the current single-instance
deployment. Running more than one API instance weakens (but does not break)
these limits, so this should move to Redis before horizontal scaling.
"""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request, status

_lock = Lock()
_hits: dict[str, list[float]] = defaultdict(list)
# Bound the key space so a hostile caller cannot grow this dict without limit.
_MAX_TRACKED_KEYS = 50_000


def client_ip(request: Request) -> str:
    """Best-effort client IP, honouring the proxy header used in production."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    return request.client.host if request.client else "unknown"


def _prune_locked(now: float) -> None:
    if len(_hits) <= _MAX_TRACKED_KEYS:
        return
    for key in [k for k, stamps in _hits.items() if not stamps or stamps[-1] < now - 3600]:
        _hits.pop(key, None)


def hit(scope: str, identifier: str, *, limit: int, window_seconds: float) -> bool:
    """Record an attempt. Returns False when the caller is over the limit."""
    key = f"{scope}:{identifier}"
    now = time.time()
    with _lock:
        _prune_locked(now)
        recent = [ts for ts in _hits[key] if ts >= now - window_seconds]
        if len(recent) >= limit:
            _hits[key] = recent
            return False
        recent.append(now)
        _hits[key] = recent
        return True


def reset(scope: str, identifier: str) -> None:
    """Clear a counter, e.g. after a successful login."""
    with _lock:
        _hits.pop(f"{scope}:{identifier}", None)


def clear_all() -> None:
    """Drop all counters. Used by tests so limits do not leak between cases."""
    with _lock:
        _hits.clear()


def enforce(
    scope: str,
    identifier: str,
    *,
    limit: int,
    window_seconds: float,
    message: str = "Too many attempts. Please wait a moment and try again.",
) -> None:
    """Raise 429 when the caller exceeded the limit for this scope."""
    if not hit(scope, identifier, limit=limit, window_seconds=window_seconds):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=message,
            headers={"Retry-After": str(int(window_seconds))},
        )
