from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from app.models.enums import UserRole
from app.schemas.user import UserResponse


class UserSignup(BaseModel):
    name: str
    phone: str = Field(..., min_length=7, max_length=32)
    password: str
    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    referral_code: Optional[str] = Field(
        default=None, min_length=4, max_length=64
    )


class UserLogin(BaseModel):
    """Password login. `email` accepts an email address or a mobile phone number."""

    email: str = Field(..., min_length=3, max_length=255)
    password: str


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
    token: str
    new_password: str


class ResetPasswordPhoneRequest(BaseModel):
    phone: str
    otp_code: str = Field(..., min_length=4, max_length=12)
    new_password: str = Field(..., min_length=6)


class PhoneAuthStartRequest(BaseModel):
    phone: str


class PhoneAuthStartResponse(BaseModel):
    message: str
    otp_code: Optional[str] = None  # Only in dev/staging


class PhoneAuthVerifyRequest(BaseModel):
    phone: str
    otp_code: str
    name: Optional[str] = None  # Required for new users
    referral_code: Optional[str] = Field(
        default=None, min_length=4, max_length=64
    )


class ConfirmPhoneOtpRequest(BaseModel):
    otp_code: str = Field(..., min_length=4, max_length=12)


class ConfirmEmailOtpRequest(BaseModel):
    otp_code: str = Field(..., min_length=4, max_length=12)
