from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.community import (
    PostCreate, PostResponse, CommentCreate, CommentResponse,
    ReactionUpdate, PostReactionsResponse,
)
from app.crud.post import (
    get_feed_posts, create_post, create_comment, get_compound_announcements,
    toggle_post_reaction,
)
from app.crud.listing import get_listings
from app.crud.compound import get_compound_by_id
from app.core.dependencies import get_current_approved_user, get_current_verified_user, get_current_user_optional, get_current_user
from app.models.user import User
from app.services.feature_flags import require_community_posting
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter()


def _reaction_fields(post, user_id: Optional[int]) -> dict:
    counts = {"LOVE": 0, "LIKE": 0, "WOW": 0, "PRAY": 0}
    user_reaction = None
    for reaction in post.reactions:
        if reaction.reaction in counts:
            counts[reaction.reaction] += 1
        if reaction.user_id == user_id:
            user_reaction = reaction.reaction
    return {"reaction_counts": counts, "user_reaction": user_reaction}


class FeedSummaryResponse(BaseModel):
    compound_name: Optional[str] = None
    compound_area: Optional[str] = None
    compound_developer: Optional[str] = None
    compound_status: Optional[str] = None
    compound_hero_image_url: Optional[str] = None
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
        compound_hero_image_url=compound.hero_image_url,
        recent_listings_count=len(recent_listings),
        recent_posts_count=len(recent_posts),
        total_neighbors=total_neighbors,
    )


@router.get("/posts", response_model=List[PostResponse])
async def get_posts(
    compound_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Get posts. Public read, but compound_id required. If not provided and user is authenticated, uses user's compound."""
    # Try to use user's compound if authenticated and compound_id not provided
    if compound_id is None and current_user and current_user.compound_id:
        compound_id = current_user.compound_id
    
    if compound_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="compound_id is required"
        )
    
    posts = await get_feed_posts(db, compound_id=compound_id, skip=skip, limit=limit)
    
    # Convert to response format
    result = []
    for post in posts:
        # Get compound name for context
        compound_name = post.compound.name if post.compound else None
        
        result.append(PostResponse(
            id=post.id,
            compound_id=post.compound_id,
            compound_name=compound_name,
            author_id=post.author_id,
            author_name=post.author.name,
            author_avatar_url=post.author.avatar_url,
            author_status=post.author.status.value if post.author.status else None,  # Include verification status
            content=post.content,
            category=post.category.value if post.category else None,  # Include category
            is_urgent=post.is_urgent if post.is_urgent else False,  # Include urgent flag
            created_at=post.created_at,
            **_reaction_fields(post, current_user.id if current_user else None),
            comments=[
                CommentResponse(
                    id=c.id,
                    post_id=c.post_id,
                    author_id=c.author_id,
                    author_name=c.author.name,
                    author_avatar_url=c.author.avatar_url,
                    author_status=c.author.status.value if c.author.status else None,  # Include verification status
                    content=c.content,
                    created_at=c.created_at,
                )
                for c in post.comments
            ]
        ))
    
    return result


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
        # Get compound name for context
        compound_name = post.compound.name if post.compound else None
        
        result.append(PostResponse(
            id=post.id,
            compound_id=post.compound_id,
            compound_name=compound_name,
            author_id=post.author_id,
            author_name=post.author.name,
            author_avatar_url=post.author.avatar_url,
            author_status=post.author.status.value if post.author.status else None,  # Include verification status
            content=post.content,
            category=post.category.value if post.category else None,  # Include category
            is_urgent=post.is_urgent if post.is_urgent else False,  # Include urgent flag
            created_at=post.created_at,
            **_reaction_fields(post, current_user.id),
            comments=[
                CommentResponse(
                    id=c.id,
                    post_id=c.post_id,
                    author_id=c.author_id,
                    author_name=c.author.name,
                    author_avatar_url=c.author.avatar_url,
                    author_status=c.author.status.value if c.author.status else None,  # Include verification status
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
    current_user: User = Depends(require_community_posting),
    db: AsyncSession = Depends(get_db),
):
    """Create a new post."""
    from app.models.enums import UserRole, UserStatus, PostCategory, ModeratorStatus
    from app.core.verification_helpers import is_user_verified_for_compound
    from app.crud.moderator import get_moderator_profile
    
    if current_user.compound_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must be assigned to a compound"
        )
    
    # Check if this is an official announcement
    if post_data.category == PostCategory.ANNOUNCEMENT:
        # Only approved moderators for this compound can post announcements
        if current_user.role != UserRole.COMPOUND_MOD:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only approved moderators can post official announcements"
            )
        
        # Check moderator profile and status
        moderator_profile = await get_moderator_profile(db, current_user.id)
        if not moderator_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Moderator profile not found"
            )
        
        if moderator_profile.moderator_status != ModeratorStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your moderator profile must be approved to post official announcements"
            )
        
        # Verify moderator is assigned to this compound
        if moderator_profile.compound_id != current_user.compound_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only post announcements for your assigned compound"
            )
    else:
        # USER is the legacy name for the resident role.
        if current_user.role not in (UserRole.RESIDENT, UserRole.USER, None):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only verified residents can post in the feed. Moderators can only post official announcements."
            )
        
        # Check if user is approved
        if current_user.status != UserStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be approved to create posts. Please complete verification first."
            )
        
        # Check if user is verified for their compound
        is_verified = await is_user_verified_for_compound(
            db=db,
            user=current_user,
            compound_id=current_user.compound_id
        )
        
        if not is_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be verified for this compound to create posts. Please complete verification first."
            )
    
    post = await create_post(
        db=db,
        compound_id=current_user.compound_id,
        author_id=current_user.id,
        post_data=post_data,
    )
    
    # Refresh to get relationships
    await db.refresh(post, ["compound", "author"])
    
    return PostResponse(
        id=post.id,
        compound_id=post.compound_id,
        compound_name=post.compound.name if post.compound else None,
        author_id=post.author_id,
        author_name=current_user.name,
        author_avatar_url=current_user.avatar_url,
        author_status=current_user.status.value if current_user.status else None,
        content=post.content,
        category=post.category.value if post.category else None,
        is_urgent=post.is_urgent if post.is_urgent else False,
        created_at=post.created_at,
        comments=[],
    )


