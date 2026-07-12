import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_platform_admin
from app.crud import business as business_crud
from app.db.session import get_db
from app.models.enums import BusinessClaimStatus
from app.models.user import User
from app.schemas.business import (
    BusinessClaimListResponse,
    BusinessClaimResponse,
    BusinessClaimReview,
    BusinessCreate,
    BusinessResponse,
    BusinessUpdate,
)
from app.services.businesses import (
    BusinessNotFoundError,
    ClaimTransitionError,
    business_response,
    claim_response,
    review_claim,
)

router = APIRouter(prefix="/admin/businesses", tags=["admin-businesses"])
logger = logging.getLogger(__name__)


@router.post("", response_model=BusinessResponse, status_code=status.HTTP_201_CREATED)
async def admin_create_business(
    data: BusinessCreate,
    current_user: User = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> BusinessResponse:
    business = await business_crud.create_business(db, data)
    logger.info(
        "business_created",
        extra={"business_id": business.id, "admin_user_id": current_user.id},
    )
    return await business_response(db, business)


@router.patch("/{business_id}", response_model=BusinessResponse)
async def admin_update_business(
    business_id: int,
    data: BusinessUpdate,
    current_user: User = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> BusinessResponse:
    business = await business_crud.get_business_by_id(db, business_id)
    if business is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Business not found"
        )
    business = await business_crud.update_business(db, business, data)
    logger.info(
        "business_updated",
        extra={"business_id": business.id, "admin_user_id": current_user.id},
    )
    return await business_response(db, business)


@router.get("/claims", response_model=BusinessClaimListResponse)
async def admin_list_business_claims(
    claim_status: BusinessClaimStatus | None = Query(
        None, alias="status", description="Filter by PENDING, APPROVED, or REJECTED"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> BusinessClaimListResponse:
    claims, total = await business_crud.list_claims(
        db, status=claim_status, skip=skip, limit=limit
    )
    return BusinessClaimListResponse(
        items=[await claim_response(db, claim) for claim in claims],
        total=total,
        skip=skip,
        limit=limit,
    )


async def _review(
    claim_id: int,
    decision: BusinessClaimStatus,
    data: BusinessClaimReview,
    current_user: User,
    db: AsyncSession,
) -> BusinessClaimResponse:
    try:
        claim = await review_claim(
            db,
            claim_id=claim_id,
            reviewer_id=current_user.id,
            decision=decision,
            review_notes=data.review_notes,
            membership_role=data.membership_role,
        )
    except BusinessNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    except ClaimTransitionError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=str(exc)
        ) from exc
    return await claim_response(db, claim)


@router.post("/claims/{claim_id}/approve", response_model=BusinessClaimResponse)
async def admin_approve_business_claim(
    claim_id: int,
    data: BusinessClaimReview,
    current_user: User = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> BusinessClaimResponse:
    return await _review(
        claim_id, BusinessClaimStatus.APPROVED, data, current_user, db
    )


@router.post("/claims/{claim_id}/reject", response_model=BusinessClaimResponse)
async def admin_reject_business_claim(
    claim_id: int,
    data: BusinessClaimReview,
    current_user: User = Depends(get_current_platform_admin),
    db: AsyncSession = Depends(get_db),
) -> BusinessClaimResponse:
    return await _review(
        claim_id, BusinessClaimStatus.REJECTED, data, current_user, db
    )
