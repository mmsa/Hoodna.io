"""Canonical phone normalization for OTP auth and chat import."""

from __future__ import annotations

import re

import phonenumbers
from phonenumbers import NumberParseException

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
PHONE_SQL_STRIP_CHARS = _BIDI_AND_SPACE + ("+", " ", "-", "(", ")")


def is_placeholder_import_phone(phone: str | None) -> bool:
    """True for fake 900… numbers formerly invented for name-only WhatsApp senders."""
    if not phone:
        return False
    digits = re.sub(r"[^\d]", "", str(phone))
    return digits.startswith("900") and len(digits) >= 12


def _clean_raw(raw: str) -> str:
    cleaned = str(raw)
    for ch in _BIDI_AND_SPACE:
        cleaned = cleaned.replace(ch, " " if ch in ("\u202f", "\xa0") else "")
    return cleaned


def _to_storage(number: phonenumbers.PhoneNumber) -> str:
    e164 = phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)
    return e164[1:] if e164.startswith("+") else e164


def _try_parse(text: str, region: str | None = None) -> phonenumbers.PhoneNumber | None:
    try:
        number = phonenumbers.parse(text, region)
    except NumberParseException:
        return None
    if not phonenumbers.is_possible_number(number):
        return None
    return number


def _has_explicit_country_code(cleaned: str, digits: str) -> bool:
    stripped = cleaned.strip()
    return stripped.startswith("+") or digits.startswith("00")


def normalize_phone(raw: str | None) -> str | None:
    """
    Digits-only E.164 without '+'.

    Any valid number with an explicit country code (+ or 00) is kept as that
    country. Local numbers without a country code are interpreted as Egyptian
    (010 / 011 / 012 / 015) so existing Egypt WhatsApp exports still match.
    """
    if not raw:
        return None
    cleaned = _clean_raw(str(raw))
    digits = re.sub(r"[^\d]", "", cleaned)
    if not digits:
        return None
    if is_placeholder_import_phone(digits):
        return None

    if _has_explicit_country_code(cleaned, digits):
        intl = "+" + (digits[2:] if digits.startswith("00") else digits)
        parsed = _try_parse(intl)
        if parsed:
            return _to_storage(parsed)
        rest = digits[2:] if digits.startswith("00") else digits
        return rest if 8 <= len(rest) <= 15 else None

    # Already stored as country-code + national number (OTP / DB / re-import)
    parsed = _try_parse("+" + digits)
    if parsed and phonenumbers.is_valid_number(parsed):
        return _to_storage(parsed)

    # No country code: Egyptian local mobiles only — never invent +44/+33/etc.
    parsed = _try_parse(cleaned, region="EG")
    if parsed and phonenumbers.is_valid_number(parsed):
        return _to_storage(parsed)

    return None


def phone_lookup_candidates(raw: str | None) -> list[str]:
    """Normalized phone plus legacy local / mis-imported forms that may be in the DB."""
    normalized = normalize_phone(raw)
    if not normalized:
        return []
    candidates = [normalized]
    parsed = _try_parse("+" + normalized)
    if not parsed:
        return candidates

    national = str(parsed.national_number)
    country = str(parsed.country_code)
    for alt in (
        f"0{national}",
        national,
        f"{country}0{national}",
    ):
        if alt not in candidates:
            candidates.append(alt)

    # Older imports treated any 01…/07… 11-digit local as Egypt (+20).
    if country != "20":
        egypt_misparsed = f"20{national}"
        if egypt_misparsed not in candidates:
            candidates.append(egypt_misparsed)

    return candidates


def phone_storage_match_values(raw: str | None) -> list[str]:
    """Phone strings as they may be stored on users or chat-import JSON."""
    values: list[str] = []
    for candidate in phone_lookup_candidates(raw):
        for form in (candidate, f"+{candidate}", f"00{candidate}"):
            if form not in values:
                values.append(form)
        parsed = _try_parse("+" + candidate)
        if parsed:
            intl = phonenumbers.format_number(
                parsed, phonenumbers.PhoneNumberFormat.INTERNATIONAL
            )
            national = phonenumbers.format_number(
                parsed, phonenumbers.PhoneNumberFormat.NATIONAL
            )
            for form in (intl, national):
                if form and form not in values:
                    values.append(form)
    return values


def format_phone_display(phone: str | None) -> str | None:
    """Human-readable +CC… for UI (storage stays digits-only)."""
    normalized = normalize_phone(phone) if phone else None
    if not normalized:
        return phone
    return f"+{normalized}"
