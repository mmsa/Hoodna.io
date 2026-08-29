"""Cheap LLM classification for chat-import listing vs post (Arabic + English).

Flow:
  1. Regex decides high-confidence cases (clear offer / wanted / skip / chatter).
  2. Low-confidence / ambiguous messages go to gpt-4o-mini.
  3. If the model is unsure or unavailable → POST (never LISTING).
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Literal

import httpx

from app.core.config import settings
from app.models.enums import ChatImportItemKind

logger = logging.getLogger(__name__)

CLASSIFY_MODEL = "gpt-4o-mini"
BATCH_SIZE = 25
# Ambiguous / commercial messages go to the model (regex only routes)
MAX_LLM_CANDIDATES = 400
BATCH_TIMEOUT_SECONDS = 35.0

# Listings older than this are skipped (stale marketplace noise)
LISTING_MAX_AGE_DAYS = 183  # ~6 months

Confidence = Literal["high", "low"]

# Anything commercial / property-ish → ask the small model (not static regex)
AMBIGUOUS_RE = re.compile(
    r"("
    r"for\s+sale|sell(?:ing)?|buy(?:ing)?|rent(?:ing|al)?|price|egp|\ble\b|"
    r"available|offer(?:ing)?|studio|apartment|villa|duplex|penthouse|flat|"
    r"furnished|semi\s*furnished|sqm|m2|م2|"
    r"للبيع|مطلوب|معروض|للتأجير|للتاجير|للايجار|للإيجار|"
    r"ايجار|إيجار|سعر|جنيه|كاش|قسط|هبيع|هابيع|بتباع|هشتري|"
    r"شقة|شقه|فيلا|عربيه|عربية|موتوسيكل|توك توك|ايفون|iphone|"
    r"recommend|plumber|electrician|cleaner|سباك|كهربائي|ترشيح|حد\s*يعرف|"
    r"صندوق|انترلوك|interlock|شارع|عداد|"
    r"\d{3,}"
    r")",
    re.IGNORECASE,
)

POST_CATEGORIES = {
    "GENERAL",
    "HELP",
    "LOST_FOUND",
    "EVENT",
    "DISCUSSION",
    "ALERT",
}


def _api_key() -> str | None:
    key = (
        settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_KEY") or ""
    ).strip()
    return key or None


def llm_classification_available() -> bool:
    return bool(_api_key())


def _parse_json_object(content: str) -> dict[str, Any]:
    match = re.search(r"\{.*\}", content or "", re.DOTALL)
    if not match:
        raise ValueError("No JSON object in LLM response")
    return json.loads(match.group())


def regex_kind_and_confidence(content: str) -> tuple[str, Confidence]:
    """
    Route only — keep static rules minimal.

    High confidence: obvious SKIP / short chat / mundane non-commercial POST.
    Low confidence: anything commercial/property-ish → small LLM decides dynamically.
    Never assign LISTING from regex when LLM will run (provisional POST).
    """
    from app.services.chat_import_parser import (
        CHATTY_REPLY_RE,
        GREETING_ONLY_RE,
        SKIP_RE,
        SYSTEM_MESSAGE_RE,
        classify_message,
        is_listing_offer,
    )

    cleaned = (content or "").strip()
    if not cleaned or SKIP_RE.match(cleaned) or SYSTEM_MESSAGE_RE.search(cleaned):
        return ChatImportItemKind.SKIP.value, "high"
    if GREETING_ONLY_RE.match(cleaned):
        return ChatImportItemKind.SKIP.value, "high"
    if len(cleaned) < 2:
        return ChatImportItemKind.SKIP.value, "high"
    if CHATTY_REPLY_RE.match(cleaned):
        return ChatImportItemKind.POST.value, "high"

    # Commercial / marketplace-adjacent → always ask the model
    if len(cleaned) >= 10 and AMBIGUOUS_RE.search(cleaned):
        return ChatImportItemKind.POST.value, "low"

    # No commercial signal: keep regex POST/SKIP, skip LLM
    kind = classify_message(cleaned).value
    # If regex somehow thought LISTING without ambiguous markers, still ask LLM
    if kind == ChatImportItemKind.LISTING.value or is_listing_offer(cleaned):
        return ChatImportItemKind.POST.value, "low"
    return kind, "high"


def _llm_candidate_priority(content: str) -> int:
    """Higher = more worth spending an LLM slot on when we hit the cap."""
    score = 0
    lower = content.lower()
    if AMBIGUOUS_RE.search(content):
        score += 2
    if re.search(
        r"للبيع|للإيجار|for\s+sale|for\s+rent|selling|available|شقة|apartment|villa",
        content,
        re.IGNORECASE,
    ):
        score += 3
    if re.search(r"\d{3,}", content):
        score += 1
    if "?" in content or "؟" in content:
        score += 1  # questions often mis-tagged; worth a check
    if len(content) > 40:
        score += 1
    if any(tok in lower for tok in ("thank", "شكرا", "leak", "duct")):
        score -= 2
    return score


async def classify_messages_with_llm(
    texts: list[str],
) -> list[dict[str, Any]]:
    """
    Classify each text as POST, LISTING, or SKIP.

    Returns a list aligned with `texts`, each dict may include:
      kind, confidence (high|low), intent, category, post_category, title
    Missing/failed entries return {}.
    """
    if not texts:
        return []
    key = _api_key()
    if not key:
        return [{} for _ in texts]

    results: list[dict[str, Any]] = [{} for _ in texts]
    timeout = httpx.Timeout(BATCH_TIMEOUT_SECONDS, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        for start in range(0, len(texts), BATCH_SIZE):
            batch = texts[start : start + BATCH_SIZE]
            numbered = "\n".join(
                f"{i}. {text[:500].replace(chr(10), ' ')}"
                for i, text in enumerate(batch)
            )
            prompt = f"""Classify Egyptian compound WhatsApp/Telegram messages (Arabic dialect + English).
