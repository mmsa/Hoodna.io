from fastapi import FastAPI, UploadFile, File, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path
from app.core.config import settings
from app.api import auth, compounds, verification, community, marketplace, promotions, admin, webhooks
from app.services.storage import use_local_storage, save_file_locally, get_local_file_path, LOCAL_STORAGE_DIR

app = FastAPI(
    title="Hoodna.io API",
    description="Verified neighborhood community + marketplace",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(compounds.router, prefix="/api/compounds", tags=["compounds"])
app.include_router(verification.router, prefix="/api/verification", tags=["verification"])
app.include_router(community.router, prefix="/api", tags=["community"])
app.include_router(marketplace.router, prefix="/api/listings", tags=["marketplace"])
app.include_router(promotions.router, prefix="/api/promotions", tags=["promotions"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])

# Mount static files for local storage (development only)
if use_local_storage():
    # Serve uploaded files
    @app.get("/api/uploads/{file_path:path}")
    async def serve_uploaded_file(file_path: str):
        """Serve uploaded files from local storage."""
        full_path = LOCAL_STORAGE_DIR / file_path
        if not full_path.exists() or not str(full_path).startswith(str(LOCAL_STORAGE_DIR)):
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(full_path)
    
    # Handle file uploads for local storage
    @app.post("/api/uploads/upload")
    async def upload_file(
        file: UploadFile = File(...),
        file_path: str = None,
    ):
        """Upload file to local storage (development only)."""
        if not use_local_storage():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Local storage is not enabled"
            )
        
        # Read file content
        content = await file.read()
        
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
        base_url = settings.FRONTEND_URL.replace(':3000', ':8000')  # Backend URL
        file_url = f"{base_url}/api/uploads/{relative_path}"
        
        return {"file_url": file_url, "message": "File uploaded successfully"}


@app.get("/")
async def root():
    return {"message": "Hoodna.io API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}

