from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.report import ReportCreate, ReportResponse, ReportUpdate
from app.crud.report import create_report, get_reports, update_report_status
from app.crud.user import get_user_by_id
from app.crud.post import get_post_by_id
from app.crud.listing import get_listing_by_id
from app.crud.notification import create_notification
from app.models.enums import NotificationType
from app.core.dependencies import get_current_approved_user, get_current_moderator_or_admin
from app.models.user import User
from typing import List, Optional

router = APIRouter()


@router.post("/post/{post_id}", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def report_post(
    post_id: int,
    report_data: ReportCreate,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Report a post to moderators/admins."""
    # Verify post exists
    post = await get_post_by_id(db, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Post not found"
        )
    
    # Prevent self-reporting
    if post.author_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot report your own post"
        )
    
    # Create report
    report = await create_report(
        db=db,
        reporter_id=current_user.id,
        reported_type="post",
        reported_id=post_id,
        reason=report_data.reason,
        description=report_data.description,
    )
    
    # Get compound moderators and admins to notify
    from app.crud.user import get_compound_moderators_and_admins
    moderators = await get_compound_moderators_and_admins(db, post.compound_id)
    
    # Create notifications for moderators/admins
    for moderator in moderators:
        await create_notification(
            db=db,
            user_id=moderator.id,
            type=NotificationType.MENTION,  # Using MENTION as a generic notification type
            title="New Report: Post",
            message=f"{current_user.name} reported a post: {report_data.reason}",
            related_id=post_id,
            related_type="post",
            extra_data={
                "report_id": report.id,
                "reporter_name": current_user.name,
                "reason": report_data.reason,
            }
        )
    
    await db.commit()
    await db.refresh(report)
    
    return ReportResponse(
        id=report.id,
        reporter_id=report.reporter_id,
        reporter_name=current_user.name,
        reported_type=report.reported_type,
        reported_id=report.reported_id,
        reason=report.reason,
        description=report.description,
        status=report.status,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@router.post("/listing/{listing_id}", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def report_listing(
    listing_id: int,
    report_data: ReportCreate,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Report a listing to moderators/admins."""
    # Verify listing exists
    listing = await get_listing_by_id(db, listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )
    
    # Prevent self-reporting
    if listing.owner_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot report your own listing"
        )
    
    # Get compound_id from listing owner
    owner = await get_user_by_id(db, listing.owner_id)
    if not owner or not owner.compound_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Listing owner not found or not in a compound"
        )
    
    # Create report
    report = await create_report(
        db=db,
        reporter_id=current_user.id,
        reported_type="listing",
        reported_id=listing_id,
        reason=report_data.reason,
        description=report_data.description,
    )
    
    # Get compound moderators and admins to notify
    from app.crud.user import get_compound_moderators_and_admins
    moderators = await get_compound_moderators_and_admins(db, owner.compound_id)
    
    # Create notifications for moderators/admins
    for moderator in moderators:
        await create_notification(
            db=db,
            user_id=moderator.id,
            type=NotificationType.MENTION,
            title="New Report: Listing",
            message=f"{current_user.name} reported a listing: {report_data.reason}",
            related_id=listing_id,
            related_type="listing",
            extra_data={
                "report_id": report.id,
                "reporter_name": current_user.name,
                "reason": report_data.reason,
                "listing_title": listing.title,
            }
        )
    
    await db.commit()
    await db.refresh(report)
    
    return ReportResponse(
        id=report.id,
        reporter_id=report.reporter_id,
        reporter_name=current_user.name,
        reported_type=report.reported_type,
        reported_id=report.reported_id,
        reason=report.reason,
        description=report.description,
        status=report.status,
        created_at=report.created_at,
        updated_at=report.updated_at,
    )


@router.get("", response_model=List[ReportResponse])
async def get_reports_list(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None),
    reported_type: Optional[str] = Query(None),
    current_user: User = Depends(get_current_moderator_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get reports (moderators/admins only)."""
    reports = await get_reports(
        db=db,
        skip=skip,
        limit=limit,
        status_filter=status_filter,
        reported_type=reported_type,
        compound_id=current_user.compound_id if current_user.role != "ADMIN" else None,
    )
    
    result = []
    for report in reports:
        reporter = await get_user_by_id(db, report.reporter_id)
        reviewer = await get_user_by_id(db, report.reviewed_by_id) if report.reviewed_by_id else None
        
        result.append(ReportResponse(
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
        ))
    
    return result


@router.patch("/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: int,
    update_data: ReportUpdate,
    current_user: User = Depends(get_current_moderator_or_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update report status (moderators/admins only)."""
    report = await update_report_status(
        db=db,
        report_id=report_id,
        reviewer_id=current_user.id,
        status=update_data.status,
        review_notes=update_data.review_notes,
    )
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    await db.commit()
    await db.refresh(report)
    
    reporter = await get_user_by_id(db, report.reporter_id)
    reviewer = await get_user_by_id(db, report.reviewed_by_id) if report.reviewed_by_id else None
    
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

