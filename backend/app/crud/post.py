from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload, with_loader_criteria
from app.models.post import Post, Comment, PostReaction, PollVote
from app.models.user import User
from app.models.enums import UserRole
from app.schemas.community import PostCreate, CommentCreate, PollResult, PollOptionResult
from datetime import datetime, timezone


def build_poll_payload(poll_data) -> dict | None:
    if not poll_data:
        return None
    options = []
    next_id = 1
    for opt in poll_data.options:
        label = (opt.label or "").strip()
        if not label:
            continue
        option_id = opt.id if isinstance(opt.id, int) and opt.id > 0 else next_id
        next_id = max(next_id, option_id + 1)
        options.append({"id": int(option_id), "label": label[:200]})
    if len(options) < 2:
        raise ValueError("Polls need at least 2 options")
    # Normalize to sequential ids if duplicates
    seen = set()
    normalized = []
    seq = 1
    for opt in options[:4]:
        oid = int(opt["id"])
        if oid in seen:
            while seq in seen:
                seq += 1
            oid = seq
        seen.add(oid)
        normalized.append({"id": oid, "label": opt["label"]})
        seq = max(seq, oid + 1)
    return {
        "question": (poll_data.question or "").strip()[:500] or None,
        "options": normalized,
    }


def serialize_poll(post: Post, user_id: int | None = None) -> PollResult | None:
    raw = post.poll
    if not raw or not isinstance(raw, dict):
        return None
    options_raw = raw.get("options") or []
    counts: dict[int, int] = {}
    user_vote = None
    for vote in getattr(post, "poll_votes", []) or []:
        try:
            oid = int(vote.option_id)
        except (TypeError, ValueError):
            continue
        counts[oid] = counts.get(oid, 0) + 1
        if user_id is not None and vote.user_id == user_id:
            user_vote = oid
    options = []
    for opt in options_raw:
        try:
            oid = int(opt.get("id"))
        except (TypeError, ValueError):
            continue
        label = str(opt.get("label") or "").strip()
        if not label:
            continue
        options.append(PollOptionResult(id=oid, label=label, votes=counts.get(oid, 0)))
    if len(options) < 2:
        return None
    return PollResult(
        question=raw.get("question") or "",
        options=options,
        total_votes=sum(o.votes for o in options),
        user_vote=user_vote,
    )


