from fastapi import FastAPI, UploadFile, File, HTTPException, status, Depends, Query, Request
from typing import Optional
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
import logging
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.models.user import User

# Import all models to ensure SQLAlchemy relationships are properly set up
from app.models import notification  # noqa: F401
from app.models import review  # noqa: F401
from app.models import user  # noqa: F401
from app.models import listing  # noqa: F401
from app.models import post  # noqa: F401
from app.models import compound  # noqa: F401
from app.models import service_provider  # noqa: F401
from app.models import compound_moderator  # noqa: F401
from app.models import service_category  # noqa: F401
from app.models import user_compound_membership  # noqa: F401

from app.api import (
    auth,
    compounds,
    verification,
    community,
    marketplace,
    promotions,
    admin,
    webhooks,
    saved_listings,
    messages,
    notifications,
    search,
    reviews,
    providers,
    moderators,
)
from app.api import service_categories, reports, admin_reviews, moderator, saved_posts
from app.services.storage import (
    use_local_storage,
    save_file_locally,
    get_local_file_path,
    LOCAL_STORAGE_DIR,
)

app = FastAPI(
    title="eljiran.com API",
    description="Verified neighborhood community + marketplace",
    version="1.0.0",
)

# CORS middleware - must be added before other middleware
# Handle all origins in development, or specific origins in production
# Ensure localhost:3001 is included for Next.js dev server fallback
cors_origins = settings.cors_origin_list if settings.cors_origin_list else ["*"]
# Add localhost:3001 if not already present (for Next.js port fallback)
if cors_origins != ["*"] and "http://localhost:3001" not in cors_origins:
    cors_origins.append("http://localhost:3001")

# Debug: Log CORS origins on startup
logger = logging.getLogger(__name__)
logger.info(f"CORS allowed origins: {cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],  # Use wildcard to allow all methods including OPTIONS
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(compounds.router, prefix="/api/compounds", tags=["compounds"])
app.include_router(
    verification.router, prefix="/api/verification", tags=["verification"]
)
app.include_router(community.router, prefix="/api", tags=["community"])
app.include_router(marketplace.router, prefix="/api/listings", tags=["marketplace"])
app.include_router(promotions.router, prefix="/api/promotions", tags=["promotions"])
app.include_router(saved_listings.router, prefix="/api", tags=["saved-listings"])
app.include_router(saved_posts.router, prefix="/api", tags=["saved-posts"])
app.include_router(messages.router, prefix="/api", tags=["messages"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(reviews.router, prefix="/api", tags=["reviews"])
app.include_router(providers.router, prefix="/api/providers", tags=["providers"])
app.include_router(moderators.router, prefix="/api/moderators", tags=["moderators"])
app.include_router(service_categories.router, prefix="/api/service-categories", tags=["service-categories"])
app.include_router(admin_reviews.router, prefix="/api/admin", tags=["admin-reviews"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(moderator.router, prefix="/api/moderator", tags=["moderator"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])

# Mount static files for local storage (development only)
if use_local_storage():
    # Serve uploaded files
    @app.get("/api/uploads/{file_path:path}")
    async def serve_uploaded_file(file_path: str):
        """Serve uploaded files from local storage."""
        import logging
        logger = logging.getLogger(__name__)

        # Resolve via helper so legacy unpadded month URLs still work
        full_path = get_local_file_path(f"/api/uploads/{file_path}")
        if full_path is None:
            full_path = LOCAL_STORAGE_DIR / file_path

        logger.info(
            f"Serving file: {file_path}, full_path: {full_path}, exists: {full_path.exists()}"
        )

        resolved_storage = LOCAL_STORAGE_DIR.resolve()
        try:
            full_resolved = full_path.resolve()
        except FileNotFoundError:
            full_resolved = full_path

        if not full_path.exists() or not str(full_resolved).startswith(str(resolved_storage)):
            logger.warning(
                f"File not found: {full_path}, LOCAL_STORAGE_DIR: {resolved_storage}"
            )
            raise HTTPException(status_code=404, detail="File not found")

        return FileResponse(full_path)

    # Handle file uploads for local storage
    @app.post("/api/uploads/upload")
    async def upload_file(
        file: UploadFile = File(...),
        file_path: Optional[str] = Query(None),
    ):
        """Upload file to local storage (development only)."""
        if not use_local_storage():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Local storage is not enabled",
            )

        # Validate file type
        ALLOWED_TYPES = {
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp",
            "application/pdf",
        }
        if file.content_type and file.content_type.lower() not in [
            t.lower() for t in ALLOWED_TYPES
        ]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_TYPES)}",
            )

        # Read file content
        content = await file.read()

        # Validate file size (15MB max for documents, 5MB for images)
        MAX_SIZE = 15 * 1024 * 1024  # 15MB - increased to accommodate multi-page scanned contracts
        if len(content) > MAX_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum size: {MAX_SIZE / (1024*1024):.0f}MB",
            )

        # Determine file path
        if file_path:
            save_path = LOCAL_STORAGE_DIR / file_path
        else:
            from app.services.storage import generate_local_file_path

            save_path, _ = generate_local_file_path(file.filename or "file")

        # Save file
        save_file_locally(save_path, content)

        # Return the file URL (absolute)
        relative_path = save_path.relative_to(LOCAL_STORAGE_DIR)
        base_url = settings.BACKEND_URL.rstrip("/")
        file_url = f"{base_url}/api/uploads/{relative_path}"

        return {"file_url": file_url, "message": "File uploaded successfully"}


