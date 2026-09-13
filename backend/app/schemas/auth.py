from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models.enums import UserRole
from app.schemas.user import UserResponse

# Server-side password policy. Clients also validate, but this is the boundary
# that actually protects accounts.
MIN_PASSWORD_LENGTH = 8
# bcrypt silently truncates beyond 72 bytes, so reject longer input outright
# instead of accepting a password that is not fully checked at login.
MAX_PASSWORD_LENGTH = 72


def _validate_password(value: str) -> str:
    if len(value.encode("utf-8")) > MAX_PASSWORD_LENGTH:
        raise ValueError(
            f"Password must be {MAX_PASSWORD_LENGTH} characters or fewer"
        )
    if len(value) < MIN_PASSWORD_LENGTH:
        raise ValueError(
            f"Password must be at least {MIN_PASSWORD_LENGTH} characters"
        )
    return value


class AttributionIn(BaseModel):
    source: Optional[str] = Field(default=None, max_length=100)
    medium: Optional[str] = Field(default=None, max_length=100)
    campaign: Optional[str] = Field(default=None, max_length=100)
    content: Optional[str] = Field(default=None, max_length=100)
    term: Optional[str] = Field(default=None, max_length=100)
    referrer_host: Optional[str] = Field(default=None, max_length=100)
    landing_path: Optional[str] = Field(default=None, max_length=100)


class UserSignup(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    phone: str = Field(..., min_length=7, max_length=32)
    password: str
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    referral_code: Optional[str] = Field(
        default=None, min_length=4, max_length=64
    )
    platform: Optional[Literal["web", "ios", "android"]] = None
    attribution: Optional[AttributionIn] = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("Name must be at least 2 characters")
        return cleaned

    @field_validator("password")
    @classmethod
    def check_password(cls, value: str) -> str:
        return _validate_password(value)


class UserLogin(BaseModel):
    """Password login. `email` accepts an email address or a mobile phone number."""

    email: str = Field(..., min_length=3, max_length=255)
    # Not length-validated against the policy: existing accounts predate it and
    # a login error must not reveal the policy. Capped to bound hashing cost.
    password: str = Field(..., max_length=1024)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: Optional[UserResponse] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=16, max_length=4096)
    new_password: str

    @field_validator("new_password")
    @classmethod
    def check_password(cls, value: str) -> str:
        return _validate_password(value)


class ResetPasswordPhoneRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=32)
    otp_code: str = Field(..., min_length=4, max_length=12)
    new_password: str

    @field_validator("new_password")
    @classmethod
    def check_password(cls, value: str) -> str:
        return _validate_password(value)


class PhoneAuthStartRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=32)


class PhoneAuthStartResponse(BaseModel):
    message: str
    otp_code: Optional[str] = None  # Only in dev/staging


class PhoneAuthVerifyRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=32)
    otp_code: str = Field(..., min_length=4, max_length=12)
    name: Optional[str] = Field(default=None, max_length=80)  # Required for new users
    referral_code: Optional[str] = Field(
        default=None, min_length=4, max_length=64
    )
    platform: Optional[Literal["web", "ios", "android"]] = None
    attribution: Optional[AttributionIn] = None


class ConfirmPhoneOtpRequest(BaseModel):
    otp_code: str = Field(..., min_length=4, max_length=12)


class ConfirmEmailOtpRequest(BaseModel):
    otp_code: str = Field(..., min_length=4, max_length=12)