async def get_feed_posts(
    db: AsyncSession,
    compound_id: int | None = None,
    skip: int = 0,
    limit: int = 50
) -> list[Post]:
    """Get feed posts, optionally filtered by compound. Excludes soft-deleted posts."""
    query = select(Post).options(
        selectinload(Post.author),
        selectinload(Post.compound),  # Load compound for compound_name
        selectinload(Post.comments).selectinload(Comment.author),
        selectinload(Post.reactions),
        selectinload(Post.poll_votes),
        with_loader_criteria(Comment, Comment.deleted_at.is_(None)),
    ).where(Post.deleted_at.is_(None))
    
    if compound_id:
        query = query.where(Post.compound_id == compound_id)
    
    query = query.order_by(Post.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    return list(result.scalars().all())


async def get_compound_announcements(
    db: AsyncSession,
    compound_id: int,
    skip: int = 0,
    limit: int = 50
) -> list[Post]:
    """Get posts from compound management (admins/moderators or compound-specific moderator) in the specified compound. Excludes soft-deleted posts."""
    from app.models.compound import Compound
    
    # Get the compound to check for compound-specific moderator
    compound = await db.get(Compound, compound_id)
    moderator_id = compound.moderator_id if compound else None
    
    # Build query: posts from global admins/moderators OR compound-specific moderator
    where_conditions = [
        Post.compound_id == compound_id,
        Post.deleted_at.is_(None),
    ]
    
    query = (
        select(Post)
        .join(User, Post.author_id == User.id)
        .options(
            selectinload(Post.author),
            selectinload(Post.compound),  # Load compound for compound_name
            selectinload(Post.comments).selectinload(Comment.author),
            selectinload(Post.reactions),
            with_loader_criteria(Comment, Comment.deleted_at.is_(None)),
        )
        .where(*where_conditions)
    )
    
    # Filter: global admins/moderators OR compound-specific moderator
    if moderator_id:
        from sqlalchemy import or_
        query = query.where(
            or_(
                User.role.in_([UserRole.ADMIN, UserRole.MODERATOR]),
                User.id == moderator_id
            )
        )
    else:
        # If no compound moderator assigned, only show global admins/moderators
        query = query.where(User.role.in_([UserRole.ADMIN, UserRole.MODERATOR]))
    
    query = query.order_by(Post.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    return list(result.scalars().all())


async def toggle_post_reaction(
    db: AsyncSession,
    post_id: int,
    user_id: int,
    reaction: str,
    compound_id: int,
) -> Post:
    post = await db.scalar(
        select(Post)
        .options(selectinload(Post.reactions))
        .where(
            Post.id == post_id,
            Post.compound_id == compound_id,
            Post.deleted_at.is_(None),
        )
    )
    if not post:
        raise ValueError("Post not found")

    existing = next((item for item in post.reactions if item.user_id == user_id), None)
    if existing and existing.reaction == reaction:
        await db.delete(existing)
    elif existing:
        existing.reaction = reaction
    else:
        db.add(PostReaction(post_id=post_id, user_id=user_id, reaction=reaction))

    await db.commit()
    return await db.scalar(
        select(Post)
        .options(selectinload(Post.reactions))
        .where(
            Post.id == post_id,
            Post.compound_id == compound_id,
            Post.deleted_at.is_(None),
        )
    )


async def create_post(
    db: AsyncSession,
    compound_id: int,
    author_id: int,
    post_data: PostCreate
) -> Post:
    """Create a new post."""
    from app.models.enums import PostCategory

    poll_payload = build_poll_payload(post_data.poll)
    category = post_data.category or PostCategory.GENERAL
    if poll_payload:
        category = PostCategory.POLL

    db_post = Post(
        compound_id=compound_id,
        author_id=author_id,
        content=post_data.content,
        category=category,
        is_urgent=post_data.is_urgent or False,
        poll=poll_payload,
    )
    db.add(db_post)
    await db.flush()
    await db.refresh(db_post)
    return db_post


async def vote_on_poll(
    db: AsyncSession,
    *,
    post_id: int,
    user_id: int,
    compound_id: int,
    option_id: str,
) -> Post:
    post = await db.scalar(
        select(Post)
        .options(selectinload(Post.poll_votes), selectinload(Post.author), selectinload(Post.compound))
        .where(
            Post.id == post_id,
            Post.compound_id == compound_id,
            Post.deleted_at.is_(None),
        )
    )
    if not post or not post.poll:
        raise ValueError("Poll not found")
    option_ids = {int(opt.get("id")) for opt in (post.poll.get("options") or []) if opt.get("id") is not None}
    if option_id not in option_ids:
        raise ValueError("Invalid poll option")

    option_key = str(option_id)
    existing = next((v for v in post.poll_votes if v.user_id == user_id), None)
    if existing:
        existing.option_id = option_key
    else:
        db.add(PollVote(post_id=post_id, user_id=user_id, option_id=option_key))
    await db.commit()
    return await db.scalar(
        select(Post)
        .options(
            selectinload(Post.poll_votes),
            selectinload(Post.author),
            selectinload(Post.compound),
            selectinload(Post.comments).selectinload(Comment.author),
            selectinload(Post.reactions),
        )
        .where(Post.id == post_id)
    )


async def create_comment(
    db: AsyncSession,
    post_id: int,
    author_id: int,
    comment_data: CommentCreate
) -> Comment:
    """Create a new comment."""
    db_comment = Comment(
        post_id=post_id,
        author_id=author_id,
        content=comment_data.content,
    )
    db.add(db_comment)
    await db.flush()
    await db.refresh(db_comment)
    return db_comment


async def get_post_by_id(db: AsyncSession, post_id: int, include_deleted: bool = False) -> Post | None:
    """Get a post by ID. By default excludes soft-deleted posts."""
    query = select(Post).where(Post.id == post_id)
    if not include_deleted:
        query = query.where(Post.deleted_at.is_(None))
    return await db.scalar(query)


async def delete_post(db: AsyncSession, post_id: int) -> bool:
    """Soft delete a post (set deleted_at timestamp instead of actually deleting)."""
    post = await db.get(Post, post_id)
    if not post:
        return False
    if post.deleted_at is not None:
        return True
    post.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    return True


async def restore_post(db: AsyncSession, post_id: int) -> bool:
    """Restore a soft-deleted post."""
    post = await db.get(Post, post_id)
    if not post or post.deleted_at is None:
        return False
    post.deleted_at = None
    await db.flush()
    return True

