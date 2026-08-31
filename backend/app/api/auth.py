import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.auth import (
    UserSignup, UserLogin, TokenResponse, RefreshTokenRequest, 
    ForgotPasswordRequest, ResetPasswordRequest, ResetPasswordPhoneRequest,
    PhoneAuthStartRequest, PhoneAuthStartResponse, PhoneAuthVerifyRequest,
    ConfirmPhoneOtpRequest, ConfirmEmailOtpRequest,
)
from app.schemas.user import (
    AvatarPresignRequest,
    AvatarUpdate,
    CompleteProfileRequest,
    ImportedContentSummaryResponse,
    UserResponse,
    UserUpdate,
)
from app.schemas.compound import SampleContentActionResponse, SampleContentStatusResponse
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
from app.services.email import (
    send_password_reset_email,
    send_password_reset_confirmation_email,
    send_email_verification_email,
)
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
@router.options("/reset-password-phone")
@router.options("/start")
@router.options("/verify")
async def options_handler():
    """Handle CORS preflight requests."""
    return {"message": "OK"}


# In-memory OTP storage (use Redis in production)
otp_storage: dict[str, dict] = {}
email_otp_storage: dict[str, dict] = {}


def generate_otp() -> str:
    """Generate a 6-digit OTP code."""
    return "".join(random.choices(string.digits, k=6))


def _is_placeholder_email(email: str | None) -> bool:
    return bool(email and str(email).endswith("@hoodna.local"))


def _consume_phone_otp(phone_normalized: str, otp_code: str) -> None:
    """Validate and consume a stored phone OTP, or raise HTTPException."""
    import time

    stored_otp = otp_storage.get(phone_normalized)
    if not stored_otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP not found. Please request a new one.",
        )
    if time.time() > stored_otp["expires_at"]:
        otp_storage.pop(phone_normalized, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired. Please request a new one.",
        )
    if stored_otp["otp"] != otp_code:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP code",
        )
    otp_storage.pop(phone_normalized, None)


def _user_needs_contact_verification(user: User) -> bool:
    """True until phone (if present) and real email (if present) are verified."""
    if not user.phone:
        phone_ok = True
    else:
        phone_ok = bool(getattr(user, "phone_verified", True))
    if _is_placeholder_email(user.email):
        email_ok = True
    else:
        email_ok = bool(getattr(user, "email_verified", True))
    return not phone_ok or not email_ok


