from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import auth, compounds, verification, community, marketplace, promotions, admin, webhooks

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


@app.get("/")
async def root():
    return {"message": "Hoodna.io API", "version": "1.0.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}

