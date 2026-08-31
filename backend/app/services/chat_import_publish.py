"""Publish approved chat-import items into users, posts, comments, and listings."""
from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.crud.user import (
    create_chat_import_user,
    create_user_by_phone,
    find_chat_import_user_by_name,
    get_user_by_phone,
)
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
    ensure_listing_normalized,
    is_phone_like_sender,
    is_placeholder_import_phone,
    is_stale_listing_timestamp,
    normalize_phone,
    parse_import_timestamp,
    redact_phones,
    stable_chat_import_email,
)


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
    job: ChatImportJob | None = None,
) -> User:
    from app.services.user_creation import apply_creation_provenance

    display_name = _safe_public_name(name, phone)
    normalized = normalize_phone(phone) if phone else None
    # Never treat our old fake 900… placeholders as real numbers.
    if normalized and is_placeholder_import_phone(normalized):
        normalized = None

    import_details: dict = {}
    job_id = None
    if job is not None:
        job_id = job.id
        import_details = {
            "original_filename": job.original_filename,
            "chat_source": getattr(job.source, "value", job.source),
            "uploaded_by_id": job.uploaded_by_id,
            "compound_id": job.compound_id,
            "note": (
                "Imported from group chat"
                if normalized
                else "Imported from group chat (no phone in export)"
            ),
            "phone_in_export": bool(normalized),
        }

    user: User | None = None
    if normalized:
        user = await get_user_by_phone(db, normalized)
        if not user:
            user = await create_user_by_phone(
                db,
                normalized,
                display_name,
                creation_source="CHAT_IMPORT",
                creation_details=import_details or {"note": "Imported from group chat"},
                creation_job_id=job_id,
            )
            user.profile_setup_required = True
        else:
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
            if not user.password_hash:
                user.profile_setup_required = True
            apply_creation_provenance(
                user,
                source="CHAT_IMPORT",
                details=import_details or None,
                job_id=job_id,
                overwrite=False,
            )
    else:
        # WhatsApp hid the number (contact name only). Do not invent a dialable phone.
        email = stable_chat_import_email(compound_id, display_name)
        user = await find_chat_import_user_by_name(
            db, name=display_name, email=email
        )
        if not user:
            user = await create_chat_import_user(
                db,
                name=display_name,
                email=email,
                creation_details=import_details
                or {"note": "Imported from group chat (no phone in export)"},
                creation_job_id=job_id,
            )
            user.profile_setup_required = True
        else:
            if user.phone and is_placeholder_import_phone(user.phone):
                user.phone = None
            if user.email and str(user.email).startswith("phone_900"):
                user.email = email
            if not user.password_hash:
                user.profile_setup_required = True
            apply_creation_provenance(
                user,
                source="CHAT_IMPORT",
                details=import_details or None,
                job_id=job_id,
                overwrite=False,
            )

    await ensure_pending_compound_membership(
        db, user.id, compound_id, source="CHAT_IMPORT"
    )
    return user


def _item_identity(
    compound_id: int, normalized: dict[str, Any]
) -> tuple[str | None, str | None, str]:
    phone = normalize_phone(normalized.get("phone")) if normalized.get("phone") else None
    if phone and is_placeholder_import_phone(phone):
        phone = None
    display = _safe_public_name(normalized.get("name"), phone)
    email = None if phone else stable_chat_import_email(compound_id, display)
    return phone, email, display


async def _bulk_ensure_pending_memberships(
    db: AsyncSession, user_ids: set[int], compound_id: int
) -> None:
    if not user_ids or not compound_id:
        return
    existing = set(
        (
            await db.execute(
                select(UserCompoundMembership.user_id).where(
                    UserCompoundMembership.compound_id == compound_id,
                    UserCompoundMembership.user_id.in_(user_ids),
                )
            )
        ).scalars().all()
    )
    db.add_all(
        [
            UserCompoundMembership(
                user_id=user_id,
                compound_id=compound_id,
                verification_status="PENDING",
                verification_source="CHAT_IMPORT",
            )
            for user_id in user_ids
            if user_id not in existing
        ]
    )
    await db.flush()


