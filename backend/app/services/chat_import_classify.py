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
BATCH_SIZE = 35


def _api_key() -> str | None:
    key = (settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_KEY") or "").strip()
    return key or None


def llm_classification_available() -> bool:
    return bool(_api_key())


def _parse_json_object(content: str) -> dict[str, Any]:
    match = re.search(r"\{.*\}", content or "", re.DOTALL)
    if not match:
        raise ValueError("No JSON object in LLM response")
    return json.loads(match.group())


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
    async with httpx.AsyncClient(timeout=90.0) as client:
        for start in range(0, len(texts), BATCH_SIZE):
            batch = texts[start : start + BATCH_SIZE]
            numbered = "\n".join(
                f"{i}. {text[:800].replace(chr(10), ' ')}"
                for i, text in enumerate(batch)
            )
            prompt = f"""You classify compound WhatsApp/Telegram group messages for an Egyptian community app (eljiran).
Most messages are Arabic (Egyptian dialect) or English.

For each numbered message, return kind:
- LISTING: buying/selling/renting something (furniture, appliances, cars, apartments, services for pay, etc.)
- POST: community chat, questions, announcements, lost & found, recommendations (not a sale)
- SKIP: empty, media-only, deleted, or useless system noise

Also for LISTING only:
- intent: SELL or RENT
- title: short title max 80 chars (Arabic or English ok)

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
                        "max_tokens": 2500,
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are a precise bilingual (Arabic/English) message classifier. Reply with JSON only.",
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
    return results


async def enrich_import_items_with_llm(items: list[dict[str, Any]]) -> dict[str, int]:
    """
    Mutate content items in-place: refine POST/LISTING/SKIP via cheap LLM,
    then re-assign post→comment threads.
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
        if kind == ChatImportItemKind.SKIP.value and len(content) < 8:
            continue
        candidates.append((idx, content))

    stats = {"llm_classified": 0, "llm_listings": 0, "llm_used": 0}
    if candidates and llm_classification_available():
        stats["llm_used"] = 1
        classifications = await classify_messages_with_llm([c[1] for c in candidates])
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

    rethread_items(items)
    return stats


def content_title(text: str) -> str:
    line = (text or "").strip().splitlines()[0].strip()
    return line[:120] if line else "Imported listing"
