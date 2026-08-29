"""Parse WhatsApp / Telegram chat exports into normalized import candidates."""
from __future__ import annotations

import json
import re
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from app.models.enums import ChatImportItemKind, ChatImportSource

# WhatsApp exports are local wall-clock; Egyptian compounds default to Cairo.
IMPORT_LOCAL_TZ = ZoneInfo("Africa/Cairo")
# Marketplace offers older than this are ignored on import/publish
LISTING_MAX_AGE = timedelta(days=183)  # ~6 months

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
# Offer-only marketplace signals (fallback when LLM unavailable).
# Buyer/wanted inquiries are NOT listings — they become community POSTs.
STRONG_LISTING_RE = re.compile(
    r"("
    r"\bfor\s+sale\b|\bi'?m\s+selling\b|\bwe(?:'re|\s+are)\s+selling\b|"
    r"\bselling\s+(?:my|this|our|[A-Za-z\u0600-\u06FF]+)\b|\bsell\s+my\b|"
    r"\bavailable\s+for\s+(?:sale|rent)\b|\boffering\s+for\s+(?:sale|rent)\b|"
    r"\bi'?m\s+renting\s+my\b|\brenting\s+(?:out\s+)?(?:my|this|our)\b|"
    r"looking\s+to\s+sell|"
    # Bare "for rent" is too noisy (often appears in wanted asks) — require offer framing
    r"\b(?:studio|apartment|flat|villa|duplex|penthouse|room|unit)\s+for\s+rent\b|"
    r"\bfor\s+rent\b.{0,40}\b(?:call|contact|whatsapp|available|monthly)\b|"
    r"\bamenities\s+for\s+rent\b|"
    # Arabic: require للبيع / معروض, or sell-verb next to a real item (not joke "هبيع" alone)
    r"للبيع|معروض\s*للبيع|معروض\s*(?:للإيجار|للايجار)|"
    r"شقة\s+للإيجار|شقه\s+للإيجار|فيلا\s+للإيجار|"
    r"(?:هبيع|هابيع|بتباع|بتبيع)\s*(?:شقة|شقه|فيلا|عربي|عربية|ايفون|موتو|"
    r"تلاجة|غسالة|شاشه|شاشة)|"
    r"(?:شقة|شقه|فيلا|عربي|عربية|ايفون).{0,40}(?:هبيع|هابيع|بتباع|بتبيع|للبيع)|"
    r"(?:عندي|معايا|معى|صاحبي|صديقي)\s+(?:شقة|شقه|فيلا|عربي|عربية).{0,40}"
    r"(?:للبيع|للإيجار|للايجار|هبيع|هابيع)"
    r")",
    re.IGNORECASE | re.DOTALL,
)
# "Looking for / anyone has / wants to buy" → Request post, never marketplace listing
WANTED_INQUIRY_RE = re.compile(
    r"("
    r"\banyone\s+(?:has|have|knows?|selling|renting|got)\b|"
    r"\bis\s+anyone\s+(?:selling|renting|offering|have|has)\b|"
    r"\bdoes\s+anyone\s+(?:has|have|know|sell)\b|"
    r"\bif\s+anyone\s+(?:has|is\s+selling)\b|"
    r"\blooking\s+(?:for|to\s+(?:buy|rent|find|lease))\b|"
    r"\bwant(?:s|ed)?\s+to\s+(?:buy|rent|lease)\b|"
    r"\bbuying\b|\bneed(?:s|ed)?\s+(?:to\s+)?(?:buy|rent)\b|"
    r"\bseeking\b|\bin\s+search\s+of\b|"
    r"\bbroker\b|\bagent\b|"
    r"لو\s*حد\s*عند(?:ه|ها|كم)?|"
    r"فيه\s*حد\s*عند|"
    r"حد\s*عند(?:ه|ها|كم)|"
    r"حد\s*يعرف|"
    r"مين\s*عند|"
    r"عايز(?:ة)?\s*(?:يشتري|تشتري|أشتري|اشتري|يستأجر|تستأجر|أجار|ايجار|شقة|شقه)|"
    r"عاوز(?:ة)?\s*(?:يشتري|تشتري|أشتري|اشتري|يستأجر|تستأجر|شقة|شقه)|"
    r"محتاج(?:ة)?\s*(?:شقة|شقه|فيلا|بيت|عربي|سيارة|ايجار|إيجار)|"
    r"مطلوب\s*(?:شراء|ايجار|إيجار|للإيجار|شقة|شقه)|"
    r"هشتري|هستأجر|"
    r"صديق(?:ي|تى|تي)?\s*(?:عايز|عاوز|محتاج)|"
    r"رقم\s*(?:سمسار|وسيط|broker)"
    r")",
    re.IGNORECASE,
)
# Community works / fund talk that often contains prices but is NOT a listing
COMMUNITY_COST_RE = re.compile(
    r"("
    r"street\s+fund|rain\s+drain|per\s+meter|مصاريف|تحصيل|صندوق|اشتراك|"
    r"ميزانية|الشارع|انترلوك|interlock|متر\s*الشارع|جنيه\s*/\s*متر|"
    r"لكل\s*متر|توريد\s+و\s*تركيب|تركيب\s+بال|"
    r"كل\s+(?:عمارة|مبنى|بيت)\s+يدفع|"
    r"عداد|meter\s+fee|electric(?:ity)?\s+(?:bill|meter)|leak|ducts?|"
    r"مياه|كهرباء|صيانه\s+العمارة|صيانة\s+العمارة"
    r")",
    re.IGNORECASE,
)
SERVICE_RECOMMENDATION_RE = re.compile(
    r"("
    r"anyone\s+(?:know|recommend)|looking\s+for\s+a\s+(?:good\s+)?|"
    r"recommend(?:ation|ed)?|need(?:s|ed)?\s+a\s+(?:plumber|electrician|cleaner|painter|driver)|"
    r"حد\s*يعرف|مين\s*(?:كويس|شاطر|موثوق)|محتاج(?:ة)?\s*(?:سباك|كهربائي|نجدة|نجار|صيانه|صيانة)|"
    r"ترشيح|انصح(?:وني|ني)?|سيب(?:وا)?\s+رقم"
    r")",
    re.IGNORECASE,
)
# Advertising own services — keep tight (do NOT match "Yes I do")
SERVICE_OFFER_RE = re.compile(
    r"("
    r"\bi\s+(?:offer|provide)\b|\bavailable\s+for\s+(?:work|jobs)\b|"
    r"\bmy\s+services?\b|\boffering\s+(?:services?|cleaning|maintenance)\b|"
    r"أقدم\s+خدمات|بقدم\s+(?:خدمة|خدمات)|متاح\s+ل(?:لعمل|لشغل)|"
    r"خدمات\s+(?:نظافة|صيانة|سباكة|كهرباء)"
    r")",
    re.IGNORECASE,
)
# Short chat replies / thanks — never marketplace listings
CHATTY_REPLY_RE = re.compile(
    r"^(?:"
    r"yes(?:\s+i\s+do)?|yeah|yep|ok(?:ay)?|sure|done|thanks?(?:\s+you)?|thx|"
    r"please\s+send|plz\s+send|send\s+me|"
    r"تمام|حاضر|ايوه|أيوه|ماشي|شكرا(?:ً|ا)?|من فضلك|لو سمحت"
    r").{0,80}$",
    re.IGNORECASE,
)
# Joke / emoji-heavy one-liners that only casually mention selling
THIN_LISTING_RE = re.compile(
    r"^[\W\d_]*"  # optional emoji/punct lead-in
    r".{0,40}"
    r"(?:هبيع|هابيع|بتباع|selling|for\s+sale)"
    r".{0,40}$",
    re.IGNORECASE | re.DOTALL,
)
SKIP_RE = re.compile(
    r"^(?:\s*|null|none|<media omitted>|image omitted|video omitted|audio omitted|"
    r"sticker omitted|gif omitted|document omitted|contact card omitted|"
    r"this message was deleted|you deleted this message|"
    r"messages and calls are end-to-end encrypted.*)$",
    re.IGNORECASE,
)
# WhatsApp / Telegram group system noise (never publish as posts)
SYSTEM_MESSAGE_RE = re.compile(
    r"("
    r"you\s+joined\s+using\s+a\s+group\s+link|"
    r"joined\s+using\s+(?:this\s+)?(?:group\s+)?link|"
    r"created\s+this\s+group|"
    r"~\s*.+\s+created\s+this\s+group|"
    r"created\s+group|"
    r"turned\s+on\s+admin\s+approval|"
    r"turned\s+off\s+admin\s+approval|"
    r"changed\s+(?:this\s+)?group(?:'s)?\s+(?:description|icon|name|settings|subject)|"
    r"(?:was\s+)?added\s+.+\s+to\s+(?:the\s+)?group|"
    r"removed\s+.+\s+from\s+(?:the\s+)?group|"
    r"left\s*$|left\s+the\s+group|"
    r"changed\s+their\s+phone\s+number|"
    r"security\s+code\s+changed|"
    r"messages\s+and\s+calls\s+are\s+end-to-end\s+encrypted|"
    r"you(?:'re|\s+are)\s+now\s+an\s+admin|"
    r"is\s+now\s+an\s+admin|"
    r"only\s+admins\s+can\s+(?:send|edit|delete)|"
    r"waiting\s+for\s+this\s+message|"
    r"missed\s+(?:voice|video)\s+call|"
    r"انضم(?:يت|ت)?\s+باستخدام|"
    r"أنشأ(?:ت)?\s+(?:هذه\s+)?المجموعة|"
    r"تم\s+إنشاء\s+(?:هذه\s+)?المجموعة|"
    r"تفعيل\s+موافقة\s+المشرف|"
    r"تم\s+تغيير\s+(?:وصف|اسم|صورة)\s+المجموعة"
    r")",
    re.IGNORECASE,
)
GREETING_ONLY_RE = re.compile(
    r"^(?:"
    r"السلا+م\s*عليكم(?:\s*و(?:رحمة|رحمه)\s*الله(?:\s*وبركاته)?)?|"
    r"سلام\s*عليكم|"
    r"hi+|hello+|hey+|good\s+(?:morning|evening|night)|"
    r"صباح\s*(?:الخير|النور)|مساء\s*(?:الخير|النور)|أهلا(?:ً|ا)?|مرحبا(?:ً|ا)?"
    r")[\s!.]*$",
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
# Spaced WhatsApp formatting (+20 114 412 3448, +33 6 34…) including NBSP
PHONE_CANDIDATE_RE = re.compile(
    r"(?:\+|00)(?:[\d\s\xa0\-().]){8,24}|(?<!\d)(?:20)?0?1[0125](?:[\d\s\xa0\-()]){7,16}(?!\d)"
)
# Only harvest body phones from membership / system identity lines (not casual chat).
MEMBERSHIP_PHONE_CONTEXT_RE = re.compile(
    r"("
    r"joined|added|left|removed|phone\s+number|"
    r"انضم|أضاف|اضاف|غادر|رقم\s*(?:الهاتف|التليفون|التليفون)"
    r")",
    re.IGNORECASE,
)
PRICE_RE = re.compile(
    r"(?<!\d)(\d{1,3}(?:[, ]\d{3})+|\d{4,7})(?:\.\d+)?(?!\d)",
)

REPLY_MAX_CHARS = 240
THREAD_GAP_SECONDS = 45 * 60


# Re-export shared phone helpers (OTP + import must use the same rules).
from app.utils.phone import (  # noqa: E402
    format_phone_display,
    is_placeholder_import_phone,
    normalize_phone,
    phone_lookup_candidates,
)

def stable_chat_import_email(compound_id: int, display_name: str) -> str:
    """Stable identity email when WhatsApp export has a name but no phone."""
    import hashlib

    key = f"{compound_id}:{(display_name or 'neighbour').strip().lower()}"
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:24]
    return f"chatimport_{digest}@hoodna.local"


