from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.community import PostResponse, CommentResponse
from app.crud.saved_post import (
    save_post,
    unsave_post,
    is_post_saved,
    get_saved_posts,
)
from app.crud.post import get_post_by_id
from app.core.dependencies import get_current_approved_user
from app.models.user import User
from typing import List

router = APIRouter()


@router.post("/posts/{post_id}/save")
async def save_post_endpoint(
    post_id: int,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Save a post to user's saved list."""
    # Verify post exists
    post = await get_post_by_id(db, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    saved = await save_post(db, current_user.id, post_id)
    await db.commit()
    
    return {"message": "Post saved successfully", "saved": True}


@router.delete("/posts/{post_id}/save")
async def unsave_post_endpoint(
    post_id: int,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Unsave a post from user's saved list."""
    unsaved = await unsave_post(db, current_user.id, post_id)
    if not unsaved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found in saved list"
        )
    
    await db.commit()
    return {"message": "Post unsaved successfully", "saved": False}


@router.get("/posts/{post_id}/saved")
async def check_post_saved(
    post_id: int,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Check if a post is saved by the current user."""
    is_saved = await is_post_saved(db, current_user.id, post_id)
    return {"saved": is_saved}


@router.get("/saved-posts", response_model=List[PostResponse])
async def get_saved_posts_endpoint(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all posts saved by the current user."""
    posts = await get_saved_posts(db, current_user.id, skip=skip, limit=limit)
    
    # Convert to response format
    result = []
    for post in posts:
        compound_name = post.compound.name if post.compound else None
        result.append(PostResponse(
            id=post.id,
            compound_id=post.compound_id,
            compound_name=compound_name,
            author_id=post.author_id,
            author_name=post.author.name,
            author_avatar_url=post.author.avatar_url,
            author_status=post.author.status.value if post.author.status else None,
            content=post.content,
            category=post.category.value if post.category else None,
            is_urgent=post.is_urgent if post.is_urgent else False,
            created_at=post.created_at,
            comments=[
                CommentResponse(
                    id=c.id,
                    post_id=c.post_id,
                    author_id=c.author_id,
                    author_name=c.author.name,
                    author_avatar_url=c.author.avatar_url,
                    author_status=c.author.status.value if c.author.status else None,
                    content=c.content,
                    created_at=c.created_at,
                )
                for c in post.comments
            ]
        ))
    
    return result