async def _bulk_resolve_users_for_job(
    db: AsyncSession,
    job: ChatImportJob,
    items: list[ChatImportItem],
) -> dict[int, User]:
    """Match or create authors for every item in one load + one insert flush."""
    from app.services.user_creation import apply_creation_provenance
    from app.utils.phone import phone_lookup_candidates

    import_details = {
        "original_filename": job.original_filename,
        "chat_source": getattr(job.source, "value", job.source),
        "uploaded_by_id": job.uploaded_by_id,
        "compound_id": job.compound_id,
        "note": "Imported from group chat",
        "phone_in_export": True,
    }

    identities: dict[int, tuple[str | None, str | None, str]] = {}
    phones: set[str] = set()
    emails: set[str] = set()
    for item in items:
        phone, email, display = _item_identity(job.compound_id, dict(item.normalized or {}))
        identities[item.id] = (phone, email, display)
        if phone:
            phones.add(phone)
        elif email:
            emails.add(email)

    lookup_phones: set[str] = set()
    for phone in phones:
        lookup_phones.update(phone_lookup_candidates(phone) or [phone])

    phone_to_user: dict[str, User] = {}
    if lookup_phones:
        rows = (
            await db.execute(select(User).where(User.phone.in_(lookup_phones)))
        ).scalars().all()
        for user in rows:
            if user.phone:
                phone_to_user[user.phone] = user
                for candidate in phone_lookup_candidates(user.phone):
                    phone_to_user[candidate] = user

    email_to_user: dict[str, User] = {}
    if emails:
        rows = (
            await db.execute(select(User).where(User.email.in_(emails)))
        ).scalars().all()
        for user in rows:
            email_to_user[user.email] = user

    new_users: list[User] = []
    created_phones: set[str] = set()
    created_emails: set[str] = set()
    for phone, email, display in identities.values():
        if phone:
            if phone in phone_to_user or phone in created_phones:
                continue
            created_phones.add(phone)
            user = User(
                name=display,
                email=f"phone_{phone}@hoodna.local",
                phone=phone,
                password_hash="",
                status=UserStatus.PENDING_VERIFICATION,
                phone_verified=True,
                email_verified=True,
                profile_setup_required=True,
                creation_source="CHAT_IMPORT",
                creation_details={**import_details, "phone_in_export": True},
                creation_job_id=job.id,
            )
            new_users.append(user)
            phone_to_user[phone] = user
        elif email:
            if email in email_to_user or email in created_emails:
                continue
            created_emails.add(email)
            user = User(
                name=display,
                email=email,
                phone=None,
                password_hash="",
                status=UserStatus.PENDING_VERIFICATION,
                phone_verified=True,
                email_verified=True,
                profile_setup_required=True,
                creation_source="CHAT_IMPORT",
                creation_details={
                    **import_details,
                    "note": "Imported from group chat (no phone in export)",
                    "phone_in_export": False,
                },
                creation_job_id=job.id,
            )
            new_users.append(user)
            email_to_user[email] = user

    if new_users:
        db.add_all(new_users)
        await db.flush()
        for user in new_users:
            if user.phone:
                for candidate in phone_lookup_candidates(user.phone) or [user.phone]:
                    phone_to_user[candidate] = user

    seen_existing: set[int] = set()
    for user in [*phone_to_user.values(), *email_to_user.values()]:
        if user.id in seen_existing or user in new_users:
            continue
        seen_existing.add(user.id)
        display = user.name
        apply_creation_provenance(
            user,
            source="CHAT_IMPORT",
            details=import_details,
            job_id=job.id,
            overwrite=False,
        )
        if not user.password_hash:
            user.profile_setup_required = True

    item_to_user: dict[int, User] = {}
    all_user_ids: set[int] = set()
    for item in items:
        phone, email, display = identities[item.id]
        if phone:
            user = phone_to_user.get(phone)
        else:
            user = email_to_user.get(email) if email else None
        if not user:
            continue
        if display and display != "Neighbour":
            if (
                not user.name
                or user.name.startswith("phone_")
                or is_phone_like_sender(user.name)
                or user.name == "Neighbour"
            ):
                user.name = display
        elif user.name and is_phone_like_sender(user.name):
            user.name = "Neighbour"
        if user.phone and is_placeholder_import_phone(user.phone):
            user.phone = None
        item_to_user[item.id] = user
        if user.id:
            all_user_ids.add(user.id)

    await _bulk_ensure_pending_memberships(db, all_user_ids, job.compound_id)
    return item_to_user


