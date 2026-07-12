from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.feature_flags import is_feature_enabled


async def require_business_claiming(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Policy hook for authenticated business claim submissions."""
    if not await is_feature_enabled(
        db,
        "business_claiming",
        user_id=current_user.id,
        compound_id=current_user.compound_id,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Business claiming is not currently available",
        )
    return current_user
