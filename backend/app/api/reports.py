from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_moderator_or_admin, get_current_user
from app.crud.notification import create_notification
from app.crud.report import (
    create_report,
    get_report_for_reviewer,
    get_reports,
    resolve_report_target,
    update_report_status,
)
from app.crud.user import get_compound_moderators_and_admins, get_user_by_id
from app.db.session import get_db
from app.models.enums import NotificationType, UserRole
from app.models.report import ReportReason, ReportStatus, ReportType
from app.models.user import User
from app.schemas.notification import NotificationCreate
from app.schemas.report import (
    ReportCreate,
    ReportReasonOnly,
    ReportResponse,
    ReportUpdate,
)

router = APIRouter()


async def _reviewer_compound_id(db: AsyncSession, user: User) -> Optional[int]:
    if user.role == UserRole.ADMIN:
        return None
    if user.role == UserRole.COMPOUND_MOD:
        from app.crud.moderator import get_moderator_profile

        profile = await get_moderator_profile(db, user.id)
        compound_id = profile.compound_id if profile else user.compound_id
    else:
        compound_id = user.compound_id
    if compound_id is None:
        raise HTTPException(status_code=403, detail="Moderator has no compound assignment")
    return compound_id


def _response(report, reporter=None, reviewer=None) -> ReportResponse:
    return ReportResponse(
        id=report.id,
        reporter_id=report.reporter_id,
        reporter_name=reporter.name if reporter else None,
        reported_type=report.reported_type,
        reported_id=report.reported_id,
        reason=report.reason,
        description=report.description,
        status=report.status,
        reviewed_by_id=report.reviewed_by_id,
        reviewed_by_name=reviewer.name if reviewer else None,
        reviewed_at=report.reviewed_at,
        review_notes=report.review_notes,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


async def _submit_report(
    data: ReportCreate,
    current_user: User,
    db: AsyncSession,
) -> ReportResponse:
    target = await resolve_report_target(
        db, data.reported_type.value, data.reported_id, include_hidden=False
    )
    if target is None:
        raise HTTPException(status_code=404, detail=f"{data.reported_type.value.title()} not found")
    if target.owner_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot report yourself or your own content")

    try:
        report = await create_report(
            db,
            reporter_id=current_user.id,
            reported_type=data.reported_type.value,
            reported_id=data.reported_id,
            reason=data.reason.value,
            description=data.description,
        )
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An active report already exists for this target",
        )

    if target.compound_id is not None:
        recipients = await get_compound_moderators_and_admins(db, target.compound_id)
    else:
        recipients = await get_compound_moderators_and_admins(db, None)
    for recipient in recipients:
        if recipient.id == current_user.id:
            continue
        await create_notification(
            db,
            NotificationCreate(
                user_id=recipient.id,
                type=NotificationType.MENTION,
                title=f"New Report: {data.reported_type.value.title()}",
                message=f"{current_user.name} submitted a {data.reason.value} report",
                related_id=data.reported_id,
                related_type=data.reported_type.value.lower(),
                extra_data={
                    "report_id": report.id,
                    "reporter_name": current_user.name,
                    "reason": data.reason.value,
                },
            ),
        )

    await db.commit()
    await db.refresh(report)
    return _response(report, current_user)


@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def report_target(
    report_data: ReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit an authenticated report for any supported target type."""
    return await _submit_report(report_data, current_user, db)


async def _submit_compatible(
    target_type: ReportType,
    target_id: int,
    report_data: ReportReasonOnly,
    current_user: User,
    db: AsyncSession,
) -> ReportResponse:
    return await _submit_report(
        ReportCreate(
            reported_type=target_type,
            reported_id=target_id,
            reason=report_data.reason,
            description=report_data.description,
        ),
        current_user,
        db,
    )


@router.post("/post/{post_id}", response_model=ReportResponse, status_code=201)
async def report_post(
    post_id: int,
    report_data: ReportReasonOnly,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _submit_compatible(ReportType.POST, post_id, report_data, current_user, db)


@router.post("/listing/{listing_id}", response_model=ReportResponse, status_code=201)
async def report_listing(
    listing_id: int,
    report_data: ReportReasonOnly,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await _submit_compatible(ReportType.LISTING, listing_id, report_data, current_user, db)


@router.get("", response_model=list[ReportResponse])
async def get_reports_list(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[ReportStatus] = Query(None),
    reported_type: Optional[ReportType] = Query(None),
    reported_id: Optional[int] = Query(None, gt=0),
    reason: Optional[ReportReason] = Query(None),
    reporter_id: Optional[int] = Query(None, gt=0),
    current_user: User = Depends(get_current_moderator_or_admin),
    db: AsyncSession = Depends(get_db),
):
    compound_id = await _reviewer_compound_id(db, current_user)
    reports = await get_reports(
        db,
        skip=skip,
        limit=limit,
        status_filter=status_filter.value if status_filter else None,
        reported_type=reported_type.value if reported_type else None,
        reported_id=reported_id,
        reason=reason.value if reason else None,
        reporter_id=reporter_id,
        compound_id=compound_id,
    )
    result = []
    for report in reports:
        reporter = await get_user_by_id(db, report.reporter_id)
        reviewer = (
            await get_user_by_id(db, report.reviewed_by_id)
            if report.reviewed_by_id
            else None
        )
        result.append(_response(report, reporter, reviewer))
    return result


@router.patch("/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: int,
    update_data: ReportUpdate,
    current_user: User = Depends(get_current_moderator_or_admin),
    db: AsyncSession = Depends(get_db),
):
    compound_id = await _reviewer_compound_id(db, current_user)
    report = await get_report_for_reviewer(db, report_id, compound_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    report = await update_report_status(
        db,
        report=report,
        reviewer_id=current_user.id,
        status=update_data.status.value,
        review_notes=update_data.review_notes,
        append_audit=True,
    )
    await db.commit()
    await db.refresh(report)
    reporter = await get_user_by_id(db, report.reporter_id)
    return _response(report, reporter, current_user)
