from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from app.models.report import Report
from typing import Optional, List


async def create_report(
    db: AsyncSession,
    reporter_id: int,
    reported_type: str,
    reported_id: int,
    reason: str,
    description: Optional[str] = None,
) -> Report:
    """Create a new report."""
    report = Report(
        reporter_id=reporter_id,
        reported_type=reported_type,
        reported_id=reported_id,
        reason=reason,
        description=description,
        status="PENDING",
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return report


async def get_reports(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    status_filter: Optional[str] = None,
    reported_type: Optional[str] = None,
    compound_id: Optional[int] = None,
) -> List[Report]:
    """Get reports with optional filters."""
    query = select(Report)
    
    conditions = []
    if status_filter:
        conditions.append(Report.status == status_filter)
    if reported_type:
        conditions.append(Report.reported_type == reported_type)
    
    if conditions:
        query = query.where(and_(*conditions))
    
    # For compound-specific filtering, we'd need to join with posts/listings
    # For now, we'll return all reports for admins, or filter by compound later
    
    query = query.order_by(Report.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_report_status(
    db: AsyncSession,
    report_id: int,
    reviewer_id: int,
    status: str,
    review_notes: Optional[str] = None,
) -> Optional[Report]:
    """Update report status."""
    from datetime import datetime
    
    report = await db.get(Report, report_id)
    if not report:
        return None
    
    report.status = status
    report.reviewed_by_id = reviewer_id
    report.reviewed_at = datetime.utcnow()
    report.review_notes = review_notes
    
    await db.flush()
    await db.refresh(report)
    return report

