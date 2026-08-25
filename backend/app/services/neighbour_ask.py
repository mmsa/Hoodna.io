"""Ask neighbours: answer questions from compound history (posts, listings, businesses)."""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import httpx
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.business import IndependentBusiness
from app.models.enums import ListingCategory, ListingStatus, PostCategory
from app.models.listing import Listing
from app.models.post import Post
from app.schemas.community import AskCitation, AskResponse

logger = logging.getLogger(__name__)
ASK_MODEL = "gpt-4o-mini"


def _api_key() -> str | None:
    key = (
        settings.OPENAI_API_KEY or os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_KEY") or ""
    ).strip()
    return key or None


def _tokenize(text: str) -> set[str]:
    return {t for t in re.findall(r"[a-zA-Z\u0600-\u06FF0-9]{3,}", (text or "").lower())}


async def _corpus(db: AsyncSession, compound_id: int) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []

    posts = (
        await db.execute(
            select(Post)
            .options(selectinload(Post.author))
            .where(
                Post.compound_id == compound_id,
                Post.deleted_at.is_(None),
                Post.category.in_(
                    [
                        PostCategory.HELP,
                        PostCategory.DISCUSSION,
                        PostCategory.GENERAL,
                        PostCategory.LOST_FOUND,
                        PostCategory.EVENT,
                    ]
                ),
            )
            .order_by(Post.created_at.desc())
            .limit(40)
        )
    ).scalars().all()
    for post in posts:
        items.append(
            {
                "type": "post",
                "id": post.id,
                "title": (post.content or "")[:80],
                "text": post.content or "",
                "url_path": f"/post/{post.id}",
                "category": post.category.value if post.category else "GENERAL",
            }
        )

    listings = (
        await db.execute(
            select(Listing)
            .where(
                Listing.compound_id == compound_id,
                Listing.status == ListingStatus.ACTIVE,
                or_(
                    Listing.category == ListingCategory.SERVICE,
                    Listing.category == ListingCategory.ITEM,
                ),
            )
            .order_by(Listing.created_at.desc())
            .limit(30)
        )
    ).scalars().all()
    for listing in listings:
        text = f"{listing.title} {listing.description or ''}"
        items.append(
            {
                "type": "listing",
                "id": listing.id,
                "title": listing.title,
                "text": text,
                "url_path": f"/listing/{listing.id}",
                "category": listing.category.value,
            }
        )

    businesses = (
        await db.execute(
            select(IndependentBusiness)
            .where(
                IndependentBusiness.is_active.is_(True),
                IndependentBusiness.is_hidden.is_(False),
                or_(
                    IndependentBusiness.compound_id == compound_id,
                    IndependentBusiness.compound_id.is_(None),
                ),
            )
            .order_by(IndependentBusiness.created_at.desc())
            .limit(30)
        )
    ).scalars().all()
    for biz in businesses:
        text = f"{biz.name} {biz.category} {biz.description or ''} {biz.area or ''}"
        items.append(
            {
                "type": "business",
                "id": biz.id,
                "title": biz.name,
                "text": text,
                "url_path": f"/businesses/{biz.slug}",
                "category": biz.category,
            }
        )

    return items


def _keyword_rank(question: str, items: list[dict[str, Any]], limit: int = 8) -> list[dict[str, Any]]:
    q_tokens = _tokenize(question)
    scored: list[tuple[int, dict[str, Any]]] = []
    for item in items:
        text_tokens = _tokenize(f"{item['title']} {item['text']} {item.get('category', '')}")
        score = len(q_tokens & text_tokens)
        if score:
            scored.append((score, item))
    scored.sort(key=lambda pair: (-pair[0], pair[1]["type"]))
    return [item for _, item in scored[:limit]]


async def _llm_answer(question: str, context_items: list[dict[str, Any]]) -> str | None:
    api_key = _api_key()
    if not api_key or not context_items:
        return None
    context_blob = "\n".join(
        f"[{i}] ({item['type']}#{item['id']}) {item['title']}: {item['text'][:240]}"
        for i, item in enumerate(context_items)
    )
    prompt = (
        "You help Egyptian compound neighbours find recommendations from local history. "
        "Answer briefly in the user's language (Arabic or English). "
        "Only use the provided context. If unsure, say neighbours have not discussed this much. "
        "Mention useful sources by their [index].\n\n"
        f"Question: {question}\n\nContext:\n{context_blob}"
    )
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": ASK_MODEL,
                    "temperature": 0.2,
                    "messages": [
                        {"role": "system", "content": "You are eljiran Ask for neighbourhood recommendations."},
                        {"role": "user", "content": prompt},
                    ],
                },
            )
            response.raise_for_status()
            data = response.json()
            return (data["choices"][0]["message"]["content"] or "").strip() or None
    except Exception:
        logger.exception("neighbour ask LLM failed")
        return None


async def answer_neighbour_question(
    db: AsyncSession, *, compound_id: int, question: str
) -> AskResponse:
    items = await _corpus(db, compound_id)
    top = _keyword_rank(question, items, limit=8)
    if not top:
        # Fall back to newest HELP/SERVICE/business snippets
        top = items[:6]

    llm_text = await _llm_answer(question, top)
    used_llm = bool(llm_text)
    if not llm_text:
        if top:
            bullets = "\n".join(f"• {item['title']}" for item in top[:5])
            llm_text = (
                "Here is what neighbours and local listings mention that may help:\n"
                f"{bullets}"
            )
        else:
            llm_text = (
                "No strong matches yet in this compound. Try asking in the feed as a Help post."
            )

    citations = [
        AskCitation(
            type=item["type"],
            id=item["id"],
            title=item["title"][:120],
            url_path=item["url_path"],
            snippet=(item["text"] or "")[:160] or None,
        )
        for item in top[:6]
    ]
    return AskResponse(answer=llm_text, citations=citations, used_llm=used_llm)
