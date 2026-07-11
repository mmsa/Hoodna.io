"""
Storage service that supports both local file storage (development) and S3 (production).
"""
import re
import uuid
from typing import Optional
from urllib.parse import urlparse, unquote

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import settings
from app.services.storage import (
    use_local_storage,
    generate_local_file_path,
    LOCAL_STORAGE_DIR,
    require_s3_configured,
)


def get_s3_client():
    """Get S3 client, supporting both AWS S3 and S3-compatible services."""
    config = Config(
        signature_version="s3v4",
        s3={"addressing_style": "path"} if settings.S3_ENDPOINT_URL else None,
    )

    client_kwargs = {
        "aws_access_key_id": settings.AWS_ACCESS_KEY_ID,
        "aws_secret_access_key": settings.AWS_SECRET_ACCESS_KEY,
        "region_name": settings.AWS_REGION,
        "config": config,
    }

    if settings.S3_ENDPOINT_URL:
        client_kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL

    return boto3.client("s3", **client_kwargs)


def is_s3_file_url(file_url: str) -> bool:
    """True when URL points at our configured S3 bucket (or generic s3.amazonaws.com)."""
    if not file_url:
        return False
    if file_url.startswith("s3://"):
        return True
    host = urlparse(file_url).netloc.lower()
    bucket = (settings.S3_BUCKET_NAME or "").lower()
    if bucket and bucket in host:
        return True
    return "amazonaws.com" in host


def extract_s3_object_key(file_url: str) -> Optional[str]:
    """Extract object key from a stored S3 HTTPS or s3:// URL."""
    if not file_url:
        return None
    if file_url.startswith("s3://"):
        without = file_url[5:]
        parts = without.split("/", 1)
        return parts[1] if len(parts) == 2 else None

    parsed = urlparse(file_url)
    path = unquote(parsed.path.lstrip("/"))

    bucket = settings.S3_BUCKET_NAME or ""
    if bucket and path.startswith(f"{bucket}/"):
        return path[len(bucket) + 1 :]

    match = re.search(
        r"((?:uploads|verification|listings|providers|moderators)/.+)$",
        path,
    )
    return match.group(1) if match else path or None


def generate_presigned_get_url(file_url: str, expiration: int = 3600) -> str:
    """
    Return a temporary URL that can be opened in a browser.
    Local storage URLs are returned as-is (made absolute when needed).
    """
    if use_local_storage() or not is_s3_file_url(file_url):
        if file_url.startswith("/"):
            return f"{settings.BACKEND_URL.rstrip('/')}{file_url}"
        return file_url

    key = extract_s3_object_key(file_url)
    if not key:
        return file_url

    s3_client = get_s3_client()
    try:
        return s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET_NAME, "Key": key},
            ExpiresIn=expiration,
        )
    except ClientError as e:
        raise Exception(f"Error generating download URL: {str(e)}") from e


def download_file_bytes(file_url: str) -> bytes:
    """Download file bytes from local storage or private S3."""
    if use_local_storage() or not is_s3_file_url(file_url):
        from app.services.storage import get_local_file_path
        import httpx

        path = file_url if file_url.startswith("/") else urlparse(file_url).path
        local = get_local_file_path(path)
        if local and local.exists():
            return local.read_bytes()

        url = file_url
        if url.startswith("/"):
            url = f"{settings.BACKEND_URL.rstrip('/')}{url}"
        with httpx.Client(timeout=30.0) as client:
            response = client.get(url)
            response.raise_for_status()
            return response.content

    key = extract_s3_object_key(file_url)
    if not key:
        raise FileNotFoundError(f"Could not parse S3 key from {file_url}")
    s3_client = get_s3_client()
    obj = s3_client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
    return obj["Body"].read()


def _normalize_content_type(file_name: str, file_type: str) -> str:
    """Align MIME type with extension so presign signature matches browser PUT."""
    ext_to_mime = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "webp": "image/webp",
        "pdf": "application/pdf",
    }
    normalized = (file_type or "").strip().lower()
    if normalized and normalized != "application/octet-stream":
        return normalized
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    return ext_to_mime.get(ext, normalized or "application/octet-stream")


def generate_presigned_put_url(
    file_name: str,
    file_type: str,
    expiration: int = 3600,
    folder: str = "uploads",
) -> tuple[str, str]:
    """
    Generate a pre-signed URL for uploading a file.
    Uses local storage if AWS credentials are not configured (dev only),
    otherwise uses S3. folder is the S3 key prefix (e.g. verification, listings).
    Returns: (presigned_url, file_url)
    """
    safe_folder = (folder or "uploads").strip("/").replace("..", "") or "uploads"

    if use_local_storage():
        file_path, file_url_path = generate_local_file_path(file_name)
        base_url = settings.BACKEND_URL.rstrip("/")
        relative_path = file_path.relative_to(LOCAL_STORAGE_DIR)
        # Keep local path under folder/ for consistency
        presigned_url = f"{base_url}/api/uploads/upload?file_path={relative_path}"
        file_url = f"{base_url}{file_url_path}"
        return presigned_url, file_url

    require_s3_configured()
    s3_client = get_s3_client()
    content_type = _normalize_content_type(file_name, file_type)

    file_extension = file_name.split(".")[-1] if "." in file_name else ""
    unique_file_name = (
        f"{uuid.uuid4()}.{file_extension}" if file_extension else str(uuid.uuid4())
    )
    object_key = f"{safe_folder}/{unique_file_name}"

    if settings.S3_ENDPOINT_URL:
        file_url = f"{settings.S3_ENDPOINT_URL}/{settings.S3_BUCKET_NAME}/{object_key}"
    else:
        file_url = (
            f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}"
            f".amazonaws.com/{object_key}"
        )

    try:
        presigned_url = s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": settings.S3_BUCKET_NAME,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=expiration,
        )
        return presigned_url, file_url
    except ClientError as e:
        raise Exception(f"Error generating presigned URL: {str(e)}") from e


def sign_file_urls(urls: list[str] | None, expiration: int = 3600) -> list[str]:
    """Replace stored S3 URLs with temporary signed GET URLs (passthrough for local)."""
    if not urls:
        return []
    signed: list[str] = []
    for url in urls:
        if not url:
            continue
        try:
            signed.append(generate_presigned_get_url(url, expiration=expiration))
        except Exception:
            signed.append(url)
    return signed
