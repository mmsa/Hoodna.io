"""Parse WhatsApp / Telegram chat exports into normalized import candidates."""
from __future__ import annotations

import json
import re
import zipfile
from dataclasses import dataclass, field
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any

from app.models.enums import ChatImportItemKind, ChatImportSource

PHONE_RE = re.compile(
    r"(?:\+|00)?(?:20)?0?1[0125]\d{8}|\+\d{8,15}|\d{10,15}"
)
WHATSAPP_LINE_RE = re.compile(
    r"^\[?(\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APMapm]{2})?)\]?\s*[-–]?\s*([^:]+):\s*(.*)$"
)
LISTING_HINT_RE = re.compile(
    r"\b(for\s+sale|sell(?:ing)?|buy|rent(?:ing)?|للبيع|ايجار|إيجار|سعر|price|egp|le\b|جنيه)\b",
    re.IGNORECASE,
)
PRICE_RE = re.compile(
    r"(?:egp|le|جنيه|£|\$)?\s*([0-9]{1,3}(?:[, ]?[0-9]{3})*(?:\.[0-9]+)?)\s*(?:egp|le|جنيه)?",
    re.IGNORECASE,
)
SKIP_RE = re.compile(
    r"^(?:\s*|null|none|<media omitted>|image omitted|video omitted|audio omitted|"
    r"sticker omitted|gif omitted|document omitted|contact card omitted|"
    r"this message was deleted|you deleted this message|"
    r"messages and calls are end-to-end encrypted.*)$",
    re.IGNORECASE,
)


def normalize_phone(raw: str | None) -> str | None:
    if not raw:
        return None
    digits = re.sub(r"[^\d]", "", raw)
    if not digits:
        return None
    # Egyptian mobile: 01xxxxxxxxx → 20 + without leading 0
    if digits.startswith("01") and len(digits) == 11:
        digits = "20" + digits[1:]
    elif digits.startswith("1") and len(digits) == 10:
        digits = "20" + digits
    elif digits.startswith("0020"):
        digits = digits[2:]
    return digits if len(digits) >= 8 else None


def extract_phone_from_sender(sender: str) -> str | None:
    if not sender:
        return None
    # Prefer a digit-compact match so spaced WhatsApp numbers work.
    compact = re.sub(r"[^\d+]", "", sender)
    match = PHONE_RE.search(compact) or PHONE_RE.search(sender)
    if not match:
        return None
    return normalize_phone(match.group(0))


def classify_message(text: str) -> ChatImportItemKind:
    cleaned = (text or "").strip()
    if not cleaned or SKIP_RE.match(cleaned):
        return ChatImportItemKind.SKIP
    if LISTING_HINT_RE.search(cleaned) or PRICE_RE.search(cleaned):
        # Prefer listing when commercial signals are present.
        if LISTING_HINT_RE.search(cleaned):
            return ChatImportItemKind.LISTING
    if len(cleaned) < 2:
        return ChatImportItemKind.SKIP
    return ChatImportItemKind.POST


def extract_price(text: str) -> float | None:
    match = PRICE_RE.search(text or "")
    if not match:
        return None
    try:
        return float(match.group(1).replace(",", "").replace(" ", ""))
    except ValueError:
        return None


def listing_intent(text: str) -> str:
    lower = (text or "").lower()
    if any(token in lower for token in ("rent", "ايجار", "إيجار", "monthly", "hourly")):
        return "RENT"
    return "SELL"


def listing_title(text: str) -> str:
    line = (text or "").strip().splitlines()[0].strip()
    return line[:120] if line else "Imported listing"


@dataclass
class ParsedMessage:
    sender_name: str
    phone: str | None
    text: str
    timestamp: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class ParsedImport:
    source: ChatImportSource
    messages: list[ParsedMessage]
    users: list[dict[str, Any]]
    items: list[dict[str, Any]]


def _sender_display(name: str, phone: str | None) -> str:
    cleaned = (name or "").strip() or "Neighbour"
    if phone and cleaned.replace(" ", "").endswith(phone[-4:]):
        return cleaned
    return cleaned


def build_import_payload(source: ChatImportSource, messages: list[ParsedMessage]) -> ParsedImport:
    users_by_phone: dict[str, dict[str, Any]] = {}
    content_items: list[dict[str, Any]] = []

    for message in messages:
        phone = message.phone
        name = _sender_display(message.sender_name, phone)
        if phone and phone not in users_by_phone:
            users_by_phone[phone] = {
                "kind": ChatImportItemKind.USER.value,
                "decision": "APPROVED",
                "raw_payload": message.raw or {"sender": message.sender_name},
                "normalized": {
                    "phone": phone,
                    "name": name,
                    "source": source.value,
                },
            }

        kind = classify_message(message.text)
        normalized: dict[str, Any] = {
            "phone": phone,
            "name": name,
            "content": message.text.strip(),
            "timestamp": message.timestamp,
            "source": source.value,
        }
        if kind == ChatImportItemKind.LISTING:
            normalized.update(
                {
                    "title": listing_title(message.text),
                    "description": message.text.strip(),
                    "price": extract_price(message.text),
                    "intent": listing_intent(message.text),
                    "category": "ITEM",
                    "currency": "EGP",
                }
            )
        content_items.append(
            {
                "kind": kind.value,
                "decision": "APPROVED" if kind != ChatImportItemKind.SKIP else "REJECTED",
                "raw_payload": {
                    "sender": message.sender_name,
                    "text": message.text,
                    "timestamp": message.timestamp,
                    **(message.raw or {}),
                },
                "normalized": normalized,
                "reject_reason": "Empty or media-only message" if kind == ChatImportItemKind.SKIP else None,
            }
        )

    return ParsedImport(
        source=source,
        messages=messages,
        users=list(users_by_phone.values()),
        items=content_items,
    )


