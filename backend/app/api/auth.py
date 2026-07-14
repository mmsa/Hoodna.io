import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.auth import (
    UserSignup, UserLogin, TokenResponse, RefreshTokenRequest, 
    ForgotPasswordRequest, ResetPasswordRequest,
    PhoneAuthStartRequest, PhoneAuthStartResponse, PhoneAuthVerifyRequest
)
from app.schemas.user import (
    AvatarPresignRequest,
    AvatarUpdate,
    UserResponse,
    UserUpdate,
)
from app.schemas.account import (
    AccountDeletionRequestCreate,
    AccountDeletionRequestResponse,
    UserPreferencesResponse,
    UserPreferencesUpdate,
)
from app.crud.account import (
    create_or_get_pending_deletion_request,
    deletion_request_response,
    get_or_create_preferences,
    preferences_response,
    update_preferences,
)
from app.crud.referral import (
    DuplicateReferralError,
    ReferralNotFoundError,
    ReferralUnavailableError,
    SelfReferralError,
    redeem_referral,
)
from app.crud.user import get_user_by_email, create_user, get_user_by_phone, create_user_by_phone
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token, create_password_reset_token, get_password_hash
from app.services.email import send_password_reset_email, send_password_reset_confirmation_email
from app.core.dependencies import get_current_user
from app.models.user import User
from app.models.enums import AccountDeletionStatus
from datetime import timedelta
from app.core.config import settings
from app.services.feature_flags import is_feature_enabled
from typing import Optional
import random
import string

router = APIRouter()
logger = logging.getLogger(__name__)


async def redeem_registration_referral(
    db: AsyncSession,
    referral_code: str,
    user_id: int,
) -> None:
    """Redeem inside the registration transaction or reject registration."""
    try:
        invite = await redeem_referral(db, referral_code, user_id)
    except ReferralNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except (SelfReferralError, DuplicateReferralError) as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    except ReferralUnavailableError as exc:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail=str(exc))

    logger.info(
        "referral_registration_completed",
        extra={
            "user_id": user_id,
            "referral_invite_id": invite.id,
            "inviter_id": invite.inviter_id,
        },
    )


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
        if not await is_feature_enabled(
            db, "user_registration", anonymous_id=f"phone:{phone_normalized}"
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User registration is currently unavailable",
            )
        if not request.name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Name is required for new users"
            )
        user = await create_user_by_phone(db, phone_normalized, request.name)
        if request.referral_code:
            await redeem_registration_referral(
                db, request.referral_code.strip(), user.id
            )
    
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
    if not await is_feature_enabled(
        db, "user_registration", anonymous_id=f"email:{user_data.email.casefold()}"
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User registration is currently unavailable",
        )
    # Normalize email to lowercase
    email_lower = user_data.email.lower().strip()
    
    # Check if user already exists
    existing_user = await get_user_by_email(db, email_lower)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user with normalized email — never trust client role for privileged accounts
    user_data.email = email_lower
    from app.models.enums import UserRole

    signup_role = user_data.role
    allowed_roles = {
        UserRole.RESIDENT,
        UserRole.SERVICE_PROVIDER,
        UserRole.COMPOUND_MOD,
        UserRole.USER,
    }
    if signup_role is not None and signup_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role for registration",
        )
    user = await create_user(
        db,
        user_data,
        role=signup_role or UserRole.RESIDENT,
    )
    if user_data.referral_code:
        await redeem_registration_referral(
            db, user_data.referral_code.strip(), user.id
        )
    
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
    from app.crud.verification import get_user_documents, compute_verification_status
    from app.models.enums import DocumentType, UserStatus, UserRole
    
    # Fetch documents for residents who still need verification so clients can
    # distinguish "needs upload" (UNVERIFIED) vs "under review" (PENDING).
    can_post = False
    national_id = None
    contract = None
    docs = None

    if current_user.status in (
        UserStatus.APPROVED,
        UserStatus.PENDING_VERIFICATION,
        UserStatus.REJECTED,
    ):
        docs = await get_user_documents(db, current_user.id, current_user.compound_id)
        national_id = docs[DocumentType.NATIONAL_ID]
        contract = docs[DocumentType.CONTRACT]

    from app.crud.user_compound_membership import get_verified_compound_ids

    verified_compound_ids = sorted(
        await get_verified_compound_ids(db, current_user, persist_inferred=True)
    )
    is_verified_for_current_compound = (
        current_user.compound_id is not None
        and current_user.compound_id in verified_compound_ids
    )

    verification_status = compute_verification_status(
        current_user,
        national_id,
        contract,
        is_verified_for_current_compound=is_verified_for_current_compound,
    )

    if is_verified_for_current_compound:
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

    can_comment = is_verified_for_current_compound
    can_create_listing = is_verified_for_current_compound
    
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

    if current_user.role in (UserRole.RESIDENT, UserRole.USER, None):
        if not is_verified_for_current_compound:
            can_post = False
            can_comment = False
            can_create_listing = False
            if verification_status == "APPROVED":
                verification_status = "UNVERIFIED"

    return UserResponse(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        phone=current_user.phone,
        avatar_url=current_user.avatar_url,
        role=current_user.role,
        status=current_user.status,
        compound_id=current_user.compound_id,
        created_at=current_user.created_at,
        verification_status=verification_status,
        can_post=can_post,
        can_comment=can_comment,
        can_create_listing=can_create_listing,
        verified_compound_ids=verified_compound_ids,
        is_verified_for_current_compound=is_verified_for_current_compound,
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
        from app.crud.user_compound_membership import (
            ensure_pending_compound_membership,
        )

        compound = await get_compound_by_id(db, user_update.compound_id)
        if not compound:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compound not found"
            )

        new_compound_id = user_update.compound_id

        # Selecting a compound records a request only. It must never grant
        # verified access until a document is approved or an admin grants it.
        await ensure_pending_compound_membership(
            db, current_user.id, new_compound_id
        )
        current_user.compound_id = new_compound_id
    
    if user_update.role is not None:
        # Only allow role update if user doesn't have a role yet
        if current_user.role is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change role once set. Contact support if you need to change your account type."
            )
        current_user.role = user_update.role
    
    await db.flush()
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/avatar/presign")
async def presign_current_user_avatar(
    request: AvatarPresignRequest,
    current_user: User = Depends(get_current_user),
):
    """Create a short-lived, user-owned image upload URL."""
    from app.api.marketplace import validate_image_upload
    from app.schemas.verification import PresignResponse
    from app.services.s3 import generate_presigned_put_url

    validate_image_upload(request.file_name, request.file_type)
    presigned_url, file_url = generate_presigned_put_url(
        file_name=request.file_name,
        file_type=request.file_type,
        folder=f"profiles/{current_user.id}",
        user_id=current_user.id,
    )
    return PresignResponse(presigned_url=presigned_url, file_url=file_url)