@router.post("/start", response_model=PhoneAuthStartResponse)
async def phone_auth_start(
    request: PhoneAuthStartRequest,
    http_request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Start phone authentication by sending OTP (SMS.to / Twilio / WhatsApp)."""
    from app.utils.phone import normalize_phone
    from app.services.sms import (
        OtpRateLimitError,
        SmsDeliveryError,
        check_otp_rate_limits,
        send_otp_sms,
        sms_delivery_configured,
    )

    phone_normalized = normalize_phone(request.phone)
    if not phone_normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number",
        )

    client_ip = None
    if http_request.client:
        client_ip = http_request.client.host
    forwarded = http_request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip() or client_ip

    try:
        check_otp_rate_limits(phone=phone_normalized, client_ip=client_ip)
    except OtpRateLimitError as exc:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        ) from exc

    # Generate OTP
    otp_code = generate_otp()

    # Store OTP (expires in 10 minutes)
    import time

    otp_storage[phone_normalized] = {
        "otp": otp_code,
        "expires_at": time.time() + 600,  # 10 minutes
    }

    sms_configured = sms_delivery_configured()
    if sms_configured:
        try:
            await send_otp_sms(phone_normalized, otp_code)
        except SmsDeliveryError as exc:
            # Drop stored OTP so a failed send cannot be guessed from a prior race
            otp_storage.pop(phone_normalized, None)
            logger.error(
                "otp_sms_delivery_failed",
                extra={"phone_suffix": phone_normalized[-4:], "error": str(exc)},
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not send verification code. Please try again.",
            ) from exc
        # Never return otp_code when a production OTP channel was used
        return PhoneAuthStartResponse(message="OTP sent successfully")

    # Local engineering only: expose code when OTP channel is not configured
    if settings.ENVIRONMENT == "development":
        return PhoneAuthStartResponse(
            message="OTP sent successfully (dev — SMS not configured)",
            otp_code=otp_code,
        )

    otp_storage.pop(phone_normalized, None)
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="OTP delivery not configured. Set SMS_PROVIDER=smsto with SMSTO_API_KEY.",
    )


@router.post("/verify", response_model=TokenResponse)
async def phone_auth_verify(
    request: PhoneAuthVerifyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify OTP and return tokens. Creates user if doesn't exist."""
    from app.utils.phone import normalize_phone

    phone_normalized = normalize_phone(request.phone)
    if not phone_normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number",
        )
    
    _consume_phone_otp(phone_normalized, request.otp_code)

    # Get or create user (lookup uses same country-code normalization)
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
        try:
            user = await create_user_by_phone(db, phone_normalized, request.name)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc) or "Invalid phone number",
            ) from exc
        if request.referral_code:
            await redeem_registration_referral(
                db, request.referral_code.strip(), user.id
            )
            from app.services.user_creation import apply_creation_provenance

            apply_creation_provenance(
                user,
                source="PHONE_AUTH",
                details={"referral_code": request.referral_code.strip()},
                overwrite=True,
            )
    
    # Check if banned
    if user.status.value == "BANNED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is banned"
        )

    # Phone OTP is the contact proof for this number.
    user.phone_verified = True

    # Imported neighbours: proving the WhatsApp phone confirms the compound invite
    # so they are not sent to document verification / an empty "under review" loop.
    from app.services.chat_import_publish import (
        confirm_all_pending_chat_import_memberships,
    )

    await confirm_all_pending_chat_import_memberships(db, user)
    from app.crud.user_compound_membership import sync_primary_compound_from_memberships

    await sync_primary_compound_from_memberships(db, user)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})
    user_payload = await get_current_user_info(user, db)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_payload,
    )


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(user_data: UserSignup, db: AsyncSession = Depends(get_db)):
    """Sign up a new user and return authentication tokens."""
    from app.utils.phone import normalize_phone

    phone_normalized = normalize_phone(user_data.phone)
    if not phone_normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number",
        )

    feature_key = (
        f"email:{user_data.email.casefold()}"
        if user_data.email
        else f"phone:{phone_normalized}"
    )
    if not await is_feature_enabled(db, "user_registration", anonymous_id=feature_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User registration is currently unavailable",
        )

    existing_phone = await get_user_by_phone(db, phone_normalized)
    if existing_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "This phone is already registered. Sign in with a verification "
                "code, or use Forgot password."
            ),
        )

    if user_data.email:
        email_lower = user_data.email.lower().strip()
        existing_user = await get_user_by_email(db, email_lower)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        user_data.email = email_lower
    else:
        # DB requires a unique email; match phone-auth placeholder pattern
        user_data.email = f"phone_{phone_normalized}@hoodna.local"

    user_data.phone = phone_normalized

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

    has_real_email = not _is_placeholder_email(user_data.email)
    user = await create_user(
        db,
        user_data,
        role=signup_role,  # None until user picks on choose-role
        creation_source=(
            "PHONE_PASSWORD_SIGNUP"
            if _is_placeholder_email(user_data.email)
            else "EMAIL_SIGNUP"
        ),
        creation_details=(
            {"referral_code": user_data.referral_code.strip()}
            if user_data.referral_code
            else None
        ),
        phone_verified=False,
        email_verified=not has_real_email,
    )
    if user_data.referral_code:
        await redeem_registration_referral(
            db, user_data.referral_code.strip(), user.id
        )

    # Send phone OTP (required before onboarding)
    from app.services.sms import (
        OtpRateLimitError,
        SmsDeliveryError,
        check_otp_rate_limits,
        send_otp_sms,
        sms_delivery_configured,
    )
    import time

    otp_code = generate_otp()
    otp_storage[phone_normalized] = {
        "otp": otp_code,
        "expires_at": time.time() + 600,
    }
    if sms_delivery_configured():
        try:
            check_otp_rate_limits(phone=phone_normalized, client_ip=None)
            await send_otp_sms(phone_normalized, otp_code)
        except (SmsDeliveryError, OtpRateLimitError) as exc:
            logger.warning(
                "signup_otp_send_failed",
                extra={"phone_suffix": phone_normalized[-4:], "error": str(exc)},
            )
            # Account exists; user can resend from verify-contact screen
    elif settings.ENVIRONMENT == "development":
        logger.info("signup_dev_otp phone=...%s code=%s", phone_normalized[-4:], otp_code)

    email_otp_code = None
    if has_real_email:
        email_otp_code = generate_otp()
        email_otp_storage[user_data.email] = {
            "otp": email_otp_code,
            "expires_at": time.time() + 600,
            "user_id": user.id,
        }
        sent = send_email_verification_email(user_data.email, email_otp_code)
        if not sent and settings.ENVIRONMENT == "development":
            logger.info(
                "signup_dev_email_otp email=%s code=%s",
                user_data.email,
                email_otp_code,
            )

    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            phone=user.phone,
            avatar_url=user.avatar_url,
            role=user.role,
            status=user.status,
            compound_id=user.compound_id,
            created_at=user.created_at,
            phone_verified=bool(user.phone_verified),
            email_verified=bool(user.email_verified),
            needs_contact_verification=_user_needs_contact_verification(user),
            creation_source=getattr(user, "creation_source", None),
        ),
    )


