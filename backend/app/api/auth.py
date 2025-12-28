from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.auth import UserSignup, UserLogin, TokenResponse, RefreshTokenRequest
from app.schemas.user import UserResponse, UserUpdate
from app.crud.user import get_user_by_email, create_user
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token
from app.core.dependencies import get_current_user
from app.models.user import User
from datetime import timedelta
from app.core.config import settings

router = APIRouter()


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserSignup, db: AsyncSession = Depends(get_db)):
    """Sign up a new user."""
    # Check if user already exists
    existing_user = await get_user_by_email(db, user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    user = await create_user(db, user_data)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login and get access/refresh tokens."""
    user = await get_user_by_email(db, credentials.email)
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    if user.status.value == "BANNED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is banned"
        )
    
    # Create tokens
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(token_data: RefreshTokenRequest, db: AsyncSession = Depends(get_db)):
    """Refresh access token using refresh token."""
    payload = decode_token(token_data.refresh_token)
    
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = payload.get("sub")
    user = await db.get(User, user_id)
    
    if not user or user.status.value == "BANNED":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user"
        )
    
    # Create new tokens
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token
    )


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Logout (client should discard tokens)."""
    # In a more advanced implementation, you might want to blacklist tokens
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information."""
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user information."""
    if user_update.compound_id is not None:
        # Verify compound exists
        from app.crud.compound import get_compound_by_id
        compound = await get_compound_by_id(db, user_update.compound_id)
        if not compound:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compound not found"
            )
        current_user.compound_id = user_update.compound_id
    
    await db.flush()
    await db.refresh(current_user)
    return current_user

