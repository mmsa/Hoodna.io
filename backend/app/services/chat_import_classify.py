"""Cheap LLM classification for chat-import listing vs post (Arabic + English)."""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import httpx

from app.core.config import settings
from app.models.enums import ChatImportItemKind

logger = logging.getLogger(__name__)

CLASSIFY_MODEL = "gpt-4o-mini"
BATCH_SIZE = 25
# Keep parse responsive on large WhatsApp groups
MAX_LLM_CANDIDATES = 80
BATCH_TIMEOUT_SECONDS = 35.0

# Signals worth sending to the LLM (ambiguous commercial / service chat)
AMBIGUOUS_RE = re.compile(
    r"("
    r"for\s+sale|sell(?:ing)?|buy(?:ing)?|rent(?:ing|al)?|price|egp|\ble\b|"
    r"للبيع|مطلوب|معروض|للتأجير|للتاجير|للايجار|للإيجار|"
    r"ايجار|إيجار|سعر|جنيه|كاش|قسط|هبيع|هابيع|بتباع|هشتري|"
    r"شقة|فيلا|عربيه|عربية|موتوسيكل|توك توك|ايفون|iphone|"
    r"recommend|plumber|electrician|cleaner|سباك|كهربائي|ترشيح|حد\s*يعرف|"
    r"صندوق|انترلوك|interlock|شارع|"
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


def _should_llm_classify(kind: str, content: str) -> bool:
    """Only spend LLM tokens on likely listings / ambiguous commercial chat."""
    if kind == ChatImportItemKind.SKIP.value:
        return False
    if kind == ChatImportItemKind.LISTING.value:
        return True
    if len(content) < 8:
        return False
    return bool(AMBIGUOUS_RE.search(content))


async def classify_messages_with_llm(
    texts: list[str],
) -> list[dict[str, Any]]:
    """
    Classify each text as POST, LISTING, or SKIP.

    Returns a list aligned with `texts`, each dict may include:
      kind, intent (SELL|RENT), category, post_category, title
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

Kinds:
- SKIP: WhatsApp/Telegram system noise ONLY — e.g. "You joined using a group link", "created this group", "turned on admin approval", media omitted, deleted messages, encryption notices. Also skip greeting-only lines like "السلام عليكم" / "مساء الخير".
- LISTING: ONLY when the sender is OFFERING something they have — selling, renting out, or advertising their own paid service. Examples: "Selling iPhone 13", "شقة للبيع", "255m Duplex available for Sale", "Studio for rent — call me".
- POST: everything else — questions, buyer/wanted requests, recommendations, community works, lost&found, process questions, discussions.

CRITICAL — do NOT mark as LISTING when the sender is SEEKING / asking (these are POST with post_category HELP = neighbour request):
- "Anyone has a penthouse for rent?" / "looking for an apartment"
- "عايز يشتري شقة" / "لو حد عنده شقه للبيع"
- buying, wanted, "مطلوب شراء", friend wants to buy/rent
- process questions ("what if I already paid…?")
- service provider asks ("anyone know a plumber?")
- street/compound fund or contractor price talk

For LISTING also return:
- intent: SELL or RENT (never for buyer requests — those are POST)
- category: PROPERTY | CAR | ITEM | SERVICE (SERVICE only if they advertise their own paid service)
- title: max 80 chars

For POST also return:
- post_category: HELP (neighbour requests: wanted/buyer, recommendations, asks) | LOST_FOUND | EVENT | ALERT | DISCUSSION (community works/fund) | GENERAL
- is_service_recommendation: true if asking for / recommending a tradesperson

Return ONLY JSON:
{{"results":[{{"i":0,"kind":"POST|LISTING|SKIP","intent":null,"category":null,"post_category":"HELP","is_service_recommendation":false,"title":null}}]}}

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
                        "max_tokens": 2200,
                        "messages": [
                            {
                                "role": "system",
                                "content": (
                                    "Strict bilingual classifier for neighbourhood chat imports. "
                                    "LISTING = offers only (seller/landlord). Buyer/wanted/enquiries = POST. "
                                    "Prefer POST over LISTING when unsure. Prefer SKIP for system noise. JSON only."
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
                    entry: dict[str, Any] = {"kind": kind_raw}
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


async def enrich_import_items_with_llm(items: list[dict[str, Any]]) -> dict[str, int]:
    """
    Mutate content items in-place: refine ambiguous POST/LISTING via cheap LLM,
    then re-assign post→comment threads.

    Soft-fails: regex classifications are kept if LLM is slow/unavailable.
    """
    from app.services.chat_import_parser import (
        ensure_listing_normalized,
        infer_post_category,
        is_listing_offer,
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

    # Hard-skip system / greeting noise even if earlier pass missed them
    for item in items:
        if item.get("kind") == ChatImportItemKind.USER.value:
            continue
        content = str((item.get("normalized") or {}).get("content") or "").strip()
        if SYSTEM_MESSAGE_RE.search(content) or GREETING_ONLY_RE.match(content):
            item["kind"] = ChatImportItemKind.SKIP.value
            item["decision"] = "REJECTED"
            item["reject_reason"] = skip_reason(content)

    candidates: list[tuple[int, str]] = []
    for idx, item in enumerate(items):
        kind = item.get("kind")
        if kind == ChatImportItemKind.USER.value:
            continue
        content = str((item.get("normalized") or {}).get("content") or "").strip()
        if not content:
            continue
        if not _should_llm_classify(str(kind), content):
            continue
        candidates.append((idx, content))
        if len(candidates) >= MAX_LLM_CANDIDATES:
            break

    stats: dict[str, Any] = {
        "llm_classified": 0,
        "llm_listings": 0,
        "llm_posts": 0,
        "llm_skipped": 0,
        "llm_used": 0,
        "llm_candidates": len(candidates),
        "llm_capped": 1 if len(candidates) >= MAX_LLM_CANDIDATES else 0,
    }

    if candidates and llm_classification_available():
        stats["llm_used"] = 1
        try:
            classifications = await classify_messages_with_llm([c[1] for c in candidates])
        except Exception as exc:  # noqa: BLE001
            logger.warning("chat_import LLM enrich aborted: %s", exc)
            stats["llm_error"] = str(exc)[:200]
            classifications = []

        for (item_idx, _), classification in zip(candidates, classifications):
            if not classification:
                continue
            kind = classification["kind"]
            item = items[item_idx]
            normalized = dict(item.get("normalized") or {})
            item["kind"] = kind
            if kind == ChatImportItemKind.SKIP.value:
                item["decision"] = "REJECTED"
                item["reject_reason"] = item.get("reject_reason") or skip_reason(
                    str(normalized.get("content") or "")
                )
                stats["llm_skipped"] += 1
            else:
                item["decision"] = "APPROVED"
                item["reject_reason"] = None
            # Safety: demote anything that is not a clear seller/landlord offer
            content = str(normalized.get("content") or "")
            if kind == ChatImportItemKind.LISTING.value and not is_listing_offer(content):
                kind = ChatImportItemKind.POST.value
                item["kind"] = kind
                classification = {
                    **classification,
                    "kind": kind,
                    "post_category": classification.get("post_category")
                    or ("HELP" if is_wanted_inquiry(content) else "GENERAL"),
                }

            if kind == ChatImportItemKind.LISTING.value:
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
                    str(normalized.get("content") or "")
                )
                if post_category not in POST_CATEGORIES:
                    post_category = "GENERAL"
                normalized["post_category"] = post_category
                if classification.get("is_service_recommendation"):
                    normalized["is_service_recommendation"] = True
                    normalized["post_category"] = "HELP"
            item["normalized"] = normalized
            stats["llm_classified"] += 1
    elif candidates and not llm_classification_available():
        stats["llm_skipped_reason"] = "OPENAI_API_KEY not set"

    # Ensure every POST has a post_category even without LLM
    for item in items:
        if item.get("kind") != ChatImportItemKind.POST.value:
            continue
        normalized = dict(item.get("normalized") or {})
        if not normalized.get("post_category"):
            normalized["post_category"] = infer_post_category(
                str(normalized.get("content") or "")
            )
            item["normalized"] = normalized

    # Final guard: LISTING only for clear offers (regex or LLM mistags otherwise)
    demoted = 0
    for item in items:
        if item.get("kind") != ChatImportItemKind.LISTING.value:
            continue
        content = str((item.get("normalized") or {}).get("content") or "")
        if is_listing_offer(content):
            continue
        item["kind"] = ChatImportItemKind.POST.value
        item["decision"] = "APPROVED"
        item["reject_reason"] = None
        normalized = dict(item.get("normalized") or {})
        for key in ("title", "intent", "category", "price", "currency"):
            normalized.pop(key, None)
        normalized["post_category"] = (
            "HELP" if is_wanted_inquiry(content) else infer_post_category(content)
        )
        item["normalized"] = normalized
        demoted += 1
    stats["non_offer_demoted_to_post"] = demoted

    rethread_items(items)
    return stats


def content_title(text: str) -> str:
    line = (text or "").strip().splitlines()[0].strip()
    return line[:120] if line else "Imported listing"