async def _handle_s3_upload(
    *,
    content: bytes,
    object_key: str,
    content_type: Optional[str],
    user_id: int,
) -> dict:
    """Shared S3 upload logic for POST (multipart) and PUT (raw body)."""
    from app.services.s3 import upload_object_bytes
    from app.services.storage import require_s3_configured

    require_s3_configured()

    ALLOWED_TYPES = {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "application/pdf",
    }
    mime = (content_type or "").lower()
    if mime and mime not in [t.lower() for t in ALLOWED_TYPES]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_TYPES)}",
        )

    MAX_SIZE = 15 * 1024 * 1024
    if len(content) > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {MAX_SIZE / (1024 * 1024):.0f}MB",
        )

    try:
        file_url = upload_object_bytes(
            object_key, content, mime or "application/octet-stream"
        )
    except ValueError as e:
        logger.warning(
            "S3 upload rejected (validation): user_id=%s object_key=%s detail=%s",
            user_id,
            object_key,
            e,
        )
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(
            "S3 upload failed: user_id=%s object_key=%s content_type=%s size_bytes=%s error=%s",
            user_id,
            object_key,
            mime,
            len(content),
            e,
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload to storage: {e}",
        )

    logger.info(
        "S3 upload succeeded: user_id=%s object_key=%s file_url=%s",
        user_id,
        object_key,
        file_url,
    )
    return {"file_url": file_url, "message": "File uploaded successfully"}


@app.post("/api/uploads/s3")
async def upload_file_to_s3_post(
    file: UploadFile = File(...),
    object_key: str = Query(..., description="S3 object key from presign"),
    content_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Upload via API → S3 (multipart POST)."""
    content = await file.read()
    mime = content_type or file.content_type
    return await _handle_s3_upload(
        content=content,
        object_key=object_key,
        content_type=mime,
        user_id=current_user.id,
    )


@app.put("/api/uploads/s3")
async def upload_file_to_s3_put(
    request: Request,
    object_key: str = Query(..., description="S3 object key from presign"),
    content_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Upload via API → S3 (raw PUT body — legacy clients)."""
    content = await request.body()
    mime = content_type or request.headers.get("content-type")
    return await _handle_s3_upload(
        content=content,
        object_key=object_key,
        content_type=mime,
        user_id=current_user.id,
    )


# General presign endpoint for uploads (used by mobile)
@app.post("/api/uploads/presign")
async def get_upload_presigned_url(
    file_name: str,
    file_type: str,
    current_user: User = Depends(get_current_user),
):
    """Get a pre-signed URL for uploading files (general purpose)."""
    from app.services.s3 import generate_presigned_put_url
    from app.schemas.verification import PresignResponse
    
    # Validate file type
    ALLOWED_TYPES = {
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "application/pdf",
    }
    if file_type.lower() not in [t.lower() for t in ALLOWED_TYPES]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_TYPES)}"
        )
    
    try:
        presigned_url, file_url = generate_presigned_put_url(
            file_name=file_name,
            file_type=file_type,
            folder="uploads",
        )
        return PresignResponse(
            presigned_url=presigned_url,
            file_url=file_url
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate presigned URL: {str(e)}"
        )


@app.get("/api/uploads/signed-url")
async def get_upload_signed_url(
    file_url: str = Query(..., description="Stored file URL"),
    current_user: User = Depends(get_current_user),
):
    """Short-lived download URL for private S3 (or local) objects."""
    from app.services.s3 import generate_presigned_get_url

    if not file_url.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="file_url is required")
    try:
        signed = generate_presigned_get_url(file_url.strip())
        return {"url": signed, "expires_in": 3600}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate signed URL: {e}",
        )


@app.get("/")
async def root():
    return {"message": "eljiran.com API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