@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login with email or phone number + password."""
    import logging
    logger = logging.getLogger(__name__)

    identifier = (credentials.email or "").strip()
    if not identifier:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/phone or password",
        )

    if "@" in identifier:
        user = await get_user_by_email(db, identifier.lower())
    else:
        user = await get_user_by_phone(db, identifier)

    if not user:
        logger.warning("Login attempt failed: user not found for identifier")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/phone or password",
        )

    # Chat-import / phone-OTP accounts have an empty password hash
    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                "This account does not have a password. Sign in with a "
                "verification code sent to your phone."
            ),
        )

    password_valid = verify_password(credentials.password, user.password_hash)
    if not password_valid:
        logger.warning(f"Login attempt failed: Invalid password for user {user.id}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/phone or password",
        )

    if user.status.value == "BANNED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is banned",
        )

    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(data={"sub": user.id})

    logger.info(f"Successful login for user {user.id}")
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user,
    )


@router.post("/confirm-phone")
async def confirm_signup_phone(
    body: ConfirmPhoneOtpRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm phone ownership with OTP after password signup."""
    import time
    from app.utils.phone import normalize_phone

    if getattr(current_user, "phone_verified", False):
        return {"message": "Phone already verified", "phone_verified": True}

    phone_normalized = normalize_phone(current_user.phone)
    if not phone_normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No phone number on this account",
        )

    stored = otp_storage.get(phone_normalized)
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP not found. Please request a new code.",
        )
    if time.time() > stored["expires_at"]:
        otp_storage.pop(phone_normalized, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired. Please request a new code.",
        )
    if stored["otp"] != body.otp_code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code",
        )

    otp_storage.pop(phone_normalized, None)
    current_user.phone_verified = True
    await db.flush()
    return {"message": "Phone verified", "phone_verified": True}