def extract_phone_from_sender(sender: str) -> str | None:
    if not sender:
        return None
    # Prefer a digit-compact match so spaced WhatsApp numbers work.
    compact = re.sub(r"[^\d+]", "", sender)
    match = PHONE_RE.search(compact) or PHONE_RE.search(sender)
    if not match:
        return None
    return normalize_phone(match.group(0))


def extract_phones_from_text(text: str) -> list[str]:
    """Return unique normalized phones listed in text. Never invents numbers."""
    if not text:
        return []
    cleaned = (
        str(text)
        .replace("\u202a", "")
        .replace("\u202b", "")
        .replace("\u202c", "")
        .replace("\u200e", "")
        .replace("\u200f", "")
        .replace("\u202f", " ")
        .replace("\xa0", " ")
    )
    found: list[str] = []
    seen: set[str] = set()
    for match in PHONE_CANDIDATE_RE.finditer(cleaned):
        phone = normalize_phone(match.group(0))
        if phone and phone not in seen:
            seen.add(phone)
            found.append(phone)
    return found


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


def _letter_count(text: str) -> int:
    return len(re.findall(r"[A-Za-z\u0600-\u06FF]", text or ""))


def is_wanted_inquiry(text: str) -> bool:
    """True when the sender is seeking something, not offering it."""
    cleaned = (text or "").strip()
    if not cleaned:
        return False
    if WANTED_INQUIRY_RE.search(cleaned):
        return True
    # Question-like buyer phrasing (with or without '?')
    if re.search(
        r"(?:rent|sale|selling|apartment|penthouse|villa|duplex|studio|flat|شقة|شقه|فيلا|للإيجار|للايجار|للبيع)",
        cleaned,
        re.IGNORECASE,
    ) and re.search(
        r"(?:anyone|anybody|someone|حد|مين|يعرف)", cleaned, re.IGNORECASE
    ):
        # "is anyone selling…" / "حد يعرف شقة…" — seeker, not seller
        if re.search(
            r"(?:is\s+anyone|anyone\s+selling|anyone\s+renting|حد\s*يعرف|حد\s*عند)",
            cleaned,
            re.IGNORECASE,
        ):
            return True
        if "?" in cleaned or "؟" in cleaned:
            return True
    return False


