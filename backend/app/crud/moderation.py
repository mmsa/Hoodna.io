from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.crud.report import resolve_report_target, update_report_status
from app.models.business import IndependentBusiness
from app.models.enums import ModerationActionType, UserStatus
from app.models.listing import Listing
from app.models.moderation import AuditLog, ModerationAction
from app.models.post import Comment, Post
from app.models.report import Report, ReportStatus, ReportType
from app.models.user import User
from app.schemas.moderation import ReportModerationAction


class UnsupportedModerationAction(ValueError):
    pass


def _timestamp(value):
    return value.isoformat() if value else None


async def apply_report_action(
    db: AsyncSession,
    *,
    report: Report,
    actor: User,
    action: ReportModerationAction,
    reason: str,
    notes: str | None = None,
) -> ModerationAction:
    target = await resolve_report_target(
        db, report.reported_type, report.reported_id, include_hidden=True
    )
    target_required = action not in (
        ReportModerationAction.RESOLVE,
        ReportModerationAction.DISMISS,
    )
    if target is None and target_required:
        raise ValueError("Reported target no longer exists")

    entity = target.entity if target else None
    before: dict = {}
    after: dict = {}
    action_type: ModerationActionType

    if action == ReportModerationAction.HIDE:
        if isinstance(entity, Post):
            before = {"deleted_at": _timestamp(entity.deleted_at)}
            entity.deleted_at = entity.deleted_at or datetime.now(timezone.utc)
            after = {"deleted_at": _timestamp(entity.deleted_at)}
        elif isinstance(entity, Comment):
            before = {"deleted_at": _timestamp(entity.deleted_at)}
            entity.deleted_at = entity.deleted_at or datetime.now(timezone.utc)
            after = {"deleted_at": _timestamp(entity.deleted_at)}
        elif isinstance(entity, Listing):
            before = {"deleted_at": _timestamp(entity.deleted_at)}
            entity.deleted_at = entity.deleted_at or datetime.now(timezone.utc)
            after = {"deleted_at": _timestamp(entity.deleted_at)}
        elif isinstance(entity, IndependentBusiness):
            before = {"is_hidden": entity.is_hidden}
            entity.is_hidden = True
            after = {"is_hidden": True}
        else:
            raise UnsupportedModerationAction(
                f"HIDE is not supported for {report.reported_type}"
            )
        action_type = ModerationActionType.HIDE
    elif action == ReportModerationAction.RESTORE:
        if isinstance(entity, Post):
            before = {"deleted_at": _timestamp(entity.deleted_at)}
            entity.deleted_at = None
            after = {"deleted_at": None}
        elif isinstance(entity, Comment):
            before = {"deleted_at": _timestamp(entity.deleted_at)}
            entity.deleted_at = None
            after = {"deleted_at": None}
        elif isinstance(entity, Listing):
            before = {"deleted_at": _timestamp(entity.deleted_at)}
            entity.deleted_at = None
            after = {"deleted_at": None}
        elif isinstance(entity, IndependentBusiness):
            before = {"is_hidden": entity.is_hidden}
            entity.is_hidden = False
            after = {"is_hidden": False}
        else:
            raise UnsupportedModerationAction(
                f"RESTORE is not supported for {report.reported_type}"
            )
        action_type = ModerationActionType.RESTORE
    elif action == ReportModerationAction.SUSPEND:
        if not isinstance(entity, User):
            raise UnsupportedModerationAction("SUSPEND is only supported for USER reports")
        if entity.id == actor.id:
            raise ValueError("Cannot suspend yourself")
        before = {"status": entity.status.value}
        entity.status = UserStatus.BANNED
        after = {"status": UserStatus.BANNED.value}
        action_type = ModerationActionType.SUSPEND
    elif action in (
        ReportModerationAction.RESOLVE,
        ReportModerationAction.DISMISS,
    ):
        new_status = (
            ReportStatus.RESOLVED.value
            if action == ReportModerationAction.RESOLVE
            else ReportStatus.DISMISSED.value
        )
        before = {"status": report.status, "review_notes": report.review_notes}
        await update_report_status(
            db,
            report=report,
            reviewer_id=actor.id,
            status=new_status,
            review_notes=notes or reason,
            append_audit=False,
        )
        after = {"status": new_status, "review_notes": notes or reason}
        action_type = (
            ModerationActionType.RESOLVE_REPORT
            if action == ReportModerationAction.RESOLVE
            else ModerationActionType.DISMISS_REPORT
        )
    else:  # pragma: no cover - protected by schema validation
        raise UnsupportedModerationAction(f"Unsupported action: {action}")

    details = {"before": before, "after": after}
    moderation_action = ModerationAction(
        actor_id=actor.id,
        subject_user_id=target.owner_id if target else None,
        report_id=report.id,
        action_type=action_type,
        target_type=report.reported_type,
        target_id=report.reported_id,
        reason=reason,
        details=details,
    )
    db.add(moderation_action)
    db.add(
        AuditLog(
            actor_id=actor.id,
            event_type=f"moderation.{action.value.lower()}",
            entity_type=report.reported_type,
            entity_id=str(report.reported_id),
            data={
                "report_id": report.id,
                "reason": reason,
                "notes": notes,
                **details,
            },
        )
    )
    await db.flush()
    await db.refresh(moderation_action)
    return moderation_action
