from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.auth import (
    UserSignup, UserLogin, TokenResponse, RefreshTokenRequest, 
    ForgotPasswordRequest, ResetPasswordRequest,
    PhoneAuthStartRequest, PhoneAuthStartResponse, PhoneAuthVerifyRequest
)
from app.schemas.user import UserResponse, UserUpdate
from app.crud.user import get_user_by_email, create_user, get_user_by_phone, create_user_by_phone
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token, create_password_reset_token, get_password_hash
from app.services.email import send_password_reset_email, send_password_reset_confirmation_email
from app.core.dependencies import get_current_user
from app.models.user import User
from datetime import timedelta
from app.core.config import settings
import random
import string

router = APIRouter()


# Explicit OPTIONS handler for CORS preflight
@router.options("/login")
@router.options("/signup")
@router.options("/refresh")
@router.options("/logout")
@router.options("/me")
@router.options("/forgot-password")
@router.options("/reset-password")
@router.options("/start")
@router.options("/verify")
async def options_handler():
    """Handle CORS preflight requests."""
    return {"message": "OK"}


# In-memory OTP storage (use Redis in production)
otp_storage: dict[str, dict] = {}


def generate_otp() -> str:
    """Generate a 6-digit OTP code."""
    return ''.join(random.choices(string.digits, k=6))


@router.post("/start", response_model=PhoneAuthStartResponse)
async def phone_auth_start(
    request: PhoneAuthStartRequest,
    db: AsyncSession = Depends(get_db),
):
    """Start phone authentication by sending OTP."""
    phone_normalized = request.phone.strip().replace(" ", "").replace("-", "").replace("+", "")
    
    # Generate OTP
    otp_code = generate_otp()
    
    # Store OTP (expires in 10 minutes)
    import time
    otp_storage[phone_normalized] = {
        "otp": otp_code,
        "expires_at": time.time() + 600,  # 10 minutes
    }
    
    # In production, send SMS via Twilio/AWS SNS/etc.
    # For now, return OTP in dev mode
    if settings.ENVIRONMENT == "development":
        return PhoneAuthStartResponse(
            message="OTP sent successfully",
            otp_code=otp_code,  # Only in dev
        )
    
    return PhoneAuthStartResponse(message="OTP sent successfully")


@router.post("/verify", response_model=TokenResponse)
async def phone_auth_verify(
    request: PhoneAuthVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify OTP and return tokens. Creates user if doesn't exist."""
    phone_normalized = request.phone.strip().replace(" ", "").replace("-", "").replace("+", "")
    
    # Check OTP
    stored_otp = otp_storage.get(phone_normalized)
    if not stored_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP not found. Please request a new one."
        )
    
    import time
    if time.time() > stored_otp["expires_at"]:
        del otp_storage[phone_normalized]
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired. Please request a new one."
        )
    
    if stored_otp["otp"] != request.otp_code:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP code"
        )
    
    # OTP verified, remove it
    del otp_storage[phone_normalized]
    
    # Get or create user
    user = await get_user_by_phone(db, phone_normalized)
    if not user:
        if not request.name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name is required for new users"
            )
        user = await create_user_by_phone(db, phone_normalized, request.name)
    
    # Check if banned
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
        refresh_token=refresh_token,
        user=user
    )


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
    # Role is now required in UserSignup schema
    user = await create_user(db, user_data, role=user_data.role)
    
    # Automatically log the user in by creating tokens
    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user
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
        refresh_token=refresh_token,
        user=user
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
        refresh_token=refresh_token,
        user=user
    )


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Logout (client should discard tokens)."""
    # In a more advanced implementation, you might want to blacklist tokens
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user information with verification status."""
    from app.crud.verification import get_user_documents
    from app.models.enums import DocumentType, UserStatus, UserRole
    
    # Map UserStatus to verification_status string
    verification_status_map = {
        UserStatus.PENDING_VERIFICATION: "PENDING",
        UserStatus.APPROVED: "APPROVED",
        UserStatus.REJECTED: "REJECTED",
        UserStatus.BANNED: "REJECTED",  # Banned users are effectively rejected
    }
    
    # Default for users who haven't submitted any documents
    verification_status = "UNVERIFIED"
    if current_user.status in verification_status_map:
        verification_status = verification_status_map[current_user.status]
    
    # Only fetch documents if user is approved (optimization - skip DB query for unverified users)
    can_post = False
    national_id = None
    contract = None
    
    if current_user.status == UserStatus.APPROVED:
        # Only query documents for approved users who might be able to post
        docs = await get_user_documents(db, current_user.id)
        national_id = docs[DocumentType.NATIONAL_ID]
        contract = docs[DocumentType.CONTRACT]
        
        # Check if user can post (same logic as verification status endpoint)
        def _has_compound_name(doc):
            if not doc or not doc.llm_extracted_info:
                return False
            if isinstance(doc.llm_extracted_info, dict):
                compound_found = doc.llm_extracted_info.get("compound_name_in_address", False)
                address_match = doc.llm_extracted_info.get("address_match", "")
                return compound_found or address_match == "MATCH"
            return False
        
        if (
            national_id 
            and national_id.status.value == "APPROVED" 
            and _has_compound_name(national_id)
        ):
            can_post = True
        elif (
            contract
            and contract.status.value == "APPROVED"
            and contract.llm_extracted_info
            and isinstance(contract.llm_extracted_info, dict)
        ):
            name_match = contract.llm_extracted_info.get("name_match", "")
            if name_match == "MATCH" and _has_compound_name(contract):
                can_post = True
        elif (
            national_id and national_id.status.value == "APPROVED" and
            contract and contract.status.value == "APPROVED"
        ):
            can_post = True
    
    # Approved users can comment and create listings
    can_comment = current_user.status == UserStatus.APPROVED
    can_create_listing = current_user.status == UserStatus.APPROVED
    
    # For service providers and moderators, check their profile status instead
    if current_user.role == UserRole.SERVICE_PROVIDER:
        from app.crud.provider import get_provider_profile
        from app.models.enums import ProviderStatus
        provider_profile = await get_provider_profile(db, current_user.id)
        if provider_profile:
            can_create_listing = provider_profile.provider_status == ProviderStatus.APPROVED
    elif current_user.role == UserRole.COMPOUND_MOD:
        from app.crud.moderator import get_moderator_profile
        from app.models.enums import ModeratorStatus
        moderator_profile = await get_moderator_profile(db, current_user.id)
        if moderator_profile:
            can_create_listing = moderator_profile.moderator_status == ModeratorStatus.APPROVED
    
    return UserResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        phone=current_user.phone,
        role=current_user.role,
        status=current_user.status,
        compound_id=current_user.compound_id,
        created_at=current_user.created_at,
        verification_status=verification_status,
        can_post=can_post,
        can_comment=can_comment,
        can_create_listing=can_create_listing,
    )