@router.put("/me/avatar", response_model=UserResponse)
async def update_current_user_avatar(
    request: AvatarUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Validate an uploaded image and attach it to the current user."""
    from io import BytesIO

    from PIL import Image, UnidentifiedImageError

    from app.core.config import settings
    from app.services.s3 import download_file_bytes, extract_s3_object_key
    from app.services.storage import use_local_storage

    object_key = extract_s3_object_key(request.avatar_url)
    expected_prefix = f"profiles/{current_user.id}/"
    is_local_upload = use_local_storage() and "/api/uploads/" in request.avatar_url
    expected_s3_prefix = (
        f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/"
    )
    expected_endpoint_prefix = (
        f"{settings.S3_ENDPOINT_URL.rstrip('/')}/{settings.S3_BUCKET_NAME}/"
        if settings.S3_ENDPOINT_URL
        else None
    )
    is_owned_s3_upload = request.avatar_url.startswith(expected_s3_prefix) or (
        expected_endpoint_prefix is not None
        and request.avatar_url.startswith(expected_endpoint_prefix)
    )
    if is_local_upload:
        if f"/profiles/{current_user.id}/" not in request.avatar_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Avatar must use your profile upload URL",
            )
    elif (
        not is_owned_s3_upload
        or not object_key
        or not object_key.startswith(expected_prefix)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avatar must use your profile upload URL",
        )

    try:
        image_bytes = download_file_bytes(request.avatar_url)
        if len(image_bytes) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Profile picture must be 5 MB or smaller",
            )
        with Image.open(BytesIO(image_bytes)) as image:
            image.verify()
            width, height = image.size
            if image.format not in {"JPEG", "PNG", "WEBP"}:
                raise ValueError("Unsupported image format")
            if width < 64 or height < 64 or width > 8000 or height > 8000:
                raise ValueError("Image dimensions must be between 64 and 8000 pixels")
    except HTTPException:
        raise
    except (FileNotFoundError, UnidentifiedImageError, ValueError, OSError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded profile picture is missing or invalid",
        )

    current_user.avatar_url = request.avatar_url
    await db.flush()
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.get("/me/preferences", response_model=UserPreferencesResponse)
async def get_current_user_preferences(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get preferences, creating defaults lazily on first access."""
    preference = await get_or_create_preferences(db, current_user.id)
    return preferences_response(preference)


@router.patch("/me/preferences", response_model=UserPreferencesResponse)
async def patch_current_user_preferences(
    request: UserPreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    preference = await update_preferences(db, current_user.id, request)
    logger.info(
        "user_preferences_updated",
        extra={
            "user_id": current_user.id,
            "updated_fields": sorted(request.model_fields_set),
        },
    )
    return preferences_response(preference)


@router.post(
    "/me/deletion-request",
    response_model=AccountDeletionRequestResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def request_account_deletion(
    request: AccountDeletionRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Queue an explicit account deletion request without deleting account data."""
    deletion_request, created = await create_or_get_pending_deletion_request(
        db, current_user.id, request.reason
    )
    if deletion_request.status != AccountDeletionStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A completed or cancelled deletion request already exists",
        )
    logger.info(
        "account_deletion_requested",
        extra={
            "user_id": current_user.id,
            "deletion_request_id": deletion_request.id,
            "created": created,
        },
    )
    return deletion_request_response(deletion_request)


@router.get("/me/compounds", response_model=list[dict])
async def get_user_compounds(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Compounds the user can switch between (verified + in-progress verification)."""
    from app.crud.user_compound_membership import get_user_switchable_compounds

    return await get_user_switchable_compounds(db, current_user)


@router.post("/me/switch-compound", response_model=UserResponse)
async def switch_compound(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Switch active compound — verified neighbourhoods or in-progress verification."""
    from app.crud.compound import get_compound_by_id
    from app.crud.user_compound_membership import user_can_switch_to_compound
    from app.models.enums import UserStatus, UserRole

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

    if current_user.role not in (UserRole.RESIDENT, UserRole.USER, None):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only residents can switch neighbourhoods",
        )

    if current_user.status != UserStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Complete account verification before switching neighbourhoods.",
        )

    if not await user_can_switch_to_compound(db, current_user, compound_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Request access to this neighbourhood before switching to it.",
        )

    current_user.compound_id = compound_id
    await db.commit()
    await db.refresh(current_user)

    return await get_current_user_info(current_user, db)


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
    from app.crud.user_compound_membership import (
        ensure_pending_compound_membership,
    )
    
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

    await ensure_pending_compound_membership(
        db, current_user.id, compound_id
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
    
    email_sent = False
    reset_link: Optional[str] = None
    
    # Always return success to prevent email enumeration
    if user:
        reset_token = create_password_reset_token(data={"sub": user.id, "email": user.email})
        frontend = settings.effective_frontend_url
        reset_link = f"{frontend}/auth/reset-password?token={reset_token}"
        
        # Send password reset email
        email_sent = send_password_reset_email(user.email, reset_link)
        
        if not email_sent:
            logger.warning(
                "Password reset email NOT delivered for %s. Link: %s",
                user.email,
                reset_link,
            )
            if settings.ENVIRONMENT != "production":
                print(f"\n{'='*80}")
                print(f"PASSWORD RESET for {user.email}:")
                print(f"Reset Link: {reset_link}")
                print(f"{'='*80}\n")
    
    response: dict = {
        "message": "If an account with that email exists, a password reset link has been sent."
    }
    if settings.ENVIRONMENT != "production" and user and not email_sent:
        response["reset_link"] = reset_link
    return response


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset password using a reset token."""
    import logging
    logger = logging.getLogger(__name__)
    
    # Decode and verify reset token
    import urllib.parse
    token = urllib.parse.unquote(request.token.strip())
    
    logger.info(f"Attempting to decode reset token. Length: {len(token)}")
    
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
