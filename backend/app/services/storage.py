"""
Storage service that supports both local file storage (development) and S3 (production).
Automatically uses local storage when AWS credentials are not configured.
"""
import os
import uuid
from pathlib import Path
from typing import Optional, Tuple
from app.core.config import settings

# Local storage directory - use absolute path to avoid issues with working directory
from pathlib import Path as PathLib
import os
LOCAL_STORAGE_DIR = PathLib(os.path.abspath("uploads"))
LOCAL_STORAGE_DIR.mkdir(exist_ok=True, parents=True)


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
    
    # Create subdirectory structure (e.g., uploads/2024/12/) — keep URL and disk in sync
    from datetime import datetime
    now = datetime.now()
    year = str(now.year)
    month = str(now.month).zfill(2)
    subdir = LOCAL_STORAGE_DIR / year / month
    subdir.mkdir(parents=True, exist_ok=True)
    
    file_path = subdir / unique_file_name
    # URL path must match on-disk path (zero-padded month)
    file_url_path = f"/api/uploads/{year}/{month}/{unique_file_name}"
    
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
    Also resolves legacy unpadded month paths (2024/7 → 2024/07).
    """
    # Strip absolute origin if present
    if "://" in file_url:
        from urllib.parse import urlparse
        file_url = urlparse(file_url).path

    if not file_url.startswith('/api/uploads/'):
        return None
    
    # Remove /api/uploads/ prefix
    relative_path = file_url.replace('/api/uploads/', '', 1).lstrip('/')
    primary = LOCAL_STORAGE_DIR / relative_path
    if primary.exists():
        return primary

    # Legacy bug: URL used month without zero-padding while disk used zfill(2)
    parts = relative_path.split('/')
    if len(parts) >= 3 and parts[1].isdigit() and len(parts[1]) <= 2:
        padded = '/'.join([parts[0], parts[1].zfill(2), *parts[2:]])
        alt = LOCAL_STORAGE_DIR / padded
        if alt.exists():
            return alt
        unpadded = '/'.join([parts[0], str(int(parts[1])), *parts[2:]])
        alt2 = LOCAL_STORAGE_DIR / unpadded
        if alt2.exists():
            return alt2

    return primary