@router.put("/posts/{post_id}/reaction", response_model=PostReactionsResponse)
async def react_to_post(
    post_id: int,
    reaction_data: ReactionUpdate,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Add, change, or remove the current user's reaction."""
    try:
        post = await toggle_post_reaction(
            db, post_id, current_user.id, reaction_data.reaction,
            current_user.compound_id,
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    return PostReactionsResponse(**_reaction_fields(post, current_user.id))


@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment_endpoint(
    post_id: int,
    comment_data: CommentCreate,
    current_user: User = Depends(require_community_posting),
    db: AsyncSession = Depends(get_db),
):
    """Create a comment on a post."""
    comment = await create_comment(
        db=db,
        post_id=post_id,
        author_id=current_user.id,
        comment_data=comment_data,
    )
    
    # Refresh to get author relationship
    await db.refresh(comment, ["author"])
    
    return CommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        author_id=comment.author_id,
        author_name=current_user.name,
        author_avatar_url=current_user.avatar_url,
        author_status=current_user.status.value if current_user.status else None,
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
        # Get compound name for context
        compound_name = post.compound.name if post.compound else None
        
        result.append(PostResponse(
            id=post.id,
            compound_id=post.compound_id,
            compound_name=compound_name,
            author_id=post.author_id,
            author_name=post.author.name,
            author_avatar_url=post.author.avatar_url,
            author_status=post.author.status.value if post.author.status else None,  # Include verification status
            content=post.content,
            category=post.category.value if post.category else None,  # Include category
            is_urgent=post.is_urgent if post.is_urgent else False,  # Include urgent flag
            created_at=post.created_at,
            **_reaction_fields(post, current_user.id),
            comments=[
                CommentResponse(
                    id=c.id,
                    post_id=c.post_id,
                    author_id=c.author_id,
                    author_name=c.author.name,
                    author_avatar_url=c.author.avatar_url,
                    author_status=c.author.status.value if c.author.status else None,  # Include verification status
                    content=c.content,
                    created_at=c.created_at,
                )
                for c in post.comments
            ]
        ))
    
    return result