@router.patch("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user information."""
    if user_update.compound_id is not None:
        from app.crud.compound import get_compound_by_id
        from app.crud.user_compound_membership import ensure_user_compound_membership
        from app.models.enums import UserStatus

        compound = await get_compound_by_id(db, user_update.compound_id)
        if not compound:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compound not found"
            )
        if (
            current_user.status == UserStatus.APPROVED
            and current_user.compound_id
            and current_user.compound_id != user_update.compound_id
        ):
            await ensure_user_compound_membership(
                db, current_user.id, current_user.compound_id
            )
        current_user.compound_id = user_update.compound_id
    
    if user_update.role is not None:
        # Only allow role update if user doesn't have a role yet
        if current_user.role is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change role once set. Contact support if you need to change your account type."
            )
        current_user.role = user_update.role
    
    await db.flush()
    await db.refresh(current_user)
    return current_user


@router.get("/me/compounds", response_model=list[dict])
async def get_user_compounds(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all compounds the user is verified for (for switching)."""
    from sqlalchemy import select
    from app.models.compound import Compound
    from app.crud.user_compound_membership import sync_user_compound_memberships

    verified_compound_ids = await sync_user_compound_memberships(db, current_user)

    if not verified_compound_ids:
        return []

    result_query = await db.execute(
        select(Compound).where(Compound.id.in_(verified_compound_ids))
    )
    verified_compounds = result_query.scalars().all()

    result = []
    for compound in verified_compounds:
        result.append({
            "id": compound.id,
            "name": compound.name,
            "area": compound.area,
            "is_current": compound.id == current_user.compound_id,
        })

    result.sort(key=lambda x: (not x["is_current"], x["name"]))
    return result


@router.post("/me/switch-compound", response_model=UserResponse)
async def switch_compound(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Switch the user's current compound (only to verified compounds)."""
    from app.crud.compound import get_compound_by_id
    from app.crud.user_compound_membership import user_has_compound_membership
    from app.models.enums import UserStatus

    compound_id = request.get("compound_id")
    if compound_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="compound_id is required"
        )

    compound = await get_compound_by_id(db, compound_id)
    if not compound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Compound not found"
        )

    if current_user.status != UserStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not verified for this compound. Please request access and submit verification documents.",
        )

    if not await user_has_compound_membership(db, current_user, compound_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not verified for this compound. Please request access and submit verification documents.",
        )
    
    # Update user's current compound
    current_user.compound_id = compound_id
    await db.flush()
    await db.refresh(current_user)
    
    return current_user


@router.post("/me/request-compound-access")
async def request_compound_access(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Request access to a compound (will require new verification)."""
    from app.crud.compound import get_compound_by_id
    from app.models.notification import Notification
    from app.models.enums import NotificationType
    from app.crud.user import get_compound_moderators_and_admins
    
    compound_id = request.get("compound_id")
    if compound_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="compound_id is required"
        )
    
    # Verify compound exists
    compound = await get_compound_by_id(db, compound_id)
    if not compound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Compound not found"
        )
    
    # Get moderators and admins for this compound
    moderators_and_admins = await get_compound_moderators_and_admins(db, compound_id)
    
    # Create notification for each moderator/admin
    for moderator in moderators_and_admins:
        notification = Notification(
            user_id=moderator.id,
            type=NotificationType.VERIFICATION_REQUEST_MORE,
            title=f"New Compound Access Request",
            message=f"{current_user.name} ({current_user.email}) has requested access to {compound.name}. Please review their verification documents.",
            related_id=current_user.id,
            related_type="user",
            extra_data={"compound_id": compound_id, "compound_name": compound.name, "requester_id": current_user.id},
        )
        db.add(notification)
    
    await db.commit()
    
    return {
        "message": "Access request submitted. You will need to submit verification documents for this compound.",
        "compound_id": compound_id,
        "compound_name": compound.name,
    }


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