def is_listing_offer(text: str) -> bool:
    """True only when the sender is clearly offering something for sale/rent."""
    cleaned = (text or "").strip()
    if len(cleaned) < 12:
        return False
    if CHATTY_REPLY_RE.match(cleaned):
        return False
    if is_wanted_inquiry(cleaned):
        return False
    # Emoji / joke one-liners with a casual "هبيع" are not listings
    if (
        _letter_count(cleaned) < 28
        and re.search(r"هبيع|هابيع|بتباع|selling", cleaned, re.IGNORECASE)
        and (
            re.search(r"[\U0001F300-\U0001FAFF]|😂|🤣|تعبان|يظهر", cleaned)
            or (
                not re.search(
                    r"شقة|شقه|فيلا|عربي|عربية|ايفون|sofa|apartment|villa|للبيع|for\s+sale",
                    cleaned,
                    re.IGNORECASE,
                )
            )
        )
        and not re.search(
            r"\bfor\s+sale\b|\bavailable\s+for\b|للبيع|amenities\s+for\s+rent",
            cleaned,
            re.IGNORECASE,
        )
    ):
        return False
    # Utility / building / leak talk with prices is not a marketplace listing
    if COMMUNITY_COST_RE.search(cleaned) and not STRONG_LISTING_RE.search(cleaned):
        return False
    if STRONG_LISTING_RE.search(cleaned):
        return True
    if SERVICE_OFFER_RE.search(cleaned):
        return True
    return False


