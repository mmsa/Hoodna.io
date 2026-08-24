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
from zoneinfo import ZoneInfo

from app.models.enums import ChatImportItemKind, ChatImportSource

# WhatsApp exports are local wall-clock; Egyptian compounds default to Cairo.
IMPORT_LOCAL_TZ = ZoneInfo("Africa/Cairo")

PHONE_RE = re.compile(
    r"(?:\+|00)?(?:20)?0?1[0125]\d{8}|\+\d{8,15}|\d{10,15}"
)
# Full-string phone / mostly-phone sender (WhatsApp shows number when contact not saved)
PHONE_LIKE_SENDER_RE = re.compile(
    r"^\s*(?:\+|00)?[\d\s\-().]{8,}\s*$"
)
WHATSAPP_LINE_RE = re.compile(
    r"^\[?(\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APMapm]{2})?)\]?\s*[-–]?\s*([^:]+):\s*(.*)$"
)
# Expanded bilingual commercial signals (fallback when LLM unavailable)
LISTING_HINT_RE = re.compile(
    r"("
    r"for\s+sale|sell(?:ing)?|buy(?:ing)?|rent(?:ing|al)?|"
    r"للبيع|للبيع|مطلوب\s*بيع|معروض|للتأجير|للتاجير|للايجار|للإيجار|للايجار|"
    r"ايجار|إيجار|سعر(?:ه|ها)?|جنيه|كاش|قسط|"
    r"هبيع|هابيع|بتباع|بتبيع|هشتري|اشتري|"
    r"available\s+for|looking\s+to\s+(?:sell|buy|rent)|"
    r"egp|\ble\b"
    r")",
    re.IGNORECASE,
)
PRICE_RE = re.compile(
    r"(?<!\d)(\d{1,3}(?:[, ]\d{3})+|\d{4,7})(?:\.\d+)?(?!\d)",
)
SKIP_RE = re.compile(
    r"^(?:\s*|null|none|<media omitted>|image omitted|video omitted|audio omitted|"
    r"sticker omitted|gif omitted|document omitted|contact card omitted|"
    r"this message was deleted|you deleted this message|"
    r"messages and calls are end-to-end encrypted.*)$",
    re.IGNORECASE,
)
# Likely starts a new community thread rather than a reply
NEW_ROOT_RE = re.compile(
    r"[?؟]"
    r"|^(?:anyone|any\s+one|does\s+anyone|has\s+anyone|looking\s+for|need(?:s|ed)?|"
    r"recommendation|recommend|"
    r"مين|حد\s*يعرف|فيه\s+حد|لو\s*سمحت|ممكن|عايز|عاوز|محتاج|فقدت|ضاعت|لقينا)",
    re.IGNORECASE | re.MULTILINE,
)
PHONE_IN_TEXT_RE = re.compile(
    r"(?:\+|00)?(?:20)?0?1[0125][\d\s\-()]{7,12}|\+\d{8,15}"
)

REPLY_MAX_CHARS = 240
THREAD_GAP_SECONDS = 45 * 60


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


def is_phone_like_sender(sender: str) -> bool:
    cleaned = (sender or "").strip()
    if not cleaned:
        return True
    if PHONE_LIKE_SENDER_RE.match(cleaned):
        return True
    phone = extract_phone_from_sender(cleaned)
    if not phone:
        return False
    # Sender is phone-only if removing digits/phone punctuation leaves almost nothing
    residual = re.sub(r"[\d\s+\-().]", "", cleaned)
    return len(residual) < 2


def redact_phones(text: str) -> str:
    """Remove phone numbers from public-facing content."""
    if not text:
        return text
    return PHONE_IN_TEXT_RE.sub("[phone hidden]", text)


def classify_message(text: str) -> ChatImportItemKind:
    """Regex fallback classifier (used when LLM is unavailable)."""
    cleaned = (text or "").strip()
    if not cleaned or SKIP_RE.match(cleaned):
        return ChatImportItemKind.SKIP
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
    if any(
        token in lower
        for token in (
            "rent",
            "ايجار",
            "إيجار",
            "للإيجار",
            "للايجار",
            "للتأجير",
            "monthly",
            "hourly",
            "شهري",
        )
    ):
        return "RENT"
    return "SELL"


