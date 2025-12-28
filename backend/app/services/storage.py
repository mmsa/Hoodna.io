"""
Storage service that supports both local file storage (development) and S3 (production).
Automatically uses local storage when AWS credentials are not configured.
"""
import os
import uuid
from pathlib import Path
from typing import Optional, Tuple
from app.core.config import settings

# Local storage directory
LOCAL_STORAGE_DIR = Path("uploads")
LOCAL_STORAGE_DIR.mkdir(exist_ok=True)


def use_local_storage() -> bool:
    """Determine if we should use local storage instead of S3."""
    # Use local storage if AWS credentials are not configured
    return not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY


def generate_local_file_path(file_name: str) -> Tuple[Path, str]:
    """
    Generate a local file path and URL path for a file.
    Returns: (file_path, file_url_path)
    file_url_path is relative (e.g., /api/uploads/2024/12/filename.ext)
    """
    # Generate unique file name
    file_extension = file_name.split('.')[-1] if '.' in file_name else ''
    unique_file_name = f"{uuid.uuid4()}.{file_extension}" if file_extension else str(uuid.uuid4())
    
    # Create subdirectory structure (e.g., uploads/2024/12/)
    from datetime import datetime
    now = datetime.now()
    subdir = LOCAL_STORAGE_DIR / str(now.year) / str(now.month).zfill(2)
    subdir.mkdir(parents=True, exist_ok=True)
    
    file_path = subdir / unique_file_name
    # URL path relative to uploads directory (will be made absolute in s3.py)
    file_url_path = f"/api/uploads/{now.year}/{now.month}/{unique_file_name}"
    
    return file_path, file_url_path


def save_file_locally(file_path: Path, file_content: bytes) -> None:
    """Save file content to local storage."""
    file_path.parent.mkdir(parents=True, exist_ok=True)
    with open(file_path, 'wb') as f:
        f.write(file_content)


def get_local_file_path(file_url: str) -> Optional[Path]:
    """
    Convert a file URL to a local file path.
    URL format: /api/uploads/2024/12/filename.ext
    """
    if not file_url.startswith('/api/uploads/'):
        return None
    
    # Remove /api/uploads/ prefix
    relative_path = file_url.replace('/api/uploads/', '')
    return LOCAL_STORAGE_DIR / relative_path