def classify_message(text: str) -> ChatImportItemKind:
    """Regex fallback classifier (used when LLM is unavailable)."""
    cleaned = (text or "").strip()
    if not cleaned or SKIP_RE.match(cleaned) or SYSTEM_MESSAGE_RE.search(cleaned):
        return ChatImportItemKind.SKIP
    if GREETING_ONLY_RE.match(cleaned):
        return ChatImportItemKind.SKIP
    if len(cleaned) < 2:
        return ChatImportItemKind.SKIP

    # Community fund / street works with prices → post, not marketplace listing
    if COMMUNITY_COST_RE.search(cleaned) and not STRONG_LISTING_RE.search(cleaned):
        return ChatImportItemKind.POST

    # Service asks / recommendations → community post
    if SERVICE_RECOMMENDATION_RE.search(cleaned):
        return ChatImportItemKind.POST

    # Buyer / "anyone have X?" enquiries → Request posts, never listings
    if is_wanted_inquiry(cleaned):
        return ChatImportItemKind.POST

    if CHATTY_REPLY_RE.match(cleaned):
        return ChatImportItemKind.POST

    # Explicit personal offer to sell/rent / advertise own services
    if is_listing_offer(cleaned):
        return ChatImportItemKind.LISTING

    return ChatImportItemKind.POST


def infer_post_category(text: str) -> str:
    """Map free-text chat into a feed PostCategory value."""
    cleaned = (text or "").strip()
    lower = cleaned.lower()
    if (
        is_wanted_inquiry(cleaned)
        or SERVICE_RECOMMENDATION_RE.search(cleaned)
        or any(
            token in lower
            for token in (
                "help",
                "anyone know",
                "looking for",
                "محتاج",
                "عايز",
                "عاوز",
                "حد يعرف",
                "ترشيح",
            )
        )
    ):
        return "HELP"
    if any(
        token in lower
        for token in (
            "lost",
            "found",
            "missing",
            "ضاعت",
            "فقدت",
            "لقينا",
            "لقيتها",
            "مفقود",
        )
    ):
        return "LOST_FOUND"
    if any(
        token in lower
        for token in (
            "event",
            "party",
            "meeting",
            "gathering",
            "حفلة",
            "اجتماع",
            "مناسبة",
        )
    ):
        return "EVENT"
    if any(
        token in lower
        for token in (
            "urgent",
            "emergency",
            "alert",
            "عاجل",
            "خطر",
            "حريق",
            "سرقة",
        )
    ):
        return "ALERT"
    if COMMUNITY_COST_RE.search(cleaned) or any(
        token in lower for token in ("announcement", "اعلان", "إعلان", "تنويه", "تنبيه")
    ):
        return "DISCUSSION"
    return "GENERAL"