def listing_fallback_title(normalized: dict[str, Any]) -> str:
    content = (normalized.get("content") or "Imported listing").strip()
    return content.splitlines()[0][:120]


def _post_from_normalized(
    *,
    compound_id: int,
    author_id: int,
    content: str,
    normalized: dict[str, Any],
) -> Post:
    category_raw = str(normalized.get("post_category") or "GENERAL").upper()
    try:
        post_category = PostCategory(category_raw)
    except ValueError:
        post_category = PostCategory.GENERAL
    if post_category == PostCategory.ANNOUNCEMENT:
        post_category = PostCategory.DISCUSSION
    if post_category == PostCategory.MARKETPLACE:
        post_category = PostCategory.GENERAL
    post_kwargs: dict[str, Any] = dict(
        compound_id=compound_id,
        author_id=author_id,
        content=content,
        category=post_category,
        is_urgent=post_category == PostCategory.ALERT,
    )
    created_at = _original_created_at(normalized)
    if created_at is not None:
        post_kwargs["created_at"] = created_at
    return Post(**post_kwargs)


def _listing_from_normalized(
    *,
    compound_id: int,
    owner_id: int,
    normalized: dict[str, Any],
) -> Listing | None:
    normalized = ensure_listing_normalized(normalized)
    if is_stale_listing_timestamp(
        normalized.get("created_at") or normalized.get("timestamp")
    ):
        return None
    title = redact_phones(
        (normalized.get("title") or listing_fallback_title(normalized)).strip()
    )
    description = redact_phones(
        (normalized.get("description") or normalized.get("content") or "").strip()
    )
    intent_raw = (normalized.get("intent") or "SELL").upper()
    intent = ListingIntent.RENT if intent_raw == "RENT" else ListingIntent.SELL
    category_raw = (normalized.get("category") or "ITEM").upper()
    try:
        category = ListingCategory(category_raw)
    except ValueError:
        category = ListingCategory.ITEM
    if category == ListingCategory.SERVICE:
        category = ListingCategory.ITEM
    price_val = normalized.get("price")
    price = None
    if price_val is not None and price_val != "":
        try:
            price = Decimal(str(price_val))
        except Exception:
            price = None
    listing_kwargs: dict[str, Any] = dict(
        compound_id=compound_id,
        owner_id=owner_id,
        category=category,
        title=title[:200],
        description=description or None,
        price=price,
        currency=normalized.get("currency") or "EGP",
        intent=intent,
        image_urls=[],
        attributes=None,
        status=ListingStatus.ACTIVE,
    )
    created_at = _original_created_at(normalized)
    if created_at is not None:
        listing_kwargs["created_at"] = created_at
    return Listing(**listing_kwargs)


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
        "listings_skipped_stale": 0,
        "skipped_already_published": 0,
        "errors": 0,
    }
    item_to_user = await _bulk_resolve_users_for_job(db, job, items)
    # message_index → published Post.id
    message_index_to_post_id: dict[int, int] = {}

    for item in items:
        author = item_to_user.get(item.id)
        if author:
            item.matched_user_id = author.id
        if item.kind == ChatImportItemKind.USER:
            if item.published_entity_id:
                stats["skipped_already_published"] += 1
                continue
            if not author:
                stats["errors"] += 1
                item.reject_reason = "Could not resolve user"
                continue
            item.published_entity_type = "USER"
            item.published_entity_id = author.id
        elif item.kind == ChatImportItemKind.POST and item.published_entity_id:
            msg_index = (item.normalized or {}).get("message_index")
            if isinstance(msg_index, int):
                message_index_to_post_id[msg_index] = item.published_entity_id

    pending_posts: list[tuple[ChatImportItem, Post, int | None]] = []
    pending_listings: list[tuple[ChatImportItem, Listing]] = []
    for item in items:
        if item.kind not in (ChatImportItemKind.POST, ChatImportItemKind.LISTING):
            continue
        if item.published_entity_id:
            stats["skipped_already_published"] += 1
            continue
        author = item_to_user.get(item.id)
        if not author:
            stats["errors"] += 1
            item.reject_reason = "Could not resolve author"
            continue
        normalized = dict(item.normalized or {})
        try:
            if item.kind == ChatImportItemKind.POST:
                content = redact_phones((normalized.get("content") or "").strip())
                if not content:
                    item.decision = ChatImportItemDecision.REJECTED
                    item.reject_reason = "Empty content"
                    continue
                post = _post_from_normalized(
                    compound_id=job.compound_id,
                    author_id=author.id,
                    content=content,
                    normalized=normalized,
                )
                msg_index = normalized.get("message_index")
                pending_posts.append(
                    (item, post, msg_index if isinstance(msg_index, int) else None)
                )
            else:
                listing = _listing_from_normalized(
                    compound_id=job.compound_id,
                    owner_id=author.id,
                    normalized=normalized,
                )
                if listing is None:
                    item.decision = ChatImportItemDecision.REJECTED
                    item.reject_reason = "Listing older than 6 months"
                    stats["listings_skipped_stale"] += 1
                    continue
                pending_listings.append((item, listing))
        except Exception as exc:  # noqa: BLE001
            stats["errors"] += 1
            item.reject_reason = str(exc)[:500]

    if pending_posts:
        db.add_all(post for _, post, _ in pending_posts)
        await db.flush()
        for item, post, msg_index in pending_posts:
            item.published_entity_type = "POST"
            item.published_entity_id = post.id
            if msg_index is not None:
                message_index_to_post_id[msg_index] = post.id
            stats["posts_published"] += 1

    if pending_listings:
        db.add_all(listing for _, listing in pending_listings)
        await db.flush()
        for item, listing in pending_listings:
            item.published_entity_type = "LISTING"
            item.published_entity_id = listing.id
            stats["listings_published"] += 1

    orphan_posts: list[tuple[ChatImportItem, Post]] = []
    pending_comments: list[tuple[ChatImportItem, Comment]] = []
    for item in items:
        if item.kind != ChatImportItemKind.COMMENT:
            continue
        if item.published_entity_id:
            stats["skipped_already_published"] += 1
            continue
        author = item_to_user.get(item.id)
        if not author:
            stats["errors"] += 1
            item.reject_reason = "Could not resolve author"
            continue
        normalized = dict(item.normalized or {})
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
                post = _post_from_normalized(
                    compound_id=job.compound_id,
                    author_id=author.id,
                    content=content,
                    normalized=normalized,
                )
                orphan_posts.append((item, post))
                continue
            comment_kwargs: dict[str, Any] = dict(
                post_id=post_id,
                author_id=author.id,
                content=content,
            )
            if created_at is not None:
                comment_kwargs["created_at"] = created_at
            pending_comments.append((item, Comment(**comment_kwargs)))
        except Exception as exc:  # noqa: BLE001
            stats["errors"] += 1
            item.reject_reason = str(exc)[:500]

    if orphan_posts:
        db.add_all(post for _, post in orphan_posts)
        await db.flush()
        for item, post in orphan_posts:
            item.published_entity_type = "POST"
            item.published_entity_id = post.id
            item.kind = ChatImportItemKind.POST
            stats["posts_published"] += 1

    if pending_comments:
        db.add_all(comment for _, comment in pending_comments)
        await db.flush()
        for item, comment in pending_comments:
            item.published_entity_type = "COMMENT"
            item.published_entity_id = comment.id
            stats["comments_published"] += 1

    stats["users_created_or_matched"] = len({u.id for u in item_to_user.values() if u.id})
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
    rows = [
        ChatImportItem(
            job_id=job.id,
            kind=ChatImportItemKind(payload["kind"]),
            decision=ChatImportItemDecision(payload.get("decision") or "PENDING"),
            raw_payload=payload.get("raw_payload") or {},
            normalized=payload.get("normalized") or {},
            reject_reason=payload.get("reject_reason"),
        )
        for payload in [*users, *items]
    ]
    if rows:
        db.add_all(rows)
    job.stats = stats
    job.status = ChatImportJobStatus.PREVIEW
    job.error_message = None
    await db.flush()