def listing_category(text: str) -> str:
    """Infer marketplace category from bilingual listing text."""
    lower = (text or "").lower()
    if any(
        token in lower
        for token in (
            "apartment",
            "flat",
            "villa",
            "duplex",
            "penthouse",
            "studio",
            "townhouse",
            "شقة",
            "شقه",
            "فيلا",
            "دوبلكس",
            "بنتهاوس",
            "استوديو",
            "تاون هاوس",
            "غرفة",
            "غرف",
            "bedroom",
            "compound unit",
            "وحدة",
        )
    ):
        return "PROPERTY"
    if any(
        token in lower
        for token in (
            "car",
            "auto",
            "vehicle",
            "sedan",
            "suv",
            "bmw",
            "mercedes",
            "toyota",
            "hyundai",
            "kia",
            "nissan",
            "عربيه",
            "عربية",
            "سيارة",
            "سياره",
            "موتوسيكل",
            "موتور",
            "توك توك",
            "scooter",
        )
    ):
        return "CAR"
    if any(
        token in lower
        for token in (
            "service",
            "cleaning",
            "plumber",
            "electrician",
            "maintenance",
            "نضافة",
            "نظافة",
            "سباك",
            "كهربائي",
            "صيانه",
            "صيانة",
            "خدمة",
            "خدمه",
        )
    ):
        return "SERVICE"
    return "ITEM"


def listing_title(text: str) -> str:
    line = (text or "").strip().splitlines()[0].strip()
    return line[:120] if line else "Imported listing"


def ensure_listing_normalized(normalized: dict[str, Any] | None) -> dict[str, Any]:
    """Fill listing fields when an item is (re)classified as LISTING."""
    data = dict(normalized or {})
    content = str(data.get("content") or data.get("description") or "").strip()
    if not data.get("title"):
        data["title"] = listing_title(content) if content else "Imported listing"
    if not data.get("description"):
        data["description"] = content or data.get("title")
    if data.get("price") is None and content:
        data["price"] = extract_price(content)
    if not data.get("intent"):
        data["intent"] = listing_intent(content)
    # Re-infer when missing or still the generic default with stronger signals
    existing_category = str(data.get("category") or "").upper()
    inferred = listing_category(content)
    if not existing_category or (
        existing_category == "ITEM" and inferred != "ITEM"
    ):
        data["category"] = inferred
    else:
        data["category"] = existing_category
    data.setdefault("currency", "EGP")
    return data


@dataclass
class ParsedMessage:
    sender_name: str
    phone: str | None
    text: str
    timestamp: str | None = None
    reply_to_id: Any = None
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class ParsedImport:
    source: ChatImportSource
    messages: list[ParsedMessage]
    users: list[dict[str, Any]]
    items: list[dict[str, Any]]


def _sender_display(name: str, phone: str | None) -> str:
    """
    Public display name. Never use a phone number as the name.
    Prefer WhatsApp/Telegram contact/profile name when present in the export.
    """
    cleaned = (name or "").strip()
    if not cleaned or is_phone_like_sender(cleaned):
        return "Neighbour"

    # "Sara Ali +20100..." or "Sara ~ 0100..." → keep leading name
    stripped = re.sub(
        r"[\s~\-]*(?:\+|00)?(?:20)?0?1[0125][\d\s\-()]{7,}.*$",
        "",
        cleaned,
    ).strip(" -~")
    if stripped and not is_phone_like_sender(stripped):
        return stripped[:80]
    if is_phone_like_sender(cleaned):
        return "Neighbour"
    return cleaned[:80]


def parse_import_timestamp(value: str | None) -> datetime | None:
    """
    Parse a WhatsApp/Telegram export timestamp into timezone-aware UTC-compatible datetime.

    Naive WhatsApp times are interpreted as Africa/Cairo wall clock.
    """
    if not value:
        return None
    text = str(value).strip()
    formats = (
        "%m/%d/%y %I:%M:%S %p",
        "%m/%d/%y %I:%M %p",
        "%d/%m/%y %I:%M:%S %p",
        "%d/%m/%y %I:%M %p",
        "%d/%m/%Y %I:%M:%S %p",
        "%d/%m/%Y %I:%M %p",
        "%m/%d/%Y %I:%M:%S %p",
        "%m/%d/%Y %I:%M %p",
        "%d/%m/%y %H:%M:%S",
        "%d/%m/%y %H:%M",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%m/%d/%y %H:%M:%S",
        "%m/%d/%y %H:%M",
        "%m/%d/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S",
    )
    parsed: datetime | None = None
    for fmt in formats:
        try:
            parsed = datetime.strptime(text, fmt)
            break
        except ValueError:
            continue
    if parsed is None:
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        except ValueError:
            return None

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=IMPORT_LOCAL_TZ)
    return parsed


