from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.community import PostCreate, PostResponse, CommentCreate, CommentResponse
from app.crud.post import get_feed_posts, create_post, create_comment, get_compound_announcements
from app.crud.listing import get_listings
from app.crud.compound import get_compound_by_id
from app.core.dependencies import get_current_approved_user, get_current_verified_user
from app.models.user import User
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter()


class FeedSummaryResponse(BaseModel):
    compound_name: Optional[str] = None
    compound_area: Optional[str] = None
    compound_developer: Optional[str] = None
    compound_status: Optional[str] = None
    recent_listings_count: int = 0
    recent_posts_count: int = 0
    total_neighbors: int = 0


@router.get("/feed/summary", response_model=FeedSummaryResponse)
async def get_feed_summary(
    current_user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Get feed summary with compound info and stats."""
    if current_user.compound_id is None:
        return FeedSummaryResponse()
    
    compound = await get_compound_by_id(db, current_user.compound_id)
    if not compound:
        return FeedSummaryResponse()
    
    # Get recent listings count
    recent_listings = await get_listings(
        db=db,
        compound_id=current_user.compound_id,
        scope="compound",
        skip=0,
        limit=10
    )
    
    # Get recent posts count
    recent_posts = await get_feed_posts(
        db=db,
        compound_id=current_user.compound_id,
        skip=0,
        limit=10
    )
    
    # Get total neighbors count (users in same compound)
    from sqlalchemy import select, func
    from app.models.user import User as UserModel
    neighbors_result = await db.execute(
        select(func.count(UserModel.id)).where(
            UserModel.compound_id == current_user.compound_id,
            UserModel.status == "APPROVED"
        )
    )
    total_neighbors = neighbors_result.scalar_one() or 0
    
    return FeedSummaryResponse(
        compound_name=compound.name,
        compound_area=compound.area,
        compound_developer=compound.developer,
        compound_status=compound.status_2025,
        recent_listings_count=len(recent_listings),
        recent_posts_count=len(recent_posts),
        total_neighbors=total_neighbors,
    )


@router.get("/feed", response_model=List[PostResponse])
async def get_feed(
    compound_id: int = None,
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Get feed posts. If compound_id not provided, uses user's compound. Requires verified user."""
    if compound_id is None:
        compound_id = current_user.compound_id
    
    # This check should never fail due to get_current_verified_user, but keep for safety
    if compound_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must select a compound first"
        )
    
    posts = await get_feed_posts(db, compound_id=compound_id, skip=skip, limit=limit)
    
    # Convert to response format
    result = []
    for post in posts:
        result.append(PostResponse(
            id=post.id,
            compound_id=post.compound_id,
            author_id=post.author_id,
            author_name=post.author.name,
            content=post.content,
            created_at=post.created_at,
            comments=[
                CommentResponse(
                    id=c.id,
                    post_id=c.post_id,
                    author_id=c.author_id,
                    author_name=c.author.name,
                    content=c.content,
                    created_at=c.created_at,
                )
                for c in post.comments
            ]
        ))
    
    return result


@router.post("/posts", response_model=PostResponse, status_code=status.HTTP_201_CREATED)
async def create_post_endpoint(
    post_data: PostCreate,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new post."""
    if current_user.compound_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be assigned to a compound"
        )
    
    post = await create_post(
        db=db,
        compound_id=current_user.compound_id,
        author_id=current_user.id,
        post_data=post_data,
    )
    
    return PostResponse(
        id=post.id,
        compound_id=post.compound_id,
        author_id=post.author_id,
        author_name=current_user.name,
        content=post.content,
        created_at=post.created_at,
        comments=[],
    )


@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment_endpoint(
    post_id: int,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a comment on a post."""
    comment = await create_comment(
        db=db,
        post_id=post_id,
        author_id=current_user.id,
        comment_data=comment_data,
    )
    
    return CommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        author_id=comment.author_id,
        author_name=current_user.name,
        content=comment.content,
        created_at=comment.created_at,
    )


@router.get("/feed/announcements", response_model=List[PostResponse])
async def get_announcements(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Get compound announcements (posts from admins/moderators)."""
    if current_user.compound_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must select a compound first"
        )
    
    posts = await get_compound_announcements(
        db=db,
        compound_id=current_user.compound_id,
        skip=skip,
        limit=limit
    )
    
    # Convert to response format
    result = []
    for post in posts:
        result.append(PostResponse(
            id=post.id,
            compound_id=post.compound_id,
            author_id=post.author_id,
            author_name=post.author.name,
            content=post.content,
            created_at=post.created_at,
            comments=[
                CommentResponse(
                    id=c.id,
                    post_id=c.post_id,
                    author_id=c.author_id,
                    author_name=c.author.name,
                    content=c.content,
                    created_at=c.created_at,
                )
                for c in post.comments
            ]
        ))
    
    return result

