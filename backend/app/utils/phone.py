"""Canonical phone normalization for OTP auth and chat import."""

from __future__ import annotations

import re

# WhatsApp / export bidi + whitespace noise
_BIDI_AND_SPACE = (
    "\u202a",
    "\u202b",
    "\u202c",
    "\u200e",
    "\u200f",
    "\u202f",
    "\xa0",
)


def is_placeholder_import_phone(phone: str | None) -> bool:
    """True for fake 900… numbers formerly invented for name-only WhatsApp senders."""
    if not phone:
        return False
    digits = re.sub(r"[^\d]", "", str(phone))
    return digits.startswith("900") and len(digits) >= 12


def normalize_phone(raw: str | None) -> str | None:
    """
    Digits-only E.164-ish form without '+'.
    Egyptian mobiles become 20XXXXXXXXXX so OTP and chat import match.
    """
    if not raw:
        return None
    cleaned = str(raw)
    for ch in _BIDI_AND_SPACE:
        cleaned = cleaned.replace(ch, " " if ch in ("\u202f", "\xa0") else "")
    digits = re.sub(r"[^\d]", "", cleaned)
    if not digits:
        return None
    if is_placeholder_import_phone(digits):
        return None
    # Egyptian mobile: 01xxxxxxxxx → 20 + without leading 0
    if digits.startswith("01") and len(digits) == 11:
        digits = "20" + digits[1:]
    elif digits.startswith("1") and len(digits) == 10:
        digits = "20" + digits
    elif digits.startswith("0020"):
        digits = digits[2:]
    elif digits.startswith("00") and len(digits) > 10:
        digits = digits[2:]
    return digits if len(digits) >= 8 else None


def phone_lookup_candidates(raw: str | None) -> list[str]:
    """Normalized phone plus legacy local forms that may already be in the DB."""
    normalized = normalize_phone(raw)
    if not normalized:
        return []
    candidates = [normalized]
    # Legacy rows stored as 01… or bare 1… without country code
    if normalized.startswith("20") and len(normalized) == 12:
        local = "0" + normalized[2:]
        bare = normalized[2:]
        for alt in (local, bare):
            if alt not in candidates:
                candidates.append(alt)
    return candidates


def format_phone_display(phone: str | None) -> str | None:
    """Human-readable +CC… for UI (storage stays digits-only)."""
    normalized = normalize_phone(phone) if phone else None
    if not normalized:
        return phone
    return f"+{normalized}"
