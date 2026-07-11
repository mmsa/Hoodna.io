from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, ExpiredSignatureError, jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token."""
    to_encode = data.copy()
    # Convert 'sub' to string if it's an integer (python-jose requires string)
    if "sub" in to_encode and isinstance(to_encode["sub"], int):
        to_encode["sub"] = str(to_encode["sub"])
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "access"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_refresh_token(data: dict) -> str:
    """Create a JWT refresh token."""
    to_encode = data.copy()
    # Convert 'sub' to string if it's an integer (python-jose requires string)
    if "sub" in to_encode and isinstance(to_encode["sub"], int):
        to_encode["sub"] = str(to_encode["sub"])
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    """Decode and verify a JWT token."""
    import logging
    logger = logging.getLogger(__name__)
    
    if not token or not token.strip():
        logger.warning("Empty token provided")
        return None
    
    try:
        payload = jwt.decode(token.strip(), settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except ExpiredSignatureError:
        logger.warning("Token has expired")
        return None
    except JWTError as e:
        logger.warning(f"JWT decode error: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error decoding token: {e}")
        return None


def create_password_reset_token(data: dict) -> str:
    """Create a JWT password reset token (expires in 1 hour)."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=1)
    # Ensure 'sub' is a string for JWT compatibility
    if "sub" in to_encode and isinstance(to_encode["sub"], int):
        to_encode["sub"] = str(to_encode["sub"])
    to_encode.update({"exp": expire, "type": "password_reset"})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def create_upload_token(user_id: int, object_key: str, expires_minutes: int = 15) -> str:
    """Short-lived token so browser uploads work without Bearer header (cross-origin fetch)."""
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode = {
        "sub": str(user_id),
        "object_key": object_key,
        "exp": expire,
        "type": "upload",
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_upload_token(token: str, object_key: str) -> Optional[int]:
    """Return user_id if upload token is valid for this object key."""
    payload = decode_token(token)
    if payload is None or payload.get("type") != "upload":
        return None
    if payload.get("object_key") != object_key:
        return None
    sub = payload.get("sub")
    if sub is None:
        return None
    try:
        return int(sub)
    except (TypeError, ValueError):
        return None


def create_download_token(user_id: int, file_url: str, expires_minutes: int = 15) -> str:
    """Short-lived token for viewing a private file via API proxy (no S3 presign)."""
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode = {
        "sub": str(user_id),
        "file_url": file_url,
        "exp": expire,
        "type": "download",
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_download_token(token: str, file_url: str) -> Optional[int]:
    """Return user_id if download token is valid for this file URL."""
    payload = decode_token(token)
    if payload is None or payload.get("type") != "download":
        return None
    if payload.get("file_url") != file_url:
        return None
    sub = payload.get("sub")
    if sub is None:
        return None
    try:
        return int(sub)
    except (TypeError, ValueError):
        return None

