from pydantic import BaseModel, EmailStr
from typing import Optional
from app.models.enums import UserRole


class UserSignup(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    role: UserRole


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class PhoneAuthStartRequest(BaseModel):
    phone: str


class PhoneAuthStartResponse(BaseModel):
    message: str
    otp_code: Optional[str] = None  # Only in dev/staging


class PhoneAuthVerifyRequest(BaseModel):
    phone: str
    otp_code: str
    name: Optional[str] = None  # Required for new users