@router.post("/confirm-email")
async def confirm_signup_email(
    body: ConfirmEmailOtpRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm email ownership with OTP after password signup."""
    import time

    if getattr(current_user, "email_verified", False):
        return {"message": "Email already verified", "email_verified": True}

    if _is_placeholder_email(current_user.email):
        current_user.email_verified = True
        await db.flush()
        return {"message": "Email verified", "email_verified": True}

    stored = email_otp_storage.get(current_user.email)
    if not stored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP not found. Please request a new code.",
        )
    if time.time() > stored["expires_at"]:
        email_otp_storage.pop(current_user.email, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP expired. Please request a new code.",
        )
    if stored["otp"] != body.otp_code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP code",
        )

    email_otp_storage.pop(current_user.email, None)
    current_user.email_verified = True
    await db.flush()
    return {"message": "Email verified", "email_verified": True}


@router.post("/resend-contact-otp")
async def resend_contact_otp(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Resend phone and/or email verification codes for the logged-in user."""
    import time
    from app.utils.phone import normalize_phone
    from app.services.sms import (
        OtpRateLimitError,
        SmsDeliveryError,
        check_otp_rate_limits,
        send_otp_sms,
        sms_delivery_configured,
    )

    result: dict = {"phone_sent": False, "email_sent": False}

    if not getattr(current_user, "phone_verified", False):
        phone_normalized = normalize_phone(current_user.phone)
        if phone_normalized:
            client_ip = request.client.host if request.client else None
            otp_code = generate_otp()
            otp_storage[phone_normalized] = {
                "otp": otp_code,
                "expires_at": time.time() + 600,
            }
            if sms_delivery_configured():
                try:
                    check_otp_rate_limits(phone=phone_normalized, client_ip=client_ip)
                    await send_otp_sms(phone_normalized, otp_code)
                    result["phone_sent"] = True
                except (SmsDeliveryError, OtpRateLimitError) as exc:
                    raise HTTPException(
                        status_code=status.HTTP_502_BAD_GATEWAY,
                        detail=str(exc) or "Could not send verification code",
                    ) from exc
            elif settings.ENVIRONMENT == "development":
                result["phone_sent"] = True
                result["dev_phone_otp"] = otp_code

    if (
        not getattr(current_user, "email_verified", False)
        and not _is_placeholder_email(current_user.email)
    ):
        email_otp_code = generate_otp()
        email_otp_storage[current_user.email] = {
            "otp": email_otp_code,
            "expires_at": time.time() + 600,
            "user_id": current_user.id,
        }
        sent = send_email_verification_email(current_user.email, email_otp_code)
        result["email_sent"] = sent
        if not sent and settings.ENVIRONMENT == "development":
            result["dev_email_otp"] = email_otp_code
            result["email_sent"] = True

    return result


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
    from app.crud.user_compound_membership import (
        get_verified_compound_ids,
        sync_primary_compound_from_memberships,
    )
    from app.crud.verification import get_user_documents, compute_verification_status
    from app.models.enums import DocumentType, UserStatus, UserRole

    await sync_primary_compound_from_memberships(db, current_user)
    
    # Fetch documents for residents who still need verification so clients can
    # distinguish "needs upload" (UNVERIFIED) vs "under review" (PENDING).
    national_id = None
    contract = None
    docs = None

    if current_user.compound_id is not None:
        docs = await get_user_documents(db, current_user.id, current_user.compound_id)
        national_id = docs[DocumentType.NATIONAL_ID]
        contract = docs[DocumentType.CONTRACT]

    # Platform admins/moderators browse any compound without resident verification
    is_platform_staff = current_user.role in (UserRole.ADMIN, UserRole.MODERATOR)

    verified_compound_ids = sorted(
        await get_verified_compound_ids(db, current_user, persist_inferred=True)
    )
    is_verified_for_current_compound = (
        True
        if is_platform_staff and current_user.compound_id is not None
        else (
            current_user.compound_id is not None
            and current_user.compound_id in verified_compound_ids
        )
    )

    verification_status = (
        "APPROVED"
        if is_platform_staff
        else compute_verification_status(
            current_user,
            national_id,
            contract,
            is_verified_for_current_compound=is_verified_for_current_compound,
        )
    )

    can_post = (
        is_platform_staff
        or (
            current_user.role in (UserRole.RESIDENT, UserRole.USER, None)
            and current_user.status == UserStatus.APPROVED
            and is_verified_for_current_compound
        )
    )
    can_comment = is_platform_staff or is_verified_for_current_compound
    can_create_listing = is_platform_staff or is_verified_for_current_compound
    
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

    from app.services.imported_content_consent import needs_imported_content_choice

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
        needs_profile_setup=bool(getattr(current_user, "profile_setup_required", False)),
        phone_verified=bool(getattr(current_user, "phone_verified", True)),
        email_verified=bool(getattr(current_user, "email_verified", True)),
        needs_contact_verification=_user_needs_contact_verification(current_user),
        creation_source=getattr(current_user, "creation_source", None),
        needs_imported_content_choice=needs_imported_content_choice(current_user),
        imported_content_choice=getattr(current_user, "imported_content_choice", None),
    )


