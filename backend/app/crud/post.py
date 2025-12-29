from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.post import Post, Comment
from app.models.user import User
from app.models.enums import UserRole
from app.schemas.community import PostCreate, CommentCreate


async def get_feed_posts(
    db: AsyncSession,
    compound_id: int | None = None,
    skip: int = 0,
    limit: int = 50
) -> list[Post]:
    """Get feed posts, optionally filtered by compound. Excludes soft-deleted posts."""
    query = select(Post).options(
        selectinload(Post.author),
        selectinload(Post.comments).selectinload(Comment.author)
    )
    
    # Try to filter by deleted_at, but handle case where column doesn't exist yet
    try:
        query = query.where(Post.deleted_at.is_(None))
    except Exception:
        # Column doesn't exist yet (migration not run), skip the filter
        pass
    
    if compound_id:
        query = query.where(Post.compound_id == compound_id)
    
    query = query.order_by(Post.created_at.desc()).offset(skip).limit(limit)
    
    # Execute query, retry without deleted_at filter if column doesn't exist
    try:
        result = await db.execute(query)
        return list(result.scalars().all())
    except Exception as e:
        # If error is about missing column, retry without deleted_at filter
        error_str = str(e).lower()
        if 'deleted_at' in error_str or 'column' in error_str or 'does not exist' in error_str:
            # Retry without deleted_at filter
            query = select(Post).options(
                selectinload(Post.author),
                selectinload(Post.comments).selectinload(Comment.author)
            )
            if compound_id:
                query = query.where(Post.compound_id == compound_id)
            query = query.order_by(Post.created_at.desc()).offset(skip).limit(limit)
            result = await db.execute(query)
            return list(result.scalars().all())
        raise


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
    where_conditions = [Post.compound_id == compound_id]
    
    # Try to filter by deleted_at, but handle case where column doesn't exist yet
    try:
        where_conditions.append(Post.deleted_at.is_(None))
    except Exception:
        pass
    
    query = (
        select(Post)
        .join(User, Post.author_id == User.id)
        .options(
            selectinload(Post.author),
            selectinload(Post.comments).selectinload(Comment.author)
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
    
    # Execute query, retry without deleted_at filter if column doesn't exist
    try:
        result = await db.execute(query)
        return list(result.scalars().all())
    except Exception as e:
        # If error is about missing column, retry without deleted_at filter
        error_str = str(e).lower()
        if 'deleted_at' in error_str or 'column' in error_str or 'does not exist' in error_str:
            # Retry without deleted_at filter
            where_conditions = [Post.compound_id == compound_id]
            query = (
                select(Post)
                .join(User, Post.author_id == User.id)
                .options(
                    selectinload(Post.author),
                    selectinload(Post.comments).selectinload(Comment.author)
                )
                .where(*where_conditions)
            )
            if moderator_id:
                from sqlalchemy import or_
                query = query.where(
                    or_(
                        User.role.in_([UserRole.ADMIN, UserRole.MODERATOR]),
                        User.id == moderator_id
                    )
                )
            else:
                query = query.where(User.role.in_([UserRole.ADMIN, UserRole.MODERATOR]))
            query = query.order_by(Post.created_at.desc()).offset(skip).limit(limit)
            result = await db.execute(query)
            return list(result.scalars().all())
        raise


async def create_post(
    db: AsyncSession,
    compound_id: int,
    author_id: int,
    post_data: PostCreate
) -> Post:
    """Create a new post."""
    db_post = Post(
        compound_id=compound_id,
        author_id=author_id,
        content=post_data.content,
    )
    db.add(db_post)
    await db.flush()
    await db.refresh(db_post)
    return db_post


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
    post = await db.get(Post, post_id)
    if not post:
        return None
    # Only check deleted_at if the column exists and we're not including deleted
    if not include_deleted and hasattr(post, 'deleted_at') and post.deleted_at is not None:
        return None
    return post


async def delete_post(db: AsyncSession, post_id: int) -> bool:
    """Soft delete a post (set deleted_at timestamp instead of actually deleting)."""
    from datetime import datetime
    post = await db.get(Post, post_id)
    if not post:
        return False
    # Only use soft delete if the column exists
    if hasattr(Post, 'deleted_at'):
        if post.deleted_at is not None:
            return True  # Already deleted
        post.deleted_at = datetime.utcnow()
    else:
        # Column doesn't exist yet - fall back to actual delete (temporary until migration)
        from sqlalchemy import delete as sql_delete
        await db.execute(sql_delete(Post).where(Post.id == post_id))
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

