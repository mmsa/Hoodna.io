"""
Storage service that supports both local file storage (development) and S3 (production).
"""
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from typing import Optional, Tuple
from app.core.config import settings
from app.services.storage import use_local_storage, generate_local_file_path, get_local_file_path, LOCAL_STORAGE_DIR
import uuid
from datetime import timedelta


def get_s3_client():
    """Get S3 client, supporting both AWS S3 and S3-compatible services."""
    config = Config(
        signature_version='s3v4',
        s3={'addressing_style': 'path'} if settings.S3_ENDPOINT_URL else None
    )
    
    client_kwargs = {
        'aws_access_key_id': settings.AWS_ACCESS_KEY_ID,
        'aws_secret_access_key': settings.AWS_SECRET_ACCESS_KEY,
        'region_name': settings.AWS_REGION,
        'config': config,
    }
    
    if settings.S3_ENDPOINT_URL:
        client_kwargs['endpoint_url'] = settings.S3_ENDPOINT_URL
    
    return boto3.client('s3', **client_kwargs)


def generate_presigned_put_url(
    file_name: str,
    file_type: str,
    expiration: int = 3600
) -> tuple[str, str]:
    """
    Generate a pre-signed URL for uploading a file.
    Uses local storage if AWS credentials are not configured, otherwise uses S3.
    Returns: (presigned_url, file_url)
    """
    # Use local storage if AWS credentials are not configured
    if use_local_storage():
        # For local storage, return a direct upload endpoint URL
        file_path, file_url_path = generate_local_file_path(file_name)
        # The presigned_url will be the upload endpoint
        base_url = settings.BACKEND_URL.rstrip("/")
        relative_path = file_path.relative_to(LOCAL_STORAGE_DIR)
        presigned_url = f"{base_url}/api/uploads/upload?file_path={relative_path}"
        # Make file_url absolute
        file_url = f"{base_url}{file_url_path}"
        return presigned_url, file_url
    
    # Use S3
    s3_client = get_s3_client()
    
    # Generate unique file name
    file_extension = file_name.split('.')[-1] if '.' in file_name else ''
    unique_file_name = f"{uuid.uuid4()}.{file_extension}" if file_extension else str(uuid.uuid4())
    object_key = f"uploads/{unique_file_name}"
    
    # Generate file URL
    if settings.S3_ENDPOINT_URL:
        # S3-compatible service
        file_url = f"{settings.S3_ENDPOINT_URL}/{settings.S3_BUCKET_NAME}/{object_key}"
    else:
        # AWS S3
        file_url = f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{object_key}"
    
    try:
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': settings.S3_BUCKET_NAME,
                'Key': object_key,
                'ContentType': file_type,
            },
            ExpiresIn=expiration
        )
        return presigned_url, file_url
    except ClientError as e:
        raise Exception(f"Error generating presigned URL: {str(e)}")

