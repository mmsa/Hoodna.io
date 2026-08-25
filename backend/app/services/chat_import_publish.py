"""Publish approved chat-import items into users, posts, comments, and listings."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.user import create_user_by_phone, get_user_by_phone
from app.crud.user_compound_membership import ensure_pending_compound_membership
from app.models.chat_import import ChatImportItem, ChatImportJob
from app.models.enums import (
    ChatImportItemDecision,
    ChatImportItemKind,
    ChatImportJobStatus,
    ListingCategory,
    ListingIntent,
    ListingStatus,
    PostCategory,
    UserRole,
    UserStatus,
)
from app.models.listing import Listing
from app.models.moderation import AuditLog
from app.models.post import Comment, Post
from app.models.user import User
from app.models.user_compound_membership import UserCompoundMembership
from app.services.chat_import_parser import (
    _sender_display,
    is_phone_like_sender,
    normalize_phone,
    parse_import_timestamp,
    redact_phones,
)


def _synthetic_phone(name: str) -> str:
    digest = abs(hash(name.strip().lower() or "neighbour")) % (10**9)
    return f"900{digest:09d}"


def _original_created_at(normalized: dict[str, Any]):
    """Prefer original chat timestamp so feed shows historical times."""
    raw = normalized.get("created_at") or normalized.get("timestamp")
    return parse_import_timestamp(raw if isinstance(raw, str) else None)


def _safe_public_name(name: str | None, phone: str | None = None) -> str:
    display = _sender_display(name or "", phone)
    if is_phone_like_sender(display):
        return "Neighbour"
    return display


async def resolve_or_create_invited_user(
    db: AsyncSession,
    *,
    compound_id: int,
    phone: str | None,
    name: str | None,
) -> User:
    display_name = _safe_public_name(name, phone)
    normalized = normalize_phone(phone) if phone else None
    if not normalized:
        normalized = _synthetic_phone(display_name)

    user = await get_user_by_phone(db, normalized)
    if not user:
        user = await create_user_by_phone(db, normalized, display_name)
        user.profile_setup_required = True
    else:
        # Never overwrite a real name with a phone-like string
        if display_name and display_name != "Neighbour":
            if (
                not user.name
                or user.name.startswith("phone_")
                or is_phone_like_sender(user.name)
                or user.name == "Neighbour"
            ):
                user.name = display_name
        elif user.name and is_phone_like_sender(user.name):
            user.name = "Neighbour"
        # Existing password-less invited accounts still need setup.
        if not user.password_hash:
            user.profile_setup_required = True

    await ensure_pending_compound_membership(
        db, user.id, compound_id, source="CHAT_IMPORT"
    )
    return user


def listing_fallback_title(normalized: dict[str, Any]) -> str:
    content = (normalized.get("content") or "Imported listing").strip()
    return content.splitlines()[0][:120]


async def _resolve_author(
    db: AsyncSession,
    *,
    job: ChatImportJob,
    item: ChatImportItem,
    phone_to_user: dict[str, User],
) -> User:
    normalized = dict(item.normalized or {})
    phone = normalize_phone(normalized.get("phone")) if normalized.get("phone") else None
    if phone and phone in phone_to_user:
        author = phone_to_user[phone]
    else:
        author = await resolve_or_create_invited_user(
            db,
            compound_id=job.compound_id,
            phone=phone,
            name=normalized.get("name"),
        )
        if author.phone:
            phone_to_user[author.phone] = author
    item.matched_user_id = author.id
    return author


async def publish_chat_import_job(
    db: AsyncSession,
    job: ChatImportJob,
    *,
    actor_id: int | None,
) -> dict[str, Any]:
    job.status = ChatImportJobStatus.PUBLISHING
    await db.flush()

    result = await db.execute(
        select(ChatImportItem)
        .where(
            ChatImportItem.job_id == job.id,
            ChatImportItem.decision == ChatImportItemDecision.APPROVED,
        )
        .order_by(ChatImportItem.id)
    )
    items = list(result.scalars().all())

    stats = {
        "users_created_or_matched": 0,
        "posts_published": 0,
        "comments_published": 0,
        "listings_published": 0,
        "skipped_already_published": 0,
        "errors": 0,
    }
    phone_to_user: dict[str, User] = {}
    # message_index → published Post.id
    message_index_to_post_id: dict[int, int] = {}

    for item in items:
        if item.kind != ChatImportItemKind.USER:
            continue
        if item.published_entity_id:
            stats["skipped_already_published"] += 1
            continue
        normalized = item.normalized or {}
        user = await resolve_or_create_invited_user(
            db,
            compound_id=job.compound_id,
            phone=normalized.get("phone"),
            name=normalized.get("name"),
        )
        phone_key = user.phone or ""
        phone_to_user[phone_key] = user
        item.matched_user_id = user.id
        item.published_entity_type = "USER"
        item.published_entity_id = user.id
        stats["users_created_or_matched"] += 1

    # Pass 1: posts + listings (roots)
    for item in items:
        if item.kind not in (ChatImportItemKind.POST, ChatImportItemKind.LISTING):
            continue
        if item.published_entity_id:
            stats["skipped_already_published"] += 1
            continue
        normalized = dict(item.normalized or {})
        author = await _resolve_author(
            db, job=job, item=item, phone_to_user=phone_to_user
        )

        try:
            if item.kind == ChatImportItemKind.POST:
                content = redact_phones((normalized.get("content") or "").strip())
                if not content:
                    item.decision = ChatImportItemDecision.REJECTED
                    item.reject_reason = "Empty content"
                    continue
                provenance = f"\n\n— imported from group chat (job #{job.id})"
                created_at = _original_created_at(normalized)
                category_raw = str(normalized.get("post_category") or "GENERAL").upper()
                try:
                    post_category = PostCategory(category_raw)
                except ValueError:
                    post_category = PostCategory.GENERAL
                # Official ANNOUNCEMENT is reserved for compound mods
                if post_category == PostCategory.ANNOUNCEMENT:
                    post_category = PostCategory.DISCUSSION
                if post_category == PostCategory.MARKETPLACE:
                    post_category = PostCategory.GENERAL
                post_kwargs = dict(
                    compound_id=job.compound_id,
                    author_id=author.id,
                    content=content + provenance,
                    category=post_category,
                    is_urgent=post_category == PostCategory.ALERT,
                )
                if created_at is not None:
                    post_kwargs["created_at"] = created_at
                post = Post(**post_kwargs)
                db.add(post)
                await db.flush()
                item.published_entity_type = "POST"
                item.published_entity_id = post.id
                msg_index = normalized.get("message_index")
                if isinstance(msg_index, int):
                    message_index_to_post_id[msg_index] = post.id
                stats["posts_published"] += 1
            else:
                from app.services.chat_import_parser import ensure_listing_normalized

                normalized = ensure_listing_normalized(normalized)
                title = redact_phones(
                    (normalized.get("title") or listing_fallback_title(normalized)).strip()
                )
                description = redact_phones(
                    (
                        normalized.get("description") or normalized.get("content") or ""
                    ).strip()
                )
                intent_raw = (normalized.get("intent") or "SELL").upper()
                intent = ListingIntent.RENT if intent_raw == "RENT" else ListingIntent.SELL
                category_raw = (normalized.get("category") or "ITEM").upper()
                try:
                    category = ListingCategory(category_raw)
                except ValueError:
                    category = ListingCategory.ITEM
                # Chat import cannot create SERVICE marketplace rows without a provider profile
                if category == ListingCategory.SERVICE:
                    category = ListingCategory.ITEM
                price_val = normalized.get("price")
                price = None
                if price_val is not None and price_val != "":
                    try:
                        price = Decimal(str(price_val))
                    except Exception:
                        price = None
                created_at = _original_created_at(normalized)
                listing_kwargs = dict(
                    compound_id=job.compound_id,
                    owner_id=author.id,
                    category=category,
                    title=title[:200],
                    description=description or None,
                    price=price,
                    currency=normalized.get("currency") or "EGP",
                    intent=intent,
                    image_urls=[],
                    # Category attribute schemas are strict; leave null for imports
                    attributes=None,
                    status=ListingStatus.ACTIVE,
                )
                if created_at is not None:
                    listing_kwargs["created_at"] = created_at
                listing = Listing(**listing_kwargs)
                db.add(listing)
                await db.flush()
                item.published_entity_type = "LISTING"
                item.published_entity_id = listing.id
                stats["listings_published"] += 1
        except Exception as exc:  # noqa: BLE001
            stats["errors"] += 1
            item.reject_reason = str(exc)[:500]

    # Pass 2: comments under parent posts
    for item in items:
        if item.kind != ChatImportItemKind.COMMENT:
            continue
        if item.published_entity_id:
            stats["skipped_already_published"] += 1
            continue
        normalized = dict(item.normalized or {})
        author = await _resolve_author(
            db, job=job, item=item, phone_to_user=phone_to_user
        )
        content = redact_phones((normalized.get("content") or "").strip())
        if not content:
            item.decision = ChatImportItemDecision.REJECTED
            item.reject_reason = "Empty content"
            continue

        parent_index = normalized.get("parent_message_index")
        post_id = (
            message_index_to_post_id.get(parent_index)
            if isinstance(parent_index, int)
            else None
        )

        try:
            created_at = _original_created_at(normalized)
            if post_id is None:
                # Orphan comment → publish as its own post
                provenance = f"\n\n— imported from group chat (job #{job.id})"
                category_raw = str(normalized.get("post_category") or "GENERAL").upper()
                try:
                    post_category = PostCategory(category_raw)
                except ValueError:
                    post_category = PostCategory.GENERAL
                if post_category in (PostCategory.ANNOUNCEMENT, PostCategory.MARKETPLACE):
                    post_category = PostCategory.DISCUSSION
                post_kwargs = dict(
                    compound_id=job.compound_id,
                    author_id=author.id,
                    content=content + provenance,
                    category=post_category,
                    is_urgent=post_category == PostCategory.ALERT,
                )
                if created_at is not None:
                    post_kwargs["created_at"] = created_at
                post = Post(**post_kwargs)
                db.add(post)
                await db.flush()
                item.published_entity_type = "POST"
                item.published_entity_id = post.id
                item.kind = ChatImportItemKind.POST
                stats["posts_published"] += 1
                continue

            comment_kwargs = dict(
                post_id=post_id,
                author_id=author.id,
                content=content,
            )
            if created_at is not None:
                comment_kwargs["created_at"] = created_at
            comment = Comment(**comment_kwargs)
            db.add(comment)
            await db.flush()
            item.published_entity_type = "COMMENT"
            item.published_entity_id = comment.id
            stats["comments_published"] += 1
        except Exception as exc:  # noqa: BLE001
            stats["errors"] += 1
            item.reject_reason = str(exc)[:500]

    job.stats = {**(job.stats or {}), "publish": stats}
    job.status = ChatImportJobStatus.COMPLETED
    job.completed_at = datetime.now(timezone.utc)
    job.error_message = None

    db.add(
        AuditLog(
            actor_id=actor_id,
            event_type="chat_import.publish",
            entity_type="CHAT_IMPORT_JOB",
            entity_id=str(job.id),
            data={
                "compound_id": job.compound_id,
                "stats": stats,
            },
        )
    )
    await db.flush()
    return stats


async def replace_job_items_from_parse(
    db: AsyncSession,
    job: ChatImportJob,
    users: list[dict[str, Any]],
    items: list[dict[str, Any]],
    stats: dict[str, Any],
) -> None:
    await db.execute(delete(ChatImportItem).where(ChatImportItem.job_id == job.id))
    await db.flush()
    for payload in [*users, *items]:
        kind = ChatImportItemKind(payload["kind"])
        decision = ChatImportItemDecision(payload.get("decision") or "PENDING")
        db.add(
            ChatImportItem(
                job_id=job.id,
                kind=kind,
                decision=decision,
                raw_payload=payload.get("raw_payload") or {},
                normalized=payload.get("normalized") or {},
                reject_reason=payload.get("reject_reason"),
            )
        )
    job.stats = stats
    job.status = ChatImportJobStatus.PREVIEW
    job.error_message = None
    await db.flush()


async def get_job_with_items(db: AsyncSession, job_id: int) -> ChatImportJob | None:
    result = await db.execute(
        select(ChatImportJob)
        .options(selectinload(ChatImportJob.items))
        .where(ChatImportJob.id == job_id)
    )
    return result.scalar_one_or_none()


async def confirm_chat_import_membership(
    db: AsyncSession,
    user: User,
    compound_id: int,
) -> dict[str, Any]:
    result = await db.execute(
        select(UserCompoundMembership).where(
            UserCompoundMembership.user_id == user.id,
            UserCompoundMembership.compound_id == compound_id,
            UserCompoundMembership.verification_status == "PENDING",
            UserCompoundMembership.verification_source == "CHAT_IMPORT",
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise ValueError("No pending chat-import invite for this compound")

    membership.verification_status = "VERIFIED"
    membership.verification_source = "CHAT_IMPORT"
    if user.compound_id is None:
        user.compound_id = compound_id
    if user.status == UserStatus.PENDING_VERIFICATION:
        user.status = UserStatus.APPROVED
    if user.role is None:
        user.role = UserRole.USER
    await db.flush()
    return {
        "compound_id": compound_id,
        "verification_status": "VERIFIED",
        "user_status": user.status.value if hasattr(user.status, "value") else user.status,
    }
