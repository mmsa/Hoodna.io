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
    """Get feed posts, optionally filtered by compound."""
    query = select(Post).options(
        selectinload(Post.author),
        selectinload(Post.comments).selectinload(Comment.author)
    )
    
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
    """Get posts from compound management (admins/moderators or compound-specific moderator) in the specified compound."""
    from app.models.compound import Compound
    
    # Get the compound to check for compound-specific moderator
    compound = await db.get(Compound, compound_id)
    moderator_id = compound.moderator_id if compound else None
    
    # Build query: posts from global admins/moderators OR compound-specific moderator
    query = (
        select(Post)
        .join(User, Post.author_id == User.id)
        .options(
            selectinload(Post.author),
            selectinload(Post.comments).selectinload(Comment.author)
        )
        .where(Post.compound_id == compound_id)
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


async def delete_post(db: AsyncSession, post_id: int) -> bool:
    """Delete a post."""
    post = await db.get(Post, post_id)
    if not post:
        return False
    await db.delete(post)
    await db.flush()
    return True

