from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.business import BusinessMembership, IndependentBusiness
from app.models.listing import Listing
from app.models.moderation import AuditLog, ModerationAction
from app.models.enums import ModerationActionType
from app.models.post import Comment, Post
from app.models.report import Report, ReportStatus, ReportType
from app.models.user import User


@dataclass(frozen=True)
class ReportTarget:
    entity: object
    owner_id: Optional[int]
    compound_id: Optional[int]


async def resolve_report_target(
    db: AsyncSession,
    reported_type: str,
    reported_id: int,
    *,
    include_hidden: bool = False,
) -> Optional[ReportTarget]:
    target_type = reported_type.upper()
    if target_type == ReportType.POST.value:
        post = await db.get(Post, reported_id)
        if post is None or (not include_hidden and post.deleted_at is not None):
            return None
        return ReportTarget(post, post.author_id, post.compound_id)
    if target_type == ReportType.COMMENT.value:
        comment = await db.get(Comment, reported_id)
        if comment is None or (not include_hidden and comment.deleted_at is not None):
            return None
        post = await db.get(Post, comment.post_id)
        if post is None or (not include_hidden and post.deleted_at is not None):
            return None
        return ReportTarget(comment, comment.author_id, post.compound_id)
    if target_type == ReportType.BUSINESS.value:
        business = await db.get(IndependentBusiness, reported_id)
        if business is None or (
            not include_hidden and (business.is_hidden or not business.is_active)
        ):
            return None
        owner_id = await db.scalar(
            select(User.id)
            .join(BusinessMembership, BusinessMembership.user_id == User.id)
            .where(BusinessMembership.business_id == business.id)
            .limit(1)
        )
        return ReportTarget(business, owner_id, business.compound_id)
    if target_type == ReportType.USER.value:
        user = await db.get(User, reported_id)
        return ReportTarget(user, user.id, user.compound_id) if user else None
    if target_type == ReportType.LISTING.value:
        listing = await db.get(Listing, reported_id)
        if listing is None or (not include_hidden and listing.deleted_at is not None):
            return None
        return ReportTarget(listing, listing.owner_id, listing.compound_id)
    return None


async def create_report(
    db: AsyncSession,
    reporter_id: int,
    reported_type: str,
    reported_id: int,
    reason: str,
    description: Optional[str] = None,
) -> Report:
    target_type = reported_type.upper()
    active = await db.scalar(
        select(Report).where(
            Report.reporter_id == reporter_id,
            Report.reported_type == target_type,
            Report.reported_id == reported_id,
            Report.status.in_(
                [ReportStatus.OPEN.value, ReportStatus.UNDER_REVIEW.value]
            ),
        )
    )
    if active is not None:
        from sqlalchemy.exc import IntegrityError

        raise IntegrityError("duplicate active report", params=None, orig=None)
    report = Report(
        reporter_id=reporter_id,
        reported_type=target_type,
        reported_id=reported_id,
        reason=reason.upper(),
        description=description,
        status=ReportStatus.OPEN.value,
    )
    db.add(report)
    await db.flush()
    await db.refresh(report)
    return report


def _compound_scope(compound_id: int):
    return or_(
        and_(
            Report.reported_type == ReportType.POST.value,
            Report.reported_id.in_(select(Post.id).where(Post.compound_id == compound_id)),
        ),
        and_(
            Report.reported_type == ReportType.COMMENT.value,
            Report.reported_id.in_(
                select(Comment.id)
                .join(Post, Comment.post_id == Post.id)
                .where(Post.compound_id == compound_id)
            ),
        ),
        and_(
            Report.reported_type == ReportType.BUSINESS.value,
            Report.reported_id.in_(
                select(IndependentBusiness.id).where(
                    IndependentBusiness.compound_id == compound_id
                )
            ),
        ),
        and_(
            Report.reported_type == ReportType.USER.value,
            Report.reported_id.in_(
                select(User.id).where(User.compound_id == compound_id)
            ),
        ),
        and_(
            Report.reported_type == ReportType.LISTING.value,
            Report.reported_id.in_(
                select(Listing.id).where(Listing.compound_id == compound_id)
            ),
        ),
    )


async def get_reports(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 50,
    status_filter: Optional[str] = None,
    reported_type: Optional[str] = None,
    reported_id: Optional[int] = None,
    reason: Optional[str] = None,
    reporter_id: Optional[int] = None,
    compound_id: Optional[int] = None,
) -> list[Report]:
    query = select(Report)
    conditions = []
    if status_filter:
        conditions.append(Report.status == status_filter)
    if reported_type:
        conditions.append(Report.reported_type == reported_type)
    if reported_id:
        conditions.append(Report.reported_id == reported_id)
    if reason:
        conditions.append(Report.reason == reason)
    if reporter_id:
        conditions.append(Report.reporter_id == reporter_id)
    if compound_id is not None:
        conditions.append(_compound_scope(compound_id))
    if conditions:
        query = query.where(and_(*conditions))
    result = await db.execute(
        query.order_by(Report.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all())


async def get_report_for_reviewer(
    db: AsyncSession, report_id: int, compound_id: Optional[int]
) -> Optional[Report]:
    query = select(Report).where(Report.id == report_id)
    if compound_id is not None:
        query = query.where(_compound_scope(compound_id))
    return await db.scalar(query)


async def update_report_status(
    db: AsyncSession,
    *,
    report: Report,
    reviewer_id: int,
    status: str,
    review_notes: Optional[str] = None,
    append_audit: bool = False,
) -> Report:
    before = {
        "status": report.status,
        "reviewed_by_id": report.reviewed_by_id,
        "review_notes": report.review_notes,
    }
    report.status = status
    report.reviewed_by_id = reviewer_id
    report.reviewed_at = datetime.now(timezone.utc)
    report.review_notes = review_notes
    if append_audit:
        action_type = (
            ModerationActionType.RESOLVE_REPORT
            if status == ReportStatus.RESOLVED.value
            else ModerationActionType.DISMISS_REPORT
            if status == ReportStatus.DISMISSED.value
            else ModerationActionType.NOTE
        )
        db.add(
            ModerationAction(
                actor_id=reviewer_id,
                report_id=report.id,
                action_type=action_type,
                target_type=ReportType(report.reported_type).value,
                target_id=report.reported_id,
                reason=review_notes or f"Report status changed to {status}",
                details={"before": before, "after": {"status": status}},
            )
        )
        db.add(
            AuditLog(
                actor_id=reviewer_id,
                event_type="moderation.report_status_changed",
                entity_type="REPORT",
                entity_id=str(report.id),
                data={
                    "before": before,
                    "after": {
                        "status": status,
                        "reviewed_by_id": reviewer_id,
                        "review_notes": review_notes,
                    },
                },
            )
        )
    await db.flush()
    return report
