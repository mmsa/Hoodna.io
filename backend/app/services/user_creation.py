"""Helpers for user account creation provenance."""

from __future__ import annotations

from typing import Any, Mapping, Optional

from app.models.user import User

CREATION_SOURCE_LABELS = {
    "PHONE_AUTH": "Registered with phone",
    "EMAIL_SIGNUP": "Registered with email",
    "CHAT_IMPORT": "Imported from chat",
    "DEMO": "Demo account",
    "SEED_ADMIN": "Seeded admin",
    "REFERRAL": "Registered via referral",
    "UNKNOWN": "Unknown source",
}


def format_creation_note(
    *,
    creation_source: str | None,
    creation_details: Mapping[str, Any] | None = None,
    creation_job_id: int | None = None,
) -> str:
    """Human-readable one-liner for admin UIs."""
    details = dict(creation_details or {})
    label = CREATION_SOURCE_LABELS.get(
        creation_source or "", creation_source or "Unknown source"
    )
    parts: list[str] = [label]

    filename = details.get("original_filename")
    if filename:
        parts.append(f"file “{filename}”")

    chat_source = details.get("chat_source")
    if chat_source:
        parts.append(str(chat_source).replace("_", " ").title())

    if creation_job_id:
        parts.append(f"job #{creation_job_id}")

    referral = details.get("referral_code")
    if referral:
        parts.append(f"referral {referral}")

    compound_slug = details.get("compound_slug")
    if compound_slug:
        parts.append(f"compound {compound_slug}")

    note = details.get("note")
    if note and note not in label:
        parts.append(str(note))

    return " · ".join(parts)


def user_creation_fields(user: User) -> dict[str, Any]:
    details = user.creation_details if isinstance(user.creation_details, dict) else None
    return {
        "creation_source": user.creation_source,
        "creation_details": details,
        "creation_job_id": user.creation_job_id,
        "creation_note": format_creation_note(
            creation_source=user.creation_source,
            creation_details=details,
            creation_job_id=user.creation_job_id,
        ),
    }


def apply_creation_provenance(
    user: User,
    *,
    source: str,
    details: Optional[dict[str, Any]] = None,
    job_id: int | None = None,
    overwrite: bool = False,
) -> None:
    """Set provenance on a user. By default only fills empty fields."""
    if overwrite or not user.creation_source:
        user.creation_source = source
    if details:
        existing = user.creation_details if isinstance(user.creation_details, dict) else {}
        if overwrite or not existing:
            user.creation_details = {**existing, **details}
        else:
            # Merge missing keys only
            merged = {**details, **existing}
            user.creation_details = merged
    if job_id is not None and (overwrite or not user.creation_job_id):
        user.creation_job_id = job_id