@router.get("/me/imported-content", response_model=ImportedContentSummaryResponse)
async def get_imported_content_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Summary of chat-imported posts/listings for first-login consent."""
    from app.services.imported_content_consent import (
        needs_imported_content_choice,
        summarize_imported_content,
    )

    summary = await summarize_imported_content(db, current_user.id)
    return ImportedContentSummaryResponse(
        needs_choice=needs_imported_content_choice(current_user),
        posts=summary["posts"],
        comments=summary["comments"],
        listings=summary["listings"],
        total=summary["total"],
        choice=getattr(current_user, "imported_content_choice", None),
    )


@router.post("/me/complete-profile", response_model=UserResponse)
async def complete_profile(
    body: CompleteProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Finish invited-account setup: set display name + password.
    Chat-import users must choose KEEP or DISCARD for imported content.
    Email is not required. Pending CHAT_IMPORT compound invites are confirmed.
    """
    from datetime import datetime, timezone

    from app.models.enums import UserRole, UserStatus
    from app.services.chat_import_publish import (
        confirm_all_pending_chat_import_memberships,
    )
    from app.services.imported_content_consent import (
        discard_imported_content,
        needs_imported_content_choice,
    )

    name = body.name.strip()
    if len(name) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name must be at least 2 characters",
        )
    if len(body.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters",
        )

    choice = (body.imported_content_choice or "").strip().upper() or None
    if needs_imported_content_choice(current_user):
        if choice not in ("KEEP", "DISCARD"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Choose whether to keep or discard imported community content",
            )
        if choice == "DISCARD":
            await discard_imported_content(db, current_user)
        current_user.imported_content_choice = choice
        current_user.imported_content_choice_at = datetime.now(timezone.utc)
    elif choice in ("KEEP", "DISCARD") and not current_user.imported_content_choice:
        # Idempotent if client always sends a choice
        if choice == "DISCARD":
            await discard_imported_content(db, current_user)
        current_user.imported_content_choice = choice
        current_user.imported_content_choice_at = datetime.now(timezone.utc)

    current_user.name = name
    current_user.password_hash = get_password_hash(body.password)
    current_user.profile_setup_required = False
    if current_user.role is None:
        current_user.role = UserRole.USER

    # Confirm any pending chat-import invites (admin already reviewed the import).
    invite_compound_ids = await confirm_all_pending_chat_import_memberships(
        db, current_user
    )

    if current_user.status == UserStatus.PENDING_VERIFICATION and invite_compound_ids:
        current_user.status = UserStatus.APPROVED

    await db.commit()
    await db.refresh(current_user)
    return await get_current_user_info(current_user, db)


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
        from app.models.enums import UserRole

        compound = await get_compound_by_id(db, user_update.compound_id)
        if not compound:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Compound not found"
            )

        new_compound_id = user_update.compound_id

        # Admins/staff just switch context — no pending verification membership.
        if current_user.role not in (UserRole.ADMIN, UserRole.MODERATOR):
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
    return await get_current_user_info(current_user=current_user, db=db)


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
    """Compounds the user can switch between (verified + in-progress verification).

    Platform admins/moderators receive all compounds and may switch freely.
    """
    from app.crud.user_compound_membership import get_user_switchable_compounds
    from app.models.enums import UserRole

    if current_user.role in (UserRole.ADMIN, UserRole.MODERATOR):
        from app.crud.compound import get_all_compounds

        compounds, _total = await get_all_compounds(db, skip=0, limit=200)
        return [
            {
                "id": c.id,
                "name": c.name,
                "area": c.area,
                "is_current": c.id == current_user.compound_id,
                "is_verified": True,
                "verification_status": "VERIFIED",
            }
            for c in compounds
        ]

    return await get_user_switchable_compounds(db, current_user)


