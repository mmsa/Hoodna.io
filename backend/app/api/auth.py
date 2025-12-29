from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.auth import UserSignup, UserLogin, TokenResponse, RefreshTokenRequest, ForgotPasswordRequest, ResetPasswordRequest
from app.schemas.user import UserResponse, UserUpdate
from app.crud.user import get_user_by_email, create_user
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token, create_password_reset_token, get_password_hash
from app.services.email import send_password_reset_email, send_password_reset_confirmation_email
from app.core.dependencies import get_current_user
from app.models.user import User
from datetime import timedelta
from app.core.config import settings

router = APIRouter()


# Explicit OPTIONS handler for CORS preflight
@router.options("/login")
@router.options("/signup")
@router.options("/refresh")
@router.options("/logout")
@router.options("/me")
@router.options("/forgot-password")
@router.options("/reset-password")
async def options_handler():
    """Handle CORS preflight requests."""
    return {"message": "OK"}


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserSignup, db: AsyncSession = Depends(get_db)):
    """Sign up a new user and return authentication tokens."""
    # Normalize email to lowercase
    email_lower = user_data.email.lower().strip()
    
    # Check if user already exists
    existing_user = await get_user_by_email(db, email_lower)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user with normalized email
    user_data.email = email_lower
    user = await create_user(db, user_data)
    
    # Automatically log the user in by creating tokens
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token
    )


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login and get access/refresh tokens."""
    import logging
    logger = logging.getLogger(__name__)
    
    # Normalize email to lowercase for lookup
    email_lower = credentials.email.lower().strip()
    user = await get_user_by_email(db, email_lower)
    
    if not user:
        logger.warning(f"Login attempt failed: User not found for email {email_lower}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    # Verify password
    password_valid = verify_password(credentials.password, user.password_hash)
    if not password_valid:
        logger.warning(f"Login attempt failed: Invalid password for user {user.email}")
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
    
    logger.info(f"Successful login for user {user.email}")
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
    # Convert user_id to int if it's a string (from JWT - python-jose converts to string)
    if isinstance(user_id, str):
        try:
            user_id = int(user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid user ID in token"
            )
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


@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Request a password reset. Sends reset token (in production, via email)."""
    import logging
    logger = logging.getLogger(__name__)
    
    # Normalize email
    email_lower = request.email.lower().strip()
    user = await get_user_by_email(db, email_lower)
    
    # Always return success to prevent email enumeration
    if user:
        reset_token = create_password_reset_token(data={"sub": user.id, "email": user.email})
        # URL-encode the token to prevent corruption in email links
        import urllib.parse
        encoded_token = urllib.parse.quote(reset_token, safe='')
        reset_link = f"{settings.FRONTEND_URL}/auth/reset-password?token={encoded_token}"
        
        # Send password reset email via AWS SES
        email_sent = send_password_reset_email(user.email, reset_link)
        
        if not email_sent:
            # Fallback: log the reset link if email sending fails (for development/testing)
            logger.warning(f"Email sending failed. Password reset link for {user.email}: {reset_link}")
            print(f"\n{'='*80}")
            print(f"PASSWORD RESET TOKEN for {user.email}:")
            print(f"Token: {reset_token}")
            print(f"Reset Link: {reset_link}")
            print(f"{'='*80}\n")
    
    return {
        "message": "If an account with that email exists, a password reset link has been sent."
    }


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset password using a reset token."""
    import logging
    logger = logging.getLogger(__name__)
    
    # Decode and verify reset token
    # Handle URL-encoded tokens (spaces might be encoded as + or %20)
    import urllib.parse
    token = request.token.strip()
    
    # Try multiple decoding strategies
    # First, decode URL encoding
    token = urllib.parse.unquote(token)
    # Handle + as space encoding
    token = token.replace(' ', '+')
    
    logger.info(f"Attempting to decode reset token. Length: {len(token)}, First 50 chars: {token[:50]}")
    logger.info(f"Token ends with: ...{token[-20:]}")
    
    # Try to decode the token
    payload = decode_token(token)
    
    if payload is None:
        # Try decoding without verification to see what's in the token
        try:
            from jose import jwt as jose_jwt
            unverified = jose_jwt.decode(token, key="", options={"verify_signature": False})
            logger.warning(f"Token decodes without verification: {unverified}")
            logger.warning(f"Token type in payload: {unverified.get('type')}")
            logger.warning(f"Token expiry: {unverified.get('exp')}")
            # Check if expired
            from datetime import datetime
            exp_timestamp = unverified.get('exp')
            if exp_timestamp:
                exp_time = datetime.fromtimestamp(exp_timestamp)
                now = datetime.utcnow()
                logger.warning(f"Token expires at: {exp_time}, Current time: {now}, Expired: {exp_time < now}")
        except Exception as e:
            logger.error(f"Token doesn't decode at all: {e}")
        
        logger.warning(f"Failed to decode reset token. Full token: {token}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token. Please request a new password reset."
        )
    
    logger.info(f"Token decoded successfully. Type: {payload.get('type')}, User ID: {payload.get('sub')}")
    
    if payload.get("type") != "password_reset":
        logger.warning(f"Invalid token type: {payload.get('type')}, expected: password_reset")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token type"
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token"
        )
    
    # Convert user_id to int if it's a string (from JWT - python-jose converts to string)
    if isinstance(user_id, str):
        try:
            user_id = int(user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID in token"
            )
    
    # Get user
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update password
    user.password_hash = get_password_hash(request.new_password)
    await db.commit()
    await db.refresh(user)
    
    logger.info(f"Password reset successful for user {user.email}")
    
    # Send confirmation email
    send_password_reset_confirmation_email(user.email)
    
    return {
        "message": "Password has been reset successfully. You can now login with your new password."
    }

