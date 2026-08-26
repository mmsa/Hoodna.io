"""Keep or discard community content published from chat import for a user."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.listing import archive_listing
from app.crud.post import delete_post
from app.models.chat_import import ChatImportItem
from app.models.listing import Listing
from app.models.post import Comment, Post
from app.models.user import User


async def imported_entity_ids(db: AsyncSession, user_id: int) -> dict[str, list[int]]:
    result = await db.execute(
        select(
            ChatImportItem.published_entity_type,
            ChatImportItem.published_entity_id,
        ).where(
            ChatImportItem.matched_user_id == user_id,
            ChatImportItem.published_entity_id.is_not(None),
        )
    )
    buckets: dict[str, list[int]] = {"POST": [], "COMMENT": [], "LISTING": [], "USER": []}
    for entity_type, entity_id in result.all():
        if not entity_type or entity_id is None:
            continue
        key = str(entity_type).upper()
        if key in buckets and int(entity_id) not in buckets[key]:
            buckets[key].append(int(entity_id))
    return buckets


async def summarize_imported_content(db: AsyncSession, user_id: int) -> dict[str, int]:
    ids = await imported_entity_ids(db, user_id)
    posts = 0
    comments = 0
    listings = 0
    if ids["POST"]:
        post_rows = await db.execute(
            select(Post.id).where(Post.id.in_(ids["POST"]), Post.deleted_at.is_(None))
        )
        posts = len(list(post_rows.scalars().all()))
    if ids["COMMENT"]:
        comment_rows = await db.execute(
            select(Comment.id).where(
                Comment.id.in_(ids["COMMENT"]), Comment.deleted_at.is_(None)
            )
        )
        comments = len(list(comment_rows.scalars().all()))
    if ids["LISTING"]:
        listing_rows = await db.execute(
            select(Listing.id).where(
                Listing.id.in_(ids["LISTING"]), Listing.deleted_at.is_(None)
            )
        )
        listings = len(list(listing_rows.scalars().all()))
    return {
        "posts": posts,
        "comments": comments,
        "listings": listings,
        "total": posts + comments + listings,
    }


async def is_imported_listing(db: AsyncSession, listing_id: int, owner_id: int) -> bool:
    result = await db.execute(
        select(ChatImportItem.id).where(
            ChatImportItem.matched_user_id == owner_id,
            ChatImportItem.published_entity_type == "LISTING",
            ChatImportItem.published_entity_id == listing_id,
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def is_imported_post(db: AsyncSession, post_id: int, author_id: int) -> bool:
    result = await db.execute(
        select(ChatImportItem.id).where(
            ChatImportItem.matched_user_id == author_id,
            ChatImportItem.published_entity_type == "POST",
            ChatImportItem.published_entity_id == post_id,
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def discard_imported_content(db: AsyncSession, user: User) -> dict[str, Any]:
    ids = await imported_entity_ids(db, user.id)
    removed = {"posts": 0, "comments": 0, "listings": 0}

    for post_id in ids["POST"]:
        if await delete_post(db, post_id):
            removed["posts"] += 1

    now = datetime.now(timezone.utc)
    if ids["COMMENT"]:
        comment_rows = await db.execute(
            select(Comment).where(
                Comment.id.in_(ids["COMMENT"]),
                Comment.deleted_at.is_(None),
            )
        )
        for comment in comment_rows.scalars().all():
            comment.deleted_at = now
            removed["comments"] += 1

    for listing_id in ids["LISTING"]:
        if await archive_listing(db, listing_id):
            removed["listings"] += 1

    return removed


def needs_imported_content_choice(user: User) -> bool:
    if getattr(user, "imported_content_choice", None):
        return False
    source = getattr(user, "creation_source", None)
    return source == "CHAT_IMPORT"