@router.get("/me/compound-invites")
async def list_compound_invites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pending CHAT_IMPORT compound invites for the current user."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.user_compound_membership import UserCompoundMembership
    from app.schemas.chat_import import CompoundInviteResponse

    result = await db.execute(
        select(UserCompoundMembership)
        .options(selectinload(UserCompoundMembership.compound))
        .where(
            UserCompoundMembership.user_id == current_user.id,
            UserCompoundMembership.verification_status == "PENDING",
            UserCompoundMembership.verification_source == "CHAT_IMPORT",
        )
        .order_by(UserCompoundMembership.created_at.desc())
    )
    memberships = list(result.scalars().all())
    return [
        CompoundInviteResponse(
            compound_id=m.compound_id,
            compound_name=m.compound.name if m.compound else f"Compound {m.compound_id}",
            compound_area=getattr(m.compound, "area", None) if m.compound else None,
            verification_source=m.verification_source or "CHAT_IMPORT",
            created_at=m.created_at,
        )
        for m in memberships
    ]


@router.post("/me/compound-invites/{compound_id}/confirm")
async def confirm_compound_invite(
    compound_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm a pending chat-import compound invite after OTP login."""
    from app.services.chat_import_publish import confirm_chat_import_membership
    from app.schemas.chat_import import CompoundInviteConfirmResponse

    try:
        payload = await confirm_chat_import_membership(db, current_user, compound_id)
        await db.commit()
        await db.refresh(current_user)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc

    return CompoundInviteConfirmResponse(**payload)


@router.post("/me/compound-invites/{compound_id}/decline", status_code=204)
async def decline_compound_invite(
    compound_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Decline a pending chat-import invite (removes the pending membership)."""
    from sqlalchemy import select, delete
    from app.models.user_compound_membership import UserCompoundMembership

    result = await db.execute(
        select(UserCompoundMembership).where(
            UserCompoundMembership.user_id == current_user.id,
            UserCompoundMembership.compound_id == compound_id,
            UserCompoundMembership.verification_status == "PENDING",
            UserCompoundMembership.verification_source == "CHAT_IMPORT",
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending chat-import invite for this compound",
        )
    await db.execute(
        delete(UserCompoundMembership).where(UserCompoundMembership.id == membership.id)
    )
    await db.commit()
    return None


@router.post("/me/switch-compound", response_model=UserResponse)
async def switch_compound(
    request: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Switch active compound — verified neighbourhoods or in-progress verification.

    Platform admins/moderators may switch to any compound without verification.
    """
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

    is_platform_staff = current_user.role in (UserRole.ADMIN, UserRole.MODERATOR)

    if not is_platform_staff and current_user.role not in (UserRole.RESIDENT, UserRole.USER, None):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only residents can switch neighbourhoods",
        )

    if not is_platform_staff and current_user.status != UserStatus.APPROVED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Complete account verification before switching neighbourhoods.",
        )

    if not is_platform_staff and not await user_can_switch_to_compound(
        db, current_user, compound_id
    ):
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


@router.get("/me/compound/sample-content", response_model=SampleContentStatusResponse)
async def get_my_compound_sample_content(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Whether sample posts/listings are loaded for the admin's current compound."""
    from app.crud.compound import get_compound_by_id
    from app.models.enums import UserRole
    from app.services.compound_demo import get_compound_demo_status

    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    if not current_user.compound_id:
        return SampleContentStatusResponse(
            loaded=False,
            can_load=False,
            reason="Select a neighbourhood before loading sample content.",
        )

    compound = await get_compound_by_id(db, current_user.compound_id)
    if not compound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compound not found")

    status_data = await get_compound_demo_status(db, compound)
    return SampleContentStatusResponse(
        loaded=status_data["active"],
        can_load=status_data["can_seed"],
        reason=status_data["reason"],
    )


@router.post("/me/compound/sample-content", response_model=SampleContentActionResponse)
async def load_my_compound_sample_content(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Load sample posts and listings into the admin's current compound."""
    from app.crud.compound import get_compound_by_id
    from app.models.enums import UserRole
    from app.models.moderation import AuditLog
    from app.services.compound_demo import seed_compound_demo_for_compound

    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    if not current_user.compound_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select a neighbourhood before loading sample content.",
        )

    compound = await get_compound_by_id(db, current_user.compound_id)
    if not compound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compound not found")

    try:
        await seed_compound_demo_for_compound(db, compound)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    db.add(
        AuditLog(
            actor_id=current_user.id,
            event_type="compound.sample_content_load",
            entity_type="COMPOUND",
            entity_id=str(compound.id),
            data={"compound_slug": compound.compound_id},
        )
    )
    await db.commit()

    return SampleContentActionResponse(
        message=f"Sample content loaded for {compound.name}.",
        loaded=True,
    )


@router.delete("/me/compound/sample-content", response_model=SampleContentActionResponse)
async def unload_my_compound_sample_content(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove sample posts and listings from the admin's current compound."""
    from app.crud.compound import get_compound_by_id
    from app.models.enums import UserRole
    from app.models.moderation import AuditLog
    from app.services.compound_demo import cleanup_compound_demo_for_compound

    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    if not current_user.compound_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Select a neighbourhood before unloading sample content.",
        )

    compound = await get_compound_by_id(db, current_user.compound_id)
    if not compound:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compound not found")

    result = await cleanup_compound_demo_for_compound(db, compound)

    db.add(
        AuditLog(
            actor_id=current_user.id,
            event_type="compound.sample_content_unload",
            entity_type="COMPOUND",
            entity_id=str(compound.id),
            data={
                "compound_slug": compound.compound_id,
                "removed_users": result["removed_users"],
            },
        )
    )
    await db.commit()

    if result["removed_users"]:
        message = f"Sample content removed from {compound.name}."
    else:
        message = f"No sample content was loaded for {compound.name}."

    return SampleContentActionResponse(message=message, loaded=False)


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


@router.post("/reset-password-phone")
async def reset_password_phone(
    request: ResetPasswordPhoneRequest,
    db: AsyncSession = Depends(get_db),
):
    """Set a new password after verifying a phone OTP. Does not create accounts."""
    from app.utils.phone import normalize_phone

    phone_normalized = normalize_phone(request.phone)
    if not phone_normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number",
        )

    _consume_phone_otp(phone_normalized, request.otp_code)

    user = await get_user_by_phone(db, phone_normalized)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired code. Please try again.",
        )
    if user.status.value == "BANNED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is banned",
        )

    user.password_hash = get_password_hash(request.new_password)
    user.phone_verified = True
    await db.commit()

    if not _is_placeholder_email(user.email):
        send_password_reset_confirmation_email(user.email)

    logger.info("Password reset via phone OTP for user %s", user.id)
    return {
        "message": "Password has been reset successfully. You can now login with your new password."
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