Decide dynamically from meaning — do not rely on keyword shortcuts alone.

Kinds:
- SKIP: system noise or greeting-only ("السلام عليكم", "مساء الخير", joined group, media omitted).
- LISTING: ONLY when the sender is clearly OFFERING something they (or a friend they represent) have — selling, renting out, or advertising their own paid service.
  Examples: "Selling iPhone 13", "شقة للبيع", "دي شقة خاصة بواحد صاحبي للبيع", "185m apartment for rent", "im renting my apartment if anyone interested".
- POST: everything else — buyer/wanted requests, jokes, thanks, complaints, community talk, short replies.

CRITICAL — these are POST (neighbour requests), NEVER LISTING:
- "is anyone selling a 190 SQM apartment"
- "Anyone has a penthouse for rent?"
- "عايز يشتري شقة" / "حد عنده شقة للبيع"
- jokes or casual chat that only mention هبيع/selling without a real offer
- "Yes I do plz send me ur email", thanks, leaks/maintenance, meter/fund costs

Also return confidence: "high" or "low".
If you are not highly confident it is a real offer → kind=POST, confidence=low.

For LISTING also return:
- intent: SELL or RENT
- category: PROPERTY | CAR | ITEM | SERVICE
- title: max 80 chars

For POST also return:
- post_category: HELP (requests/wanted/asks) | LOST_FOUND | EVENT | ALERT | DISCUSSION | GENERAL
- is_service_recommendation: true if asking for a tradesperson

Return ONLY JSON:
{{"results":[{{"i":0,"kind":"POST|LISTING|SKIP","confidence":"high|low","intent":null,"category":null,"post_category":"HELP","is_service_recommendation":false,"title":null}}]}}

