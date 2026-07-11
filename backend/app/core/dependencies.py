from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.user import User
from app.models.enums import UserRole, UserStatus
from app.core.security import decode_token

security = HTTPBearer(auto_error=False)


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Get the current authenticated user, or None if not authenticated."""
    if credentials is None:
        return None
    token = credentials.credentials
    payload = decode_token(token)
    
    if payload is None or payload.get("type") != "access":
        return None
    
    user_id = payload.get("sub")
    if user_id is None:
        return None
    
    # Convert user_id to int if it's a string
    if isinstance(user_id, str):
        try:
            user_id = int(user_id)
        except ValueError:
            return None
    
    user = await db.get(User, user_id)
    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get the current authenticated user."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
        )
    token = credentials.credentials
    payload = decode_token(token)
    
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    
    # Convert user_id to int if it's a string (from JWT - python-jose converts to string)
    if isinstance(user_id, str):
        try:
            user_id = int(user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user ID in token",
            )
    
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    if user.status == UserStatus.BANNED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is banned",
        )
    
    return user


async def get_upload_user_id(
    object_key: str = Query(...),
    upload_token: Optional[str] = Query(None),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> int:
    """Resolve user for S3 proxy upload via Bearer token or presign upload_token."""
    import logging

    logger = logging.getLogger(__name__)

    if credentials is not None:
        payload = decode_token(credentials.credentials)
        if payload is not None and payload.get("type") == "access":
            user_id = payload.get("sub")
            if user_id is not None:
                if isinstance(user_id, str):
                    try:
                        user_id = int(user_id)
                    except ValueError:
                        user_id = None
                if user_id is not None:
                    user = await db.get(User, user_id)
                    if user is not None:
                        return user.id

    if upload_token:
        from app.core.security import verify_upload_token

        user_id = verify_upload_token(upload_token, object_key)
        if user_id is not None:
            user = await db.get(User, user_id)
            if user is not None:
                return user.id
        logger.warning(
            "S3 upload token rejected: object_key=%s",
            object_key,
        )
    else:
        logger.warning(
            "S3 upload unauthorized (no Bearer token or upload_token): object_key=%s",
            object_key,
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing upload credentials",
    )


async def get_download_user_id(
    file_url: str = Query(...),
    download_token: Optional[str] = Query(None),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> int:
    """Resolve user for file download via Bearer token or presign download_token."""
    import logging

    logger = logging.getLogger(__name__)
    stored = file_url.strip()

    if credentials is not None:
        payload = decode_token(credentials.credentials)
        if payload is not None and payload.get("type") == "access":
            user_id = payload.get("sub")
            if user_id is not None:
                if isinstance(user_id, str):
                    try:
                        user_id = int(user_id)
                    except ValueError:
                        user_id = None
                if user_id is not None:
                    user = await db.get(User, user_id)
                    if user is not None:
                        return user.id

    if download_token:
        from app.core.security import verify_download_token

        user_id = verify_download_token(download_token, stored)
        if user_id is not None:
            user = await db.get(User, user_id)
            if user is not None:
                return user.id
        logger.warning("Download token rejected for file_url=%s", stored)
    else:
        logger.warning("Download unauthorized (no Bearer or download_token)")

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing download credentials",
    )


async def get_current_approved_user(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get the current user, ensuring they are approved.
    
    For service providers and moderators, checks their profile status instead of user status.
    """
    # Service providers: check provider profile status
    if current_user.role == UserRole.SERVICE_PROVIDER:
        from app.crud.provider import get_provider_profile
        from app.models.enums import ProviderStatus
        provider_profile = await get_provider_profile(db, current_user.id)
        if not provider_profile or provider_profile.provider_status != ProviderStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your provider profile must be approved to perform this action",
            )
        return current_user
    
    # Moderators: check moderator profile status
    if current_user.role == UserRole.COMPOUND_MOD:
        from app.crud.moderator import get_moderator_profile
        from app.models.enums import ModeratorStatus
        moderator_profile = await get_moderator_profile(db, current_user.id)
        if not moderator_profile or moderator_profile.moderator_status != ModeratorStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your moderator profile must be approved to perform this action",
            )
        return current_user
    
    # Regular users: check user status
    if current_user.status != UserStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be approved to perform this action",
        )
    return current_user


async def get_current_user_with_compound(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get the current user, ensuring they have selected a compound."""
    if current_user.compound_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must select a compound first",
        )
    return current_user


async def get_current_verified_user(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get the current user, ensuring they are verified (approved status).
    
    For moderators, checks their moderator profile status and compound_id.
    """
    # Moderators: check moderator profile status and compound_id
    if current_user.role == UserRole.COMPOUND_MOD:
        from app.crud.moderator import get_moderator_profile
        from app.models.enums import ModeratorStatus
        moderator_profile = await get_moderator_profile(db, current_user.id)
        if not moderator_profile or moderator_profile.moderator_status != ModeratorStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your moderator profile must be approved to access the community. Please complete verification first.",
            )
        if moderator_profile.compound_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Moderator must have a compound assigned",
            )
        # Temporarily set compound_id on user object for API compatibility
        current_user.compound_id = moderator_profile.compound_id
        return current_user
    
    # Regular users: check user status
    if current_user.status != UserStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be verified to access the community. Please complete verification first.",
        )
    if current_user.compound_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must select a compound first",
        )
    return current_user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Get the current user, ensuring they are an admin."""
    if current_user.role not in [UserRole.ADMIN, UserRole.MODERATOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def get_current_moderator_or_admin(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Get the current user, ensuring they are a moderator or admin.
    
    For COMPOUND_MOD role, also checks that their moderator profile is approved.
    """
    if current_user.role == UserRole.COMPOUND_MOD:
        from app.crud.moderator import get_moderator_profile
        from app.models.enums import ModeratorStatus
        moderator_profile = await get_moderator_profile(db, current_user.id)
        if not moderator_profile or moderator_profile.moderator_status != ModeratorStatus.APPROVED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your moderator profile must be approved to perform this action",
            )
        return current_user
    
    if current_user.role not in [UserRole.ADMIN, UserRole.MODERATOR]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Moderator or admin access required",
        )
    return current_user

