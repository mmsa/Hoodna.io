from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from app.models.saved_post import SavedPost
from app.models.post import Post
from typing import List


async def save_post(
    db: AsyncSession, user_id: int, post_id: int
) -> SavedPost:
    """Save a post for a user. Returns existing saved post if already saved."""
    # Check if already saved
    result = await db.execute(
        select(SavedPost).where(
            and_(
                SavedPost.user_id == user_id,
                SavedPost.post_id == post_id
            )
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        return existing
    
    # Create new saved post
    saved = SavedPost(
        user_id=user_id,
        post_id=post_id
    )
    db.add(saved)
    await db.flush()
    await db.refresh(saved)
    return saved


async def unsave_post(
    db: AsyncSession, user_id: int, post_id: int
) -> bool:
    """Unsave a post for a user. Returns True if deleted, False if not found."""
    result = await db.execute(
        select(SavedPost).where(
            and_(
                SavedPost.user_id == user_id,
                SavedPost.post_id == post_id
            )
        )
    )
    saved = result.scalar_one_or_none()
    
    if saved:
        await db.delete(saved)
        await db.flush()
        return True
    return False


async def is_post_saved(
    db: AsyncSession, user_id: int, post_id: int
) -> bool:
    """Check if a post is saved by a user."""
    result = await db.execute(
        select(SavedPost).where(
            and_(
                SavedPost.user_id == user_id,
                SavedPost.post_id == post_id
            )
        )
    )
    return result.scalar_one_or_none() is not None


async def get_saved_posts(
    db: AsyncSession, user_id: int, skip: int = 0, limit: int = 50
) -> List[Post]:
    """Get all posts saved by a user."""
    query = (
        select(Post)
        .join(SavedPost, Post.id == SavedPost.post_id)
        .options(
            selectinload(Post.author),
            selectinload(Post.compound),
            selectinload(Post.comments).selectinload("author")
        )
        .where(SavedPost.user_id == user_id)
        .order_by(SavedPost.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    
    result = await db.execute(query)
    return list(result.scalars().all())