async def get_job(db: AsyncSession, job_id: int) -> ChatImportJob | None:
    """Load job metadata only — never pull 10k+ items into RAM."""
    result = await db.execute(select(ChatImportJob).where(ChatImportJob.id == job_id))
    return result.scalar_one_or_none()


async def get_job_with_items(db: AsyncSession, job_id: int) -> ChatImportJob | None:
    """Prefer get_job() + paginated items for API responses.

    Kept for small jobs / tests. Avoid on large Telegram imports.
    """
    result = await db.execute(
        select(ChatImportJob)
        .options(selectinload(ChatImportJob.items))
        .where(ChatImportJob.id == job_id)
    )
    return result.scalar_one_or_none()


async def count_job_items(
    db: AsyncSession,
    job_id: int,
    *,
    kind: ChatImportItemKind | None = None,
    decision: ChatImportItemDecision | None = None,
) -> int:
    from sqlalchemy import func

    query = select(func.count()).select_from(ChatImportItem).where(
        ChatImportItem.job_id == job_id
    )
    if kind is not None:
        query = query.where(ChatImportItem.kind == kind)
    if decision is not None:
        query = query.where(ChatImportItem.decision == decision)
    result = await db.execute(query)
    return int(result.scalar_one() or 0)


async def list_job_items(
    db: AsyncSession,
    job_id: int,
    *,
    skip: int = 0,
    limit: int = 50,
    kind: ChatImportItemKind | None = None,
    decision: ChatImportItemDecision | None = None,
) -> list[ChatImportItem]:
    """Paginated items without loading an entire 40k import into memory."""
    limit = max(1, min(limit, 100))
    skip = max(0, skip)
    query = select(ChatImportItem).where(ChatImportItem.job_id == job_id)
    if kind is not None:
        query = query.where(ChatImportItem.kind == kind)
    if decision is not None:
        query = query.where(ChatImportItem.decision == decision)
    query = query.order_by(ChatImportItem.id).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


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


async def confirm_all_pending_chat_import_memberships(
    db: AsyncSession,
    user: User,
) -> list[int]:
    """Grant verified access for every pending chat-import invite on this account."""
    result = await db.execute(
        select(UserCompoundMembership.compound_id).where(
            UserCompoundMembership.user_id == user.id,
            UserCompoundMembership.verification_status == "PENDING",
            UserCompoundMembership.verification_source == "CHAT_IMPORT",
        )
    )
    invite_compound_ids = list(result.scalars().all())
    confirmed: list[int] = []
    for compound_id in invite_compound_ids:
        try:
            await confirm_chat_import_membership(db, user, compound_id)
            confirmed.append(compound_id)
        except ValueError:
            continue
    if confirmed and user.status == UserStatus.PENDING_VERIFICATION:
        user.status = UserStatus.APPROVED
    if confirmed and user.role is None:
        user.role = UserRole.USER
    await db.flush()
    return confirmed
