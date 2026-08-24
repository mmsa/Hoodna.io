"""Public neighbour profile endpoints."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user
from app.crud.account import get_or_create_preferences, get_profile_visibility
from app.db.session import get_db
from app.models.enums import UserRole, UserStatus
from app.models.user import User
from app.schemas.account import PublicUserProfile

router = APIRouter()


@router.get("/{user_id}/profile", response_model=PublicUserProfile)
async def get_public_user_profile(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return a privacy-filtered public profile for a neighbour."""
    result = await db.execute(
        select(User)
        .options(selectinload(User.compound))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user or user.status == UserStatus.BANNED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Neighbour not found",
        )

    is_own = current_user.id == user.id
    preference = await get_or_create_preferences(db, user.id)
    visibility = get_profile_visibility(preference)

    # Owners always see their own full contact details on the public page preview
    show_avatar = visibility.show_avatar or is_own
    show_compound = visibility.show_compound or is_own
    show_joined = visibility.show_joined_at or is_own
    show_phone = visibility.show_phone or is_own
    show_email = visibility.show_email or is_own

    role_value = user.role.value if isinstance(user.role, UserRole) else user.role

    return PublicUserProfile(
        id=user.id,
        name=user.name,
        avatar_url=user.avatar_url if show_avatar else None,
        compound_id=user.compound_id if show_compound else None,
        compound_name=(
            user.compound.name
            if show_compound and user.compound is not None
            else None
        ),
        joined_at=user.created_at if show_joined else None,
        phone=user.phone if show_phone else None,
        email=user.email if show_email else None,
        is_verified=user.status == UserStatus.APPROVED,
        role=str(role_value) if role_value else None,
        is_own_profile=is_own,
        visibility=visibility,
    )
