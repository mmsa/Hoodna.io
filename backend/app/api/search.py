from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from sqlalchemy.orm import selectinload
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.core.dependencies import get_current_verified_user, get_current_user_optional
from app.models.user import User
from app.models.post import Post
from app.models.listing import Listing
from app.models.enums import ListingStatus, ListingCategory

router = APIRouter()


class SearchResultItem(BaseModel):
    """Individual search result item"""
    type: str  # "post", "listing", "service"
    id: int
    title: str
    content: Optional[str] = None
    author_name: Optional[str] = None
    compound_name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    created_at: datetime
    relevance_score: Optional[float] = None  # For ranking

    class Config:
        from_attributes = True


class GlobalSearchResponse(BaseModel):
    """Global search results across all content types"""
    query: str
    posts: List[SearchResultItem] = []
    listings: List[SearchResultItem] = []
    services: List[SearchResultItem] = []
    total_results: int = 0


@router.get("/global", response_model=GlobalSearchResponse)
async def global_search(
    q: str = Query(..., description="Search query", min_length=1),
    compound_id: Optional[int] = None,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Global search across posts, listings, and services.
    Searches in titles, descriptions, and content.
    User must be verified for the compound to search its marketplace.
    """
    from app.core.verification_helpers import is_user_verified_for_compound
    
    if not q or len(q.strip()) < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query is required"
        )
    
    # Use user's compound if authenticated, otherwise use provided compound_id
    search_compound_id = None
    if current_user and current_user.compound_id:
        search_compound_id = current_user.compound_id
    elif compound_id:
        search_compound_id = compound_id
    
    if not search_compound_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Compound context required for search"
        )
    
    # Check if user is verified for the compound (if authenticated)
    if current_user:
        is_verified = await is_user_verified_for_compound(
            db=db,
            user=current_user,
            compound_id=search_compound_id
        )
        if not is_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be verified for this compound to search its marketplace. Please complete verification first."
            )
    
    search_term = f"%{q.lower().strip()}%"
    results = GlobalSearchResponse(query=q)
    
    # Search Posts
    posts_query = (
        select(Post)
        .options(
            selectinload(Post.author),
            selectinload(Post.compound)
        )
        .where(
            Post.compound_id == search_compound_id,
            or_(
                func.lower(Post.content).like(search_term)
            )
        )
        .order_by(Post.created_at.desc())
        .limit(20)
    )
    
    posts_result = await db.execute(posts_query)
    posts = posts_result.scalars().all()
    
    results.posts = [
        SearchResultItem(
            type="post",
            id=post.id,
            title=post.content[:100] + "..." if len(post.content) > 100 else post.content,
            content=post.content,
            author_name=post.author.name if post.author else None,
            compound_name=post.compound.name if post.compound else None,
            category=post.category.value if post.category else None,
            created_at=post.created_at,
        )
        for post in posts
    ]
    
    # Search Listings (excluding services)
    listings_query = (
        select(Listing)
        .options(
            selectinload(Listing.compound),
            selectinload(Listing.owner)
        )
        .where(
            Listing.compound_id == search_compound_id,
            Listing.status == ListingStatus.ACTIVE,
            Listing.category != ListingCategory.SERVICE,  # Exclude services
            or_(
                func.lower(Listing.title).like(search_term),
                func.lower(Listing.description).like(search_term)
            )
        )
        .order_by(Listing.created_at.desc())
        .limit(20)
    )
    
    listings_result = await db.execute(listings_query)
    listings = listings_result.scalars().all()
    
    results.listings = [
        SearchResultItem(
            type="listing",
            id=listing.id,
            title=listing.title,
            content=listing.description,
            author_name=listing.owner.name if listing.owner else None,
            compound_name=listing.compound.name if listing.compound else None,
            category=listing.category.value if listing.category else None,
            price=listing.price,
            created_at=listing.created_at,
        )
        for listing in listings
    ]
    
    # Search Services (SERVICE category listings)
    services_query = (
        select(Listing)
        .options(
            selectinload(Listing.compound),
            selectinload(Listing.owner)
        )
        .where(
            Listing.compound_id == search_compound_id,
            Listing.status == ListingStatus.ACTIVE,
            Listing.category == ListingCategory.SERVICE,
            or_(
                func.lower(Listing.title).like(search_term),
                func.lower(Listing.description).like(search_term)
            )
        )
        .order_by(Listing.created_at.desc())
        .limit(20)
    )
    
    services_result = await db.execute(services_query)
    services = services_result.scalars().all()
    
    results.services = [
        SearchResultItem(
            type="service",
            id=service.id,
            title=service.title,
            content=service.description,
            author_name=service.owner.name if service.owner else None,
            compound_name=service.compound.name if service.compound else None,
            category=service.category.value if service.category else None,
            price=service.price,
            created_at=service.created_at,
        )
        for service in services
    ]
    
    results.total_results = len(results.posts) + len(results.listings) + len(results.services)
    
    return results