def skip_reason(text: str) -> str:
    cleaned = (text or "").strip()
    if not cleaned:
        return "Empty message"
    if SYSTEM_MESSAGE_RE.search(cleaned):
        return "WhatsApp/Telegram system message"
    if GREETING_ONLY_RE.match(cleaned):
        return "Greeting-only message"
    if SKIP_RE.match(cleaned):
        return "Empty or media-only message"
    return "Skipped"


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
    # WhatsApp iOS exports: ~\u202fName, bidi marks around +20 numbers
    cleaned = (
        cleaned.replace("\u202a", "")
        .replace("\u202b", "")
        .replace("\u202c", "")
        .replace("\u200e", "")
        .replace("\u200f", "")
        .replace("\u202f", " ")
        .replace("\xa0", " ")
    )
    cleaned = re.sub(r"^~\s*", "", cleaned).strip()
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
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


def is_stale_listing_timestamp(
    value: str | datetime | None,
    *,
    now: datetime | None = None,
) -> bool:
    """True when the message timestamp is older than ~6 months."""
    if isinstance(value, datetime):
        parsed = value
    else:
        parsed = parse_import_timestamp(value if isinstance(value, str) else None)
    if parsed is None:
        return False
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=IMPORT_LOCAL_TZ)
    anchor = now or datetime.now(timezone.utc)
    if anchor.tzinfo is None:
        anchor = anchor.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc) < (
        anchor.astimezone(timezone.utc) - LISTING_MAX_AGE
    )


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


def _ensure_import_user(
    users_by_key: dict[str, dict[str, Any]],
    *,
    source: ChatImportSource,
    phone: str | None,
    name: str,
    sender_raw: str | None = None,
) -> None:
    """Register a USER item. Phone must be from the export — never invented."""
    if phone:
        user_key = f"phone:{phone}"
        display = name if name and name != "Neighbour" else "Neighbour"
    elif name and name != "Neighbour":
        user_key = f"name:{name.casefold()}"
        display = name
    else:
        return

    if user_key not in users_by_key:
        users_by_key[user_key] = {
            "kind": ChatImportItemKind.USER.value,
            "decision": "APPROVED",
            "raw_payload": {
                "sender": sender_raw,
                # Admin-only: phone lives here / normalized.phone, never as display name
            },
            "normalized": {
                "phone": phone,
                "name": display,
                "source": source.value,
                "phone_private": True,
            },
        }
        return

    existing = users_by_key[user_key]["normalized"]
    if display != "Neighbour" and (
        not existing.get("name") or existing.get("name") == "Neighbour"
    ):
        existing["name"] = display
    if phone and not existing.get("phone"):
        existing["phone"] = phone


def build_import_payload(source: ChatImportSource, messages: list[ParsedMessage]) -> ParsedImport:
    # Unique people: phone when listed in export, else stable name key.
    users_by_key: dict[str, dict[str, Any]] = {}
    content_items: list[dict[str, Any]] = []

    for message_index, message in enumerate(messages):
        phone = message.phone
        name = _sender_display(message.sender_name, phone)
        _ensure_import_user(
            users_by_key,
            source=source,
            phone=phone,
            name=name,
            sender_raw=message.sender_name,
        )

        # Phones listed only in join/add/system lines (not as message sender).
        body = message.text or ""
        if MEMBERSHIP_PHONE_CONTEXT_RE.search(body) or SYSTEM_MESSAGE_RE.search(body):
            for listed_phone in extract_phones_from_text(body):
                if listed_phone == phone:
                    continue
                _ensure_import_user(
                    users_by_key,
                    source=source,
                    phone=listed_phone,
                    name="Neighbour",
                    sender_raw=message.sender_name,
                )

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
            # Service offers become SERVICE category when possible
            if SERVICE_OFFER_RE.search(message.text) and not STRONG_LISTING_RE.search(
                message.text
            ):
                normalized["category"] = "SERVICE"
        elif kind == ChatImportItemKind.POST:
            normalized["post_category"] = infer_post_category(message.text)
            if SERVICE_RECOMMENDATION_RE.search(message.text):
                normalized["is_service_recommendation"] = True
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
                "reject_reason": skip_reason(message.text)
                if kind == ChatImportItemKind.SKIP
                else None,
            }
        )

    _assign_threads(content_items)

    return ParsedImport(
        source=source,
        messages=messages,
        users=list(users_by_key.values()),
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
