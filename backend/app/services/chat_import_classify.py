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
MAX_LLM_CANDIDATES = 60
BATCH_TIMEOUT_SECONDS = 35.0

# Commercial / listing-ish signals worth sending to the LLM
AMBIGUOUS_RE = re.compile(
    r"("
    r"for\s+sale|sell(?:ing)?|buy(?:ing)?|rent(?:ing|al)?|price|egp|\ble\b|"
    r"للبيع|مطلوب|معروض|للتأجير|للتاجير|للايجار|للإيجار|"
    r"ايجار|إيجار|سعر|جنيه|كاش|قسط|هبيع|هابيع|بتباع|هشتري|"
    r"شقة|فيلا|عربيه|عربية|موتوسيكل|توك توك|ايفون|iphone|"
    r"\d{3,}"
    r")",
    re.IGNORECASE,
)


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
    if kind == ChatImportItemKind.LISTING.value:
        return True
    if kind == ChatImportItemKind.SKIP.value:
        return False
    if len(content) < 12:
        return False
    return bool(AMBIGUOUS_RE.search(content))


async def classify_messages_with_llm(
    texts: list[str],
) -> list[dict[str, Any]]:
    """
    Classify each text as POST, LISTING, or SKIP.

    Returns a list aligned with `texts`, each dict may include:
      kind, intent (SELL|RENT), title
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
            prompt = f"""Classify Egyptian compound WhatsApp messages (Arabic dialect + English).

For each numbered message return kind:
- LISTING: selling/buying/renting goods, homes, cars, paid services
- POST: chat, questions, recommendations, lost&found (not a sale)
- SKIP: empty/media/deleted noise

For LISTING also: intent SELL or RENT, title max 80 chars.

Return ONLY JSON:
{{"results":[{{"i":0,"kind":"POST|LISTING|SKIP","intent":"SELL|RENT|null","title":"..."}}]}}

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
                        "max_tokens": 1800,
                        "messages": [
                            {
                                "role": "system",
                                "content": "Bilingual Arabic/English classifier. JSON only.",
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
                    title = row.get("title")
                    if title:
                        entry["title"] = str(title).strip()[:120]
                    results[start + idx] = entry
            except Exception as exc:  # noqa: BLE001
                logger.warning("chat_import classify batch failed: %s", exc)
                # Continue other batches; soft-fail overall
                continue
    return results


async def enrich_import_items_with_llm(items: list[dict[str, Any]]) -> dict[str, int]:
    """
    Mutate content items in-place: refine ambiguous POST/LISTING via cheap LLM,
    then re-assign post→comment threads.

    Soft-fails: regex classifications are kept if LLM is slow/unavailable.
    """
    from app.services.chat_import_parser import rethread_items

    # Flatten prior comments so classifier sees every text message
    for item in items:
        if item.get("kind") == ChatImportItemKind.COMMENT.value:
            item["kind"] = ChatImportItemKind.POST.value
            normalized = dict(item.get("normalized") or {})
            normalized.pop("parent_message_index", None)
            item["normalized"] = normalized
            item["decision"] = "APPROVED"
            item["reject_reason"] = None

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
                item["reject_reason"] = item.get("reject_reason") or "Skipped by classifier"
            else:
                item["decision"] = "APPROVED"
                item["reject_reason"] = None
            if kind == ChatImportItemKind.LISTING.value:
                stats["llm_listings"] += 1
                if classification.get("title"):
                    normalized["title"] = classification["title"]
                elif not normalized.get("title"):
                    normalized["title"] = content_title(normalized.get("content") or "")
                if classification.get("intent") in ("SELL", "RENT"):
                    normalized["intent"] = classification["intent"]
                if normalized.get("price") is None:
                    from app.services.chat_import_parser import extract_price

                    normalized["price"] = extract_price(str(normalized.get("content") or ""))
                if not normalized.get("intent"):
                    from app.services.chat_import_parser import listing_intent

                    normalized["intent"] = listing_intent(str(normalized.get("content") or ""))
                normalized.setdefault("description", normalized.get("content"))
                normalized.setdefault("category", "ITEM")
                normalized.setdefault("currency", "EGP")
            item["normalized"] = normalized
            stats["llm_classified"] += 1
    elif candidates and not llm_classification_available():
        stats["llm_skipped_reason"] = "OPENAI_API_KEY not set"

    rethread_items(items)
    return stats


def content_title(text: str) -> str:
    line = (text or "").strip().splitlines()[0].strip()
    return line[:120] if line else "Imported listing"