# Keep private alias used by threading heuristics
_parse_timestamp = parse_import_timestamp


def _looks_like_new_root(text: str) -> bool:
    cleaned = (text or "").strip()
    if len(cleaned) > REPLY_MAX_CHARS:
        return True
    return bool(NEW_ROOT_RE.search(cleaned))


def _assign_threads(content_items: list[dict[str, Any]]) -> None:
    """
    Convert some POSTs into COMMENTs under a parent POST.

    - Telegram: honor reply_to_message_id when parent is a POST
    - WhatsApp / fallback: short follow-ups within a time window attach to the
      active parent post (parent post → comments)
    """
    # message_index → item index in content_items
    by_msg_index: dict[int, int] = {}
    telegram_id_to_index: dict[Any, int] = {}
    for idx, item in enumerate(content_items):
        mid = (item.get("normalized") or {}).get("message_index")
        if isinstance(mid, int):
            by_msg_index[mid] = idx
            raw = item.get("raw_payload") or {}
            if raw.get("format") == "telegram" and raw.get("id") is not None:
                telegram_id_to_index[raw["id"]] = mid

    active_parent: int | None = None
    active_ts: datetime | None = None

    for item in content_items:
        kind = item.get("kind")
        normalized = dict(item.get("normalized") or {})
        msg_index = normalized.get("message_index")
        text = str(normalized.get("content") or "")
        ts = _parse_timestamp(normalized.get("timestamp"))
        raw = item.get("raw_payload") or {}

        if kind == ChatImportItemKind.SKIP.value:
            continue

        if kind == ChatImportItemKind.LISTING.value:
            active_parent = None
            active_ts = ts
            continue

        if kind != ChatImportItemKind.POST.value:
            continue

        parent_index: int | None = None
        reply_to = raw.get("reply_to_message_id")
        if reply_to is not None and reply_to in telegram_id_to_index:
            candidate = telegram_id_to_index[reply_to]
            parent_item = content_items[by_msg_index[candidate]]
            if parent_item.get("kind") == ChatImportItemKind.POST.value:
                parent_index = candidate

        if parent_index is None and active_parent is not None:
            gap_ok = True
            if ts and active_ts:
                gap_ok = abs((ts - active_ts).total_seconds()) <= THREAD_GAP_SECONDS
            if (
                gap_ok
                and len(text.strip()) <= REPLY_MAX_CHARS
                and not _looks_like_new_root(text)
            ):
                parent_index = active_parent

        if parent_index is not None and parent_index != msg_index:
            item["kind"] = ChatImportItemKind.COMMENT.value
            normalized["parent_message_index"] = parent_index
            item["normalized"] = normalized
            if ts:
                active_ts = ts
            continue

        # New root post
        active_parent = msg_index if isinstance(msg_index, int) else None
        active_ts = ts
        normalized.pop("parent_message_index", None)
        item["normalized"] = normalized


