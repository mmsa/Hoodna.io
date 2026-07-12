from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user, get_current_user_optional
from app.crud import business as business_crud
from app.db.session import get_db
from app.models.enums import BusinessVerificationStatus
from app.models.user import User
from app.schemas.business import (
    BusinessClaimCreate,
    BusinessClaimResponse,
    BusinessListResponse,
    BusinessResponse,
    BusinessSearchResult,
)
from app.services.businesses import (
    ActiveClaimExistsError,
    business_response,
    claim_response,
    public_status,
    submit_claim,
)
from app.services.business_feature_flags import require_business_claiming

router = APIRouter(prefix="/businesses", tags=["businesses"])
claims_router = APIRouter(prefix="/business-claims", tags=["business-claims"])


@router.get("", response_model=BusinessListResponse)
async def browse_businesses(
    q: str | None = Query(None, min_length=1, max_length=200),
    search: str | None = Query(None, min_length=1, max_length=200),
    city: str | None = Query(None, max_length=120),
    area: str | None = Query(None, max_length=120),
    category: str | None = Query(None, max_length=120),
    compound_id: int | None = Query(None, ge=1),
    verification_status: BusinessVerificationStatus | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> BusinessListResponse:
    businesses, total = await business_crud.list_public_businesses(
        db,
        skip=skip,
        limit=limit,
        query=q or search,
        city=city,
        area=area,
        category=category,
        compound_id=compound_id,
        verification_status=verification_status,
    )
    return BusinessListResponse(
        items=[
            await business_response(db, business, current_user.id if current_user else None)
            for business in businesses
        ],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/search", response_model=list[BusinessSearchResult])
async def search_businesses(
    q: str = Query(..., min_length=1, max_length=200),
    compound_id: int | None = Query(None, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
) -> list[BusinessSearchResult]:
    businesses = await business_crud.search_public_businesses(
        db, q, compound_id=compound_id, limit=limit
    )
    return [
        BusinessSearchResult(
            id=business.id,
            slug=business.slug,
            name=business.name,
            city=business.city,
            area=business.area,
            category=business.category,
            verification_status=business.verification_status,
            public_status=public_status(business.verification_status),
        )
        for business in businesses
    ]


@router.get("/claims/current", response_model=BusinessClaimResponse | None)
async def current_business_claim(
    business_slug: str | None = Query(None, min_length=2, max_length=160),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BusinessClaimResponse | None:
    business_id = None
    if business_slug:
        business = await business_crud.get_public_business_by_slug(db, business_slug)
        if business is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Business not found"
            )
        business_id = business.id
    claim = await business_crud.get_current_claim(db, current_user.id, business_id)
    return await claim_response(db, claim) if claim else None


@router.post(
    "/{identifier}/claims",
    response_model=BusinessClaimResponse,
    status_code=status.HTTP_201_CREATED,
)
async def submit_business_claim(
    identifier: str,
    data: BusinessClaimCreate,
    current_user: User = Depends(require_business_claiming),
    db: AsyncSession = Depends(get_db),
) -> BusinessClaimResponse:
    business = await business_crud.get_public_business_by_identifier(db, identifier)
    if business is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Business not found"
        )
    try:
        claim = await submit_claim(
            db, business=business, claimant_id=current_user.id, data=data
        )
    except ActiveClaimExistsError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    return await claim_response(db, claim)


@claims_router.get("/me", response_model=list[BusinessClaimResponse])
async def my_business_claims(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BusinessClaimResponse]:
    claims = await business_crud.list_user_claims(db, current_user.id)
    return [await claim_response(db, claim) for claim in claims]


@router.get("/{slug}", response_model=BusinessResponse)
async def business_detail(
    slug: str,
    current_user: User | None = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
) -> BusinessResponse:
    business = await business_crud.get_public_business_by_slug(db, slug)
    if business is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Business not found"
        )
    return await business_response(
        db, business, current_user.id if current_user else None
    )
