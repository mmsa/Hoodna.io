from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.service_provider import ServiceProviderProfile, ServiceProviderDocument
from app.models.user import User
from app.models.enums import UserRole, ProviderStatus, ProviderVerificationMethod
from app.schemas.provider import ServiceProviderProfileCreate, ServiceProviderProfileUpdate
from typing import Optional


async def get_provider_profile(
    db: AsyncSession,
    user_id: int
) -> Optional[ServiceProviderProfile]:
    """Get provider profile by user_id."""
    result = await db.execute(
        select(ServiceProviderProfile).where(ServiceProviderProfile.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_provider_profile(
    db: AsyncSession,
    user_id: int,
    profile_data: ServiceProviderProfileCreate
) -> ServiceProviderProfile:
    """Create a new provider profile and set user role."""
    # Check if profile already exists
    existing = await get_provider_profile(db, user_id)
    if existing:
        raise ValueError("Provider profile already exists for this user")
    
    # Get user and update role
    user = await db.get(User, user_id)
    if not user:
        raise ValueError("User not found")
    
    profile = ServiceProviderProfile(
        user_id=user_id,
        provider_type=profile_data.provider_type,
        verification_method=profile_data.verification_method,
        business_name=profile_data.business_name,
        category_id=profile_data.category_id,
        phone=profile_data.phone,
        service_area_compound_ids=profile_data.service_area_compound_ids,
        occupation_text=profile_data.occupation_text,
        provider_status=ProviderStatus.DRAFT
    )
    
    # Set user role
    user.role = UserRole.SERVICE_PROVIDER
    
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


async def update_provider_profile(
    db: AsyncSession,
    user_id: int,
    profile_data: ServiceProviderProfileUpdate
) -> Optional[ServiceProviderProfile]:
    """Update provider profile (only if DRAFT status)."""
    profile = await get_provider_profile(db, user_id)
    if not profile:
        return None
    
    if profile.provider_status != ProviderStatus.DRAFT:
        raise ValueError("Can only update profile in DRAFT status")
    
    update_data = profile_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(profile, field, value)
    
    await db.commit()
    await db.refresh(profile)
    return profile


async def add_provider_document(
    db: AsyncSession,
    user_id: int,
    document_type: str,
    file_url: str
) -> ServiceProviderDocument:
    """Add a document to provider profile."""
    profile = await get_provider_profile(db, user_id)
    if not profile:
        raise ValueError("Provider profile not found")
    
    if profile.provider_status != ProviderStatus.DRAFT:
        raise ValueError("Can only add documents in DRAFT status")
    
    document = ServiceProviderDocument(
        profile_id=profile.id,
        document_type=document_type,
        file_url=file_url
    )
    
    db.add(document)
    await db.commit()
    await db.refresh(document)
    return document


async def submit_provider_profile(
    db: AsyncSession,
    user_id: int
) -> ServiceProviderProfile:
    """Submit provider profile for review."""
    from datetime import datetime
    
    profile = await get_provider_profile(db, user_id)
    if not profile:
        raise ValueError("Provider profile not found")
    
    if profile.provider_status != ProviderStatus.DRAFT:
        raise ValueError("Profile already submitted")
    
    # Validate required fields
    if not profile.provider_type:
        raise ValueError("provider_type is required")
    if not profile.verification_method:
        raise ValueError("verification_method is required")
    if not profile.business_name:
        raise ValueError("business_name is required")
    if not profile.category_id:
        raise ValueError("category_id is required")
    if not profile.phone:
        raise ValueError("phone is required")
    if not profile.service_area_compound_ids:
        raise ValueError("service_area_compound_ids is required")
    
    # Validate documents based on verification method
    documents = await db.execute(
        select(ServiceProviderDocument).where(ServiceProviderDocument.profile_id == profile.id)
    )
    doc_list = list(documents.scalars().all())
    doc_types = [doc.document_type for doc in doc_list]
    
    if profile.verification_method == ProviderVerificationMethod.COMMERCIAL_REGISTER:
        if "COMMERCIAL_REGISTER" not in doc_types:
            raise ValueError("COMMERCIAL_REGISTER document is required")
    elif profile.verification_method == ProviderVerificationMethod.NATIONAL_ID_OCCUPATION:
        if "NATIONAL_ID_FRONT" not in doc_types or "NATIONAL_ID_BACK" not in doc_types:
            raise ValueError("NATIONAL_ID_FRONT and NATIONAL_ID_BACK documents are required")
        if not profile.occupation_text:
            raise ValueError("occupation_text is required for NATIONAL_ID_OCCUPATION method")
    
    profile.provider_status = ProviderStatus.SUBMITTED
    profile.submitted_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(profile)
    return profile


async def get_approved_providers(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50
) -> list[ServiceProviderProfile]:
    """Get all approved providers (public listing)."""
    result = await db.execute(
        select(ServiceProviderProfile)
        .where(ServiceProviderProfile.provider_status == ProviderStatus.APPROVED)
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())