def parse_whatsapp_text(text: str) -> list[ParsedMessage]:
    messages: list[ParsedMessage] = []
    current: ParsedMessage | None = None
    for raw_line in text.splitlines():
        line = raw_line.rstrip("\n")
        match = WHATSAPP_LINE_RE.match(line)
        if match:
            if current:
                messages.append(current)
            date_part, time_part, sender, body = match.groups()
            phone = extract_phone_from_sender(sender)
            current = ParsedMessage(
                sender_name=sender.strip(),
                phone=phone,
                text=body,
                timestamp=f"{date_part} {time_part}",
                raw={"format": "whatsapp", "line": line},
            )
        elif current is not None:
            current.text = f"{current.text}\n{line}".strip()
    if current:
        messages.append(current)
    return messages


def parse_telegram_json(data: dict[str, Any] | list[Any]) -> list[ParsedMessage]:
    if isinstance(data, list):
        messages_raw = data
    else:
        messages_raw = data.get("messages") or []
    messages: list[ParsedMessage] = []
    for entry in messages_raw:
        if not isinstance(entry, dict):
            continue
        if entry.get("type") not in (None, "message"):
            continue
        text = entry.get("text")
        if isinstance(text, list):
            parts: list[str] = []
            for part in text:
                if isinstance(part, str):
                    parts.append(part)
                elif isinstance(part, dict) and "text" in part:
                    parts.append(str(part["text"]))
            text = "".join(parts)
        if text is None:
            text = ""
        sender = str(entry.get("from") or entry.get("actor") or "Neighbour")
        phone = None
        for key in ("from_id", "actor_id", "phone"):
            value = entry.get(key)
            if isinstance(value, str):
                phone = extract_phone_from_sender(value) or normalize_phone(value)
                if phone:
                    break
        # Telegram exports rarely include phones; keep name-based identity key fallback later.
        timestamp = None
        if entry.get("date"):
            timestamp = str(entry["date"])
        messages.append(
            ParsedMessage(
                sender_name=sender,
                phone=phone,
                text=str(text),
                timestamp=timestamp,
                raw={"format": "telegram", "id": entry.get("id"), "from_id": entry.get("from_id")},
            )
        )
    return messages


def detect_and_parse_bytes(
    content: bytes,
    filename: str | None = None,
    source: ChatImportSource | None = None,
) -> ParsedImport:
    name = (filename or "").lower()
    # ZIP (WhatsApp export with media)
    if name.endswith(".zip") or content[:2] == b"PK":
        with zipfile.ZipFile(BytesIO(content)) as zf:
            chat_names = [
                n
                for n in zf.namelist()
                if n.lower().endswith(".txt") and not n.startswith("__MACOSX")
            ]
            json_names = [
                n
                for n in zf.namelist()
                if n.lower().endswith(".json") and not n.startswith("__MACOSX")
            ]
            if source == ChatImportSource.TELEGRAM or (not chat_names and json_names):
                raw = zf.read(json_names[0])
                data = json.loads(raw.decode("utf-8", errors="replace"))
                messages = parse_telegram_json(data)
                return build_import_payload(ChatImportSource.TELEGRAM, messages)
            if not chat_names:
                raise ValueError("ZIP does not contain a WhatsApp chat .txt file")
            text = zf.read(chat_names[0]).decode("utf-8", errors="replace")
            messages = parse_whatsapp_text(text)
            return build_import_payload(ChatImportSource.WHATSAPP, messages)

    # JSON telegram
    if name.endswith(".json") or source == ChatImportSource.TELEGRAM:
        data = json.loads(content.decode("utf-8", errors="replace"))
        messages = parse_telegram_json(data)
        return build_import_payload(ChatImportSource.TELEGRAM, messages)

    # Plain WhatsApp text
    text = content.decode("utf-8", errors="replace")
    messages = parse_whatsapp_text(text)
    if not messages and name.endswith(".txt"):
        # Try JSON mistaken as txt
        try:
            data = json.loads(text)
            messages = parse_telegram_json(data)
            return build_import_payload(ChatImportSource.TELEGRAM, messages)
        except json.JSONDecodeError:
            pass
    return build_import_payload(source or ChatImportSource.WHATSAPP, messages)


def parse_file_path(path: str | Path, source: ChatImportSource | None = None) -> ParsedImport:
    file_path = Path(path)
    return detect_and_parse_bytes(file_path.read_bytes(), file_path.name, source)


def summarize_parsed(parsed: ParsedImport) -> dict[str, int]:
    kind_counts = {
        "users": len(parsed.users),
        "posts": 0,
        "listings": 0,
        "skipped": 0,
        "messages": len(parsed.messages),
    }
    for item in parsed.items:
        kind = item["kind"]
        if kind == ChatImportItemKind.POST.value:
            kind_counts["posts"] += 1
        elif kind == ChatImportItemKind.LISTING.value:
            kind_counts["listings"] += 1
        elif kind == ChatImportItemKind.SKIP.value:
            kind_counts["skipped"] += 1
    return kind_counts
