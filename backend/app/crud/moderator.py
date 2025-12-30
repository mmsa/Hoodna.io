from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.compound_moderator import CompoundModeratorProfile, CompoundModeratorDocument
from app.models.user import User
from app.models.enums import UserRole, ModeratorStatus
from app.schemas.moderator import CompoundModeratorProfileCreate, CompoundModeratorProfileUpdate
from typing import Optional


async def get_moderator_profile(
    db: AsyncSession,
    user_id: int
) -> Optional[CompoundModeratorProfile]:
    """Get moderator profile by user_id."""
    result = await db.execute(
        select(CompoundModeratorProfile).where(CompoundModeratorProfile.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_moderator_profile(
    db: AsyncSession,
    user_id: int,
    profile_data: CompoundModeratorProfileCreate
) -> CompoundModeratorProfile:
    """Create a new moderator profile and set user role."""
    # Check if profile already exists
    existing = await get_moderator_profile(db, user_id)
    if existing:
        raise ValueError("Moderator profile already exists for this user")
    
    # Get user and update role
    user = await db.get(User, user_id)
    if not user:
        raise ValueError("User not found")
    
    profile = CompoundModeratorProfile(
        user_id=user_id,
        compound_id=profile_data.compound_id,
        role_title=profile_data.role_title,
        moderator_status=ModeratorStatus.DRAFT
    )
    
    # Set user role
    user.role = UserRole.COMPOUND_MOD
    
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


async def update_moderator_profile(
    db: AsyncSession,
    user_id: int,
    profile_data: CompoundModeratorProfileUpdate
) -> Optional[CompoundModeratorProfile]:
    """Update moderator profile (only if DRAFT status)."""
    profile = await get_moderator_profile(db, user_id)
    if not profile:
        return None
    
    if profile.moderator_status != ModeratorStatus.DRAFT:
        raise ValueError("Can only update profile in DRAFT status")
    
    update_data = profile_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)
    
    await db.commit()
    await db.refresh(profile)
    return profile


async def add_moderator_document(
    db: AsyncSession,
    user_id: int,
    document_type: str,
    file_url: str
) -> CompoundModeratorDocument:
    """Add a document to moderator profile."""
    profile = await get_moderator_profile(db, user_id)
    if not profile:
        raise ValueError("Moderator profile not found")
    
    if profile.moderator_status != ModeratorStatus.DRAFT:
        raise ValueError("Can only add documents in DRAFT status")
    
    document = CompoundModeratorDocument(
        profile_id=profile.id,
        document_type=document_type,
        file_url=file_url
    )
    
    db.add(document)
    await db.commit()
    await db.refresh(document)
    return document


async def submit_moderator_profile(
    db: AsyncSession,
    user_id: int
) -> CompoundModeratorProfile:
    """Submit moderator profile for review."""
    from datetime import datetime
    
    profile = await get_moderator_profile(db, user_id)
    if not profile:
        raise ValueError("Moderator profile not found")
    
    if profile.moderator_status != ModeratorStatus.DRAFT:
        raise ValueError("Profile already submitted")
    
    # Validate required fields
    if not profile.compound_id:
        raise ValueError("compound_id is required")
    if not profile.role_title:
        raise ValueError("role_title is required")
    
    # Validate required documents
    documents = await db.execute(
        select(CompoundModeratorDocument).where(CompoundModeratorDocument.profile_id == profile.id)
    )
    doc_list = list(documents.scalars().all())
    doc_types = [doc.document_type for doc in doc_list]
    
    required_docs = ["NATIONAL_ID_FRONT", "NATIONAL_ID_BACK", "AUTHORIZATION_LETTER"]
    missing_docs = [doc for doc in required_docs if doc not in doc_types]
    
    if missing_docs:
        raise ValueError(f"Missing required documents: {', '.join(missing_docs)}")
    
    profile.moderator_status = ModeratorStatus.SUBMITTED
    profile.submitted_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(profile)
    return profile

