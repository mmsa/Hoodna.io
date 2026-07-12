import re

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.business import BusinessClaim, BusinessMembership, IndependentBusiness
from app.models.enums import BusinessClaimStatus, BusinessVerificationStatus
from app.schemas.business import BusinessCreate, BusinessUpdate


def slugify_business_name(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug[:160] or "business"


async def unique_business_slug(
    db: AsyncSession, requested: str, *, exclude_id: int | None = None
) -> str:
    base = requested[:160]
    candidate = base
    suffix = 2
    while True:
        query = select(IndependentBusiness.id).where(IndependentBusiness.slug == candidate)
        if exclude_id is not None:
            query = query.where(IndependentBusiness.id != exclude_id)
        if (await db.execute(query)).scalar_one_or_none() is None:
            return candidate
        tail = f"-{suffix}"
        candidate = f"{base[:160 - len(tail)]}{tail}"
        suffix += 1


def _public_visibility():
    return (
        IndependentBusiness.is_active.is_(True),
        IndependentBusiness.is_hidden.is_(False),
    )


async def list_public_businesses(
    db: AsyncSession,
    *,
    skip: int = 0,
    limit: int = 50,
    query: str | None = None,
    city: str | None = None,
    area: str | None = None,
    category: str | None = None,
    verification_status: BusinessVerificationStatus | None = None,
) -> tuple[list[IndependentBusiness], int]:
    filters = list(_public_visibility())
    if query:
        term = f"%{query.strip()}%"
        filters.append(
            or_(
                IndependentBusiness.name.ilike(term),
                IndependentBusiness.description.ilike(term),
                IndependentBusiness.category.ilike(term),
                IndependentBusiness.city.ilike(term),
                IndependentBusiness.area.ilike(term),
            )
        )
    if city:
        filters.append(func.lower(IndependentBusiness.city) == city.strip().lower())
    if area:
        filters.append(func.lower(IndependentBusiness.area) == area.strip().lower())
    if category:
        filters.append(func.lower(IndependentBusiness.category) == category.strip().lower())
    if verification_status:
        filters.append(IndependentBusiness.verification_status == verification_status)

    total = (
        await db.execute(select(func.count(IndependentBusiness.id)).where(*filters))
    ).scalar_one()
    result = await db.execute(
        select(IndependentBusiness)
        .where(*filters)
        .order_by(IndependentBusiness.name.asc(), IndependentBusiness.id.asc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all()), total


async def search_public_businesses(
    db: AsyncSession, query: str, *, compound_id: int | None = None, limit: int = 10
) -> list[IndependentBusiness]:
    filters = list(_public_visibility())
    term = f"%{query.strip()}%"
    filters.append(
        or_(
            IndependentBusiness.name.ilike(term),
            IndependentBusiness.category.ilike(term),
            IndependentBusiness.description.ilike(term),
        )
    )
    if compound_id is not None:
        filters.append(IndependentBusiness.compound_id == compound_id)
    result = await db.execute(
        select(IndependentBusiness)
        .where(*filters)
        .order_by(
            IndependentBusiness.verification_status.desc(),
            IndependentBusiness.name.asc(),
        )
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_public_business_by_slug(
    db: AsyncSession, slug: str
) -> IndependentBusiness | None:
    result = await db.execute(
        select(IndependentBusiness).where(
            IndependentBusiness.slug == slug, *_public_visibility()
        )
    )
    return result.scalar_one_or_none()


async def get_business_by_id(
    db: AsyncSession, business_id: int
) -> IndependentBusiness | None:
    return await db.get(IndependentBusiness, business_id)


async def create_business(
    db: AsyncSession, data: BusinessCreate
) -> IndependentBusiness:
    values = data.model_dump()
    requested_slug = values.pop("slug") or slugify_business_name(data.name)
    values["slug"] = await unique_business_slug(db, requested_slug)
    business = IndependentBusiness(**values)
    db.add(business)
    await db.flush()
    await db.refresh(business)
    return business


async def update_business(
    db: AsyncSession, business: IndependentBusiness, data: BusinessUpdate
) -> IndependentBusiness:
    values = data.model_dump(exclude_unset=True)
    if "slug" in values and values["slug"] is not None:
        values["slug"] = await unique_business_slug(
            db, values["slug"], exclude_id=business.id
        )
    for field, value in values.items():
        setattr(business, field, value)
    await db.flush()
    await db.refresh(business)
    return business


async def get_current_claim(
    db: AsyncSession, user_id: int, business_id: int | None = None
) -> BusinessClaim | None:
    query = select(BusinessClaim).where(BusinessClaim.claimant_id == user_id)
    if business_id is not None:
        query = query.where(BusinessClaim.business_id == business_id)
    query = query.order_by(
        (BusinessClaim.status == BusinessClaimStatus.PENDING).desc(),
        BusinessClaim.submitted_at.desc(),
        BusinessClaim.id.desc(),
    )
    return (await db.execute(query.limit(1))).scalar_one_or_none()


async def get_active_claim(
    db: AsyncSession, user_id: int, business_id: int
) -> BusinessClaim | None:
    result = await db.execute(
        select(BusinessClaim).where(
            BusinessClaim.claimant_id == user_id,
            BusinessClaim.business_id == business_id,
            BusinessClaim.status == BusinessClaimStatus.PENDING,
        )
    )
    return result.scalar_one_or_none()


async def get_membership(
    db: AsyncSession, user_id: int, business_id: int
) -> BusinessMembership | None:
    result = await db.execute(
        select(BusinessMembership).where(
            BusinessMembership.user_id == user_id,
            BusinessMembership.business_id == business_id,
        )
    )
    return result.scalar_one_or_none()


async def list_claims(
    db: AsyncSession,
    *,
    status: BusinessClaimStatus | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[BusinessClaim], int]:
    filters = [BusinessClaim.status == status] if status else []
    total = (
        await db.execute(select(func.count(BusinessClaim.id)).where(*filters))
    ).scalar_one()
    result = await db.execute(
        select(BusinessClaim)
        .where(*filters)
        .order_by(BusinessClaim.submitted_at.asc(), BusinessClaim.id.asc())
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all()), total