def build_import_payload(source: ChatImportSource, messages: list[ParsedMessage]) -> ParsedImport:
    users_by_phone: dict[str, dict[str, Any]] = {}
    content_items: list[dict[str, Any]] = []

    for message_index, message in enumerate(messages):
        phone = message.phone
        name = _sender_display(message.sender_name, phone)
        if phone and phone not in users_by_phone:
            users_by_phone[phone] = {
                "kind": ChatImportItemKind.USER.value,
                "decision": "APPROVED",
                "raw_payload": {
                    "sender": message.sender_name,
                    # Admin-only: phone lives here / normalized.phone, never as display name
                },
                "normalized": {
                    "phone": phone,
                    "name": name,
                    "source": source.value,
                    "phone_private": True,
                },
            }
        elif phone and phone in users_by_phone:
            # Prefer a real contact/profile name over Neighbour when we later see one
            existing_name = users_by_phone[phone]["normalized"].get("name")
            if name != "Neighbour" and (
                not existing_name or existing_name == "Neighbour"
            ):
                users_by_phone[phone]["normalized"]["name"] = name

        kind = classify_message(message.text)
        parsed_ts = parse_import_timestamp(message.timestamp)
        normalized: dict[str, Any] = {
            "phone": phone,
            "name": name,
            "content": message.text.strip(),
            "timestamp": message.timestamp,
            "created_at": parsed_ts.isoformat() if parsed_ts else None,
            "source": source.value,
            "message_index": message_index,
            "phone_private": True,
        }
        if kind == ChatImportItemKind.LISTING:
            normalized = ensure_listing_normalized(normalized)
        raw_payload = {
            "sender": message.sender_name,
            "text": message.text,
            "timestamp": message.timestamp,
            **(message.raw or {}),
        }
        if message.reply_to_id is not None:
            raw_payload["reply_to_message_id"] = message.reply_to_id
        content_items.append(
            {
                "kind": kind.value,
                "decision": "APPROVED" if kind != ChatImportItemKind.SKIP else "REJECTED",
                "raw_payload": raw_payload,
                "normalized": normalized,
                "reject_reason": "Empty or media-only message"
                if kind == ChatImportItemKind.SKIP
                else None,
            }
        )

    _assign_threads(content_items)

    return ParsedImport(
        source=source,
        messages=messages,
        users=list(users_by_phone.values()),
        items=content_items,
    )


def parse_whatsapp_text(text: str) -> list[ParsedMessage]:
    messages: list[ParsedMessage] = []
    current: ParsedMessage | None = None
    # Strip BOM / bidi marks common in Arabic WhatsApp exports
    cleaned_text = (
        text.replace("\ufeff", "")
        .replace("\u200e", "")
        .replace("\u200f", "")
        .replace("\u202a", "")
        .replace("\u202b", "")
        .replace("\u202c", "")
    )
    for raw_line in cleaned_text.splitlines():
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
                raw={"format": "whatsapp", "line": line[:500]},
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
        timestamp = None
        if entry.get("date"):
            timestamp = str(entry["date"])
        messages.append(
            ParsedMessage(
                sender_name=sender,
                phone=phone,
                text=str(text),
                timestamp=timestamp,
                reply_to_id=entry.get("reply_to_message_id"),
                raw={
                    "format": "telegram",
                    "id": entry.get("id"),
                    "from_id": entry.get("from_id"),
                    "reply_to_message_id": entry.get("reply_to_message_id"),
                },
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
            # Prefer the actual WhatsApp chat transcript over readme/other txt files
            chat_names.sort(
                key=lambda n: (
                    0 if "whatsapp" in n.lower() or "chat" in n.lower() else 1,
                    0 if n.lower().endswith("_chat.txt") else 1,
                    len(n),
                )
            )
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


def rethread_items(items: list[dict[str, Any]]) -> None:
    """Re-run thread assignment after LLM reclassified kinds (POST/LISTING/SKIP)."""
    # Reset comments back to posts before re-threading
    for item in items:
        if item.get("kind") == ChatImportItemKind.COMMENT.value:
            item["kind"] = ChatImportItemKind.POST.value
            normalized = dict(item.get("normalized") or {})
            normalized.pop("parent_message_index", None)
            item["normalized"] = normalized
            item["decision"] = "APPROVED"
            item["reject_reason"] = None
    _assign_threads(items)


def summarize_parsed(parsed: ParsedImport) -> dict[str, int]:
    kind_counts = {
        "users": len(parsed.users),
        "posts": 0,
        "comments": 0,
        "listings": 0,
        "skipped": 0,
        "messages": len(parsed.messages),
    }
    for item in parsed.items:
        kind = item["kind"]
        if kind == ChatImportItemKind.POST.value:
            kind_counts["posts"] += 1
        elif kind == ChatImportItemKind.COMMENT.value:
            kind_counts["comments"] += 1
        elif kind == ChatImportItemKind.LISTING.value:
            kind_counts["listings"] += 1
        elif kind == ChatImportItemKind.SKIP.value:
            kind_counts["skipped"] += 1
    return kind_counts