Messages:
{numbered}
"""
            try:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": CLASSIFY_MODEL,
                        "temperature": 0,
                        "max_tokens": 2500,
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "Strict bilingual classifier for neighbourhood chat imports. "
                                    "LISTING = clear offers only. When unsure, kind=POST and confidence=low. "
                                    "JSON only."
                                ),
                            },
                            {"role": "user", "content": prompt},
                        ],
                    },
                )
                if response.status_code != 200:
                    logger.warning(
                        "chat_import classify LLM error %s: %s",
                        response.status_code,
                        response.text[:300],
                    )
                    continue
                content = response.json()["choices"][0]["message"]["content"]
                parsed = _parse_json_object(content)
                for row in parsed.get("results") or []:
                    if not isinstance(row, dict):
                        continue
                    try:
                        idx = int(row.get("i"))
                    except (TypeError, ValueError):
                        continue
                    if idx < 0 or idx >= len(batch):
                        continue
                    kind_raw = str(row.get("kind") or "").upper()
                    if kind_raw not in {
                        ChatImportItemKind.POST.value,
                        ChatImportItemKind.LISTING.value,
                        ChatImportItemKind.SKIP.value,
                    }:
                        continue
                    conf_raw = str(row.get("confidence") or "low").lower()
                    confidence: Confidence = "high" if conf_raw == "high" else "low"
                    # Unsure listing → POST
                    if (
                        kind_raw == ChatImportItemKind.LISTING.value
                        and confidence != "high"
                    ):
                        kind_raw = ChatImportItemKind.POST.value
                        confidence = "low"
                    entry: dict[str, Any] = {
                        "kind": kind_raw,
                        "confidence": confidence,
                        "source": "llm",
                    }
                    intent = row.get("intent")
                    if intent:
                        entry["intent"] = str(intent).upper()
                    category = str(row.get("category") or "").upper()
                    if category in {"PROPERTY", "CAR", "ITEM", "SERVICE"}:
                        entry["category"] = category
                    post_category = str(row.get("post_category") or "").upper()
                    if post_category in POST_CATEGORIES:
                        entry["post_category"] = post_category
                    if row.get("is_service_recommendation") is True:
                        entry["is_service_recommendation"] = True
                    title = row.get("title")
                    if title:
                        entry["title"] = str(title).strip()[:120]
                    results[start + idx] = entry
            except Exception as exc:  # noqa: BLE001
                logger.warning("chat_import classify batch failed: %s", exc)
                continue
    return results


def _apply_hard_overrides(content: str, kind: str) -> str:
    """Regex vetoes the model can never override."""
    from app.services.chat_import_parser import (
        CHATTY_REPLY_RE,
        GREETING_ONLY_RE,
        SYSTEM_MESSAGE_RE,
        is_wanted_inquiry,
    )

    cleaned = (content or "").strip()
    if SYSTEM_MESSAGE_RE.search(cleaned) or GREETING_ONLY_RE.match(cleaned):
        return ChatImportItemKind.SKIP.value
    if CHATTY_REPLY_RE.match(cleaned) or is_wanted_inquiry(cleaned):
        return ChatImportItemKind.POST.value
    return kind


async def enrich_import_items_with_llm(items: list[dict[str, Any]]) -> dict[str, int]:
    """
    Mutate content items in-place using confidence-gated LLM classification,
    then re-assign post→comment threads.
    """
    from app.services.chat_import_parser import (
        ensure_listing_normalized,
        infer_post_category,
        is_wanted_inquiry,
        rethread_items,
        skip_reason,
        SYSTEM_MESSAGE_RE,
        GREETING_ONLY_RE,
    )

    # Flatten prior comments so classifier sees every text message
    for item in items:
        if item.get("kind") == ChatImportItemKind.COMMENT.value:
            item["kind"] = ChatImportItemKind.POST.value
            normalized = dict(item.get("normalized") or {})
            normalized.pop("parent_message_index", None)
            item["normalized"] = normalized
            item["decision"] = "APPROVED"
            item["reject_reason"] = None

    high_conf = 0
    low_conf = 0
    scored_candidates: list[tuple[int, int, str]] = []  # priority, idx, content

    for idx, item in enumerate(items):
        if item.get("kind") == ChatImportItemKind.USER.value:
            continue
        content = str((item.get("normalized") or {}).get("content") or "").strip()
        if not content:
            continue

        # Hard skip system / greeting noise
        if SYSTEM_MESSAGE_RE.search(content) or GREETING_ONLY_RE.match(content):
            item["kind"] = ChatImportItemKind.SKIP.value
            item["decision"] = "REJECTED"
            item["reject_reason"] = skip_reason(content)
            high_conf += 1
            continue

        kind, confidence = regex_kind_and_confidence(content)
        item["kind"] = kind
        normalized = dict(item.get("normalized") or {})
        normalized["classification_confidence"] = confidence
        normalized["classification_source"] = "regex"
        if kind == ChatImportItemKind.SKIP.value:
            item["decision"] = "REJECTED"
            item["reject_reason"] = item.get("reject_reason") or skip_reason(content)
        else:
            item["decision"] = "APPROVED"
            item["reject_reason"] = None
        if kind == ChatImportItemKind.LISTING.value:
            item["normalized"] = ensure_listing_normalized(normalized)
        elif kind == ChatImportItemKind.POST.value:
            if not normalized.get("post_category"):
                normalized["post_category"] = infer_post_category(content)
            item["normalized"] = normalized
        else:
            item["normalized"] = normalized

        if confidence == "high":
            high_conf += 1
            continue

        low_conf += 1
        scored_candidates.append((_llm_candidate_priority(content), idx, content))

    scored_candidates.sort(key=lambda row: row[0], reverse=True)
    capped = scored_candidates[:MAX_LLM_CANDIDATES]
    candidates = [(idx, content) for _, idx, content in capped]

    stats: dict[str, Any] = {
        "llm_classified": 0,
        "llm_listings": 0,
        "llm_posts": 0,
        "llm_skipped": 0,
        "llm_used": 0,
        "llm_candidates": len(candidates),
        "llm_capped": 1 if len(scored_candidates) > MAX_LLM_CANDIDATES else 0,
        "regex_high_confidence": high_conf,
        "regex_low_confidence": low_conf,
        "llm_low_conf_default_post": 0,
    }

    if candidates and llm_classification_available():
        stats["llm_used"] = 1
        try:
            classifications = await classify_messages_with_llm([c[1] for c in candidates])
        except Exception as exc:  # noqa: BLE001
            logger.warning("chat_import LLM enrich aborted: %s", exc)
            stats["llm_error"] = str(exc)[:200]
            classifications = []

        for (item_idx, content), classification in zip(candidates, classifications):
            item = items[item_idx]
            normalized = dict(item.get("normalized") or {})

            if not classification:
                # Model failed this row → stay POST (never promote to LISTING)
                item["kind"] = ChatImportItemKind.POST.value
                item["decision"] = "APPROVED"
                item["reject_reason"] = None
                normalized["post_category"] = infer_post_category(content)
                normalized["classification_source"] = "regex_fallback"
                normalized["classification_confidence"] = "low"
                item["normalized"] = normalized
                stats["llm_low_conf_default_post"] += 1
                continue

            kind = _apply_hard_overrides(content, classification["kind"])
            item["kind"] = kind
            normalized["classification_source"] = "llm"
            normalized["classification_confidence"] = classification.get(
                "confidence", "low"
            )

            if kind == ChatImportItemKind.SKIP.value:
                item["decision"] = "REJECTED"
                item["reject_reason"] = item.get("reject_reason") or skip_reason(content)
                stats["llm_skipped"] += 1
            else:
                item["decision"] = "APPROVED"
                item["reject_reason"] = None

            if kind == ChatImportItemKind.LISTING.value:
                # Trust high-confidence LLM offers even without strong regex phrasing
                stats["llm_listings"] += 1
                if classification.get("title"):
                    normalized["title"] = classification["title"]
                if classification.get("intent") in ("SELL", "RENT"):
                    normalized["intent"] = classification["intent"]
                if classification.get("category") in {
                    "PROPERTY",
                    "CAR",
                    "ITEM",
                    "SERVICE",
                }:
                    normalized["category"] = classification["category"]
                normalized = ensure_listing_normalized(normalized)
                normalized.pop("post_category", None)
                normalized.pop("is_service_recommendation", None)
            elif kind == ChatImportItemKind.POST.value:
                stats["llm_posts"] += 1
                post_category = classification.get("post_category") or infer_post_category(
                    content
                )
                if post_category not in POST_CATEGORIES:
                    post_category = "GENERAL"
                if is_wanted_inquiry(content):
                    post_category = "HELP"
                normalized["post_category"] = post_category
                if classification.get("is_service_recommendation"):
                    normalized["is_service_recommendation"] = True
                    normalized["post_category"] = "HELP"
                for key in ("title", "intent", "category", "price", "currency"):
                    normalized.pop(key, None)

            item["normalized"] = normalized
            stats["llm_classified"] += 1

    elif candidates and not llm_classification_available():
        stats["llm_skipped_reason"] = "OPENAI_API_KEY not set"
        # Offline fallback: use regex offer detector for low-confidence rows
        from app.services.chat_import_parser import (
            classify_message,
            ensure_listing_normalized,
            is_listing_offer,
        )

        for item_idx, content in candidates:
            item = items[item_idx]
            kind = (
                ChatImportItemKind.LISTING.value
                if is_listing_offer(content)
                else classify_message(content).value
            )
            kind = _apply_hard_overrides(content, kind)
            item["kind"] = kind
            normalized = dict(item.get("normalized") or {})
            normalized["classification_source"] = "regex_fallback"
            normalized["classification_confidence"] = "low"
            if kind == ChatImportItemKind.LISTING.value:
                item["normalized"] = ensure_listing_normalized(normalized)
                item["decision"] = "APPROVED"
            elif kind == ChatImportItemKind.SKIP.value:
                item["decision"] = "REJECTED"
                item["reject_reason"] = skip_reason(content)
                item["normalized"] = normalized
            else:
                normalized["post_category"] = infer_post_category(content)
                item["decision"] = "APPROVED"
                item["normalized"] = normalized
        stats["llm_low_conf_default_post"] = 0
        stats["regex_fallback_classified"] = len(candidates)

    # Ensure every POST has a post_category
    for item in items:
        if item.get("kind") != ChatImportItemKind.POST.value:
            continue
        normalized = dict(item.get("normalized") or {})
        if not normalized.get("post_category"):
            normalized["post_category"] = infer_post_category(
                str(normalized.get("content") or "")
            )
            item["normalized"] = normalized

    # Absolute veto: wanted / chatty must never remain LISTING
    from app.services.chat_import_parser import (
        CHATTY_REPLY_RE,
        is_stale_listing_timestamp,
    )

    demoted = 0
    for item in items:
        if item.get("kind") != ChatImportItemKind.LISTING.value:
            continue
        content = str((item.get("normalized") or {}).get("content") or "")
        if not (is_wanted_inquiry(content) or CHATTY_REPLY_RE.match(content.strip())):
            continue
        item["kind"] = ChatImportItemKind.POST.value
        item["decision"] = "APPROVED"
        item["reject_reason"] = None
        normalized = dict(item.get("normalized") or {})
        for key in ("title", "intent", "category", "price", "currency"):
            normalized.pop(key, None)
        normalized["post_category"] = "HELP"
        item["normalized"] = normalized
        demoted += 1
    stats["hard_veto_demoted_to_post"] = demoted

    # Drop marketplace offers older than ~6 months
    stale = 0
    for item in items:
        if item.get("kind") != ChatImportItemKind.LISTING.value:
            continue
        normalized = dict(item.get("normalized") or {})
        stamp = normalized.get("created_at") or normalized.get("timestamp")
        if not is_stale_listing_timestamp(
            stamp if isinstance(stamp, str) else None
        ):
            continue
        item["kind"] = ChatImportItemKind.SKIP.value
        item["decision"] = "REJECTED"
        item["reject_reason"] = "Listing older than 6 months"
        normalized["stale_listing"] = True
        item["normalized"] = normalized
        stale += 1
    stats["listings_skipped_older_than_6_months"] = stale

    rethread_items(items)
    return stats


def content_title(text: str) -> str:
    line = (text or "").strip().splitlines()[0].strip()
    return line[:120] if line else "Imported listing"
