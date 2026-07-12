import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.models.all  # noqa: F401
from app.api.admin import list_audit_logs
from app.crud.moderation import apply_report_action
from app.crud.report import (
    create_report,
    get_reports,
    resolve_report_target,
    update_report_status,
)
from app.crud.user import get_compound_moderators_and_admins
from app.db.base import Base
from app.models.business import IndependentBusiness
from app.models.compound import Compound
from app.models.compound_moderator import CompoundModeratorProfile
from app.models.enums import (
    ListingCategory,
    ListingIntent,
    ListingStatus,
    ModeratorStatus,
    UserRole,
    UserStatus,
)
from app.models.listing import Listing
from app.models.moderation import AuditLog, ModerationAction
from app.models.post import Comment, Post
from app.models.report import Report, ReportStatus, ReportType
from app.models.user import User
from app.schemas.moderation import ReportModerationAction


@pytest.mark.asyncio
async def test_all_launch_report_types_dedupe_scope_actions_and_audit():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)

    async with sessions() as db:
        compound = Compound(name="One", country="Egypt")
        other_compound = Compound(name="Two", country="Egypt")
        db.add_all([compound, other_compound])
        await db.flush()
        reporter = User(
            name="Reporter",
            email="reporter@example.com",
            password_hash="x",
            role=UserRole.USER,
            status=UserStatus.APPROVED,
            compound_id=compound.id,
        )
        author = User(
            name="Author",
            email="author@example.com",
            password_hash="x",
            role=UserRole.USER,
            status=UserStatus.APPROVED,
            compound_id=compound.id,
        )
        moderator = User(
            name="Moderator",
            email="moderator@example.com",
            password_hash="x",
            role=UserRole.COMPOUND_MOD,
            status=UserStatus.APPROVED,
            compound_id=compound.id,
        )
        admin = User(
            name="Admin",
            email="admin@example.com",
            password_hash="x",
            role=UserRole.ADMIN,
            status=UserStatus.APPROVED,
        )
        db.add_all([reporter, author, moderator, admin])
        await db.flush()
        db.add(
            CompoundModeratorProfile(
                user_id=moderator.id,
                compound_id=compound.id,
                moderator_status=ModeratorStatus.APPROVED,
            )
        )
        post = Post(compound_id=compound.id, author_id=author.id, content="post")
        db.add(post)
        await db.flush()
        comment = Comment(post_id=post.id, author_id=author.id, content="comment")
        business = IndependentBusiness(
            slug="shop",
            name="Shop",
            city="Cairo",
            category="Market",
            compound_id=compound.id,
        )
        listing = Listing(
            compound_id=compound.id,
            owner_id=author.id,
            category=ListingCategory.ITEM,
            title="Reported listing",
            intent=ListingIntent.SELL,
            status=ListingStatus.ACTIVE,
        )
        db.add_all([comment, business, listing])
        await db.flush()

        targets = [
            (ReportType.POST, post.id),
            (ReportType.COMMENT, comment.id),
            (ReportType.BUSINESS, business.id),
            (ReportType.USER, author.id),
            (ReportType.LISTING, listing.id),
        ]
        reports = []
        for target_type, target_id in targets:
            assert await resolve_report_target(db, target_type.value, target_id)
            reports.append(
                await create_report(
                    db,
                    reporter_id=reporter.id,
                    reported_type=target_type.value,
                    reported_id=target_id,
                    reason="SPAM",
                )
            )
        await db.commit()
        compound_id = compound.id
        other_compound_id = other_compound.id
        post_id = post.id
        comment_id = comment.id
        author_id = author.id
        business_id = business.id
        listing_id = listing.id
        moderator_id = moderator.id
        admin_id = admin.id
        report_ids = [report.id for report in reports]

        with pytest.raises(IntegrityError):
            await create_report(
                db,
                reporter_id=reporter.id,
                reported_type=ReportType.POST.value,
                reported_id=post_id,
                reason="OTHER",
            )
        await db.rollback()
        post = await db.get(Post, post_id)
        comment = await db.get(Comment, comment_id)
        moderator = await db.get(User, moderator_id)
        author = await db.get(User, author_id)
        business = await db.get(IndependentBusiness, business_id)
        listing = await db.get(Listing, listing_id)
        reports = [await db.get(Report, report_id) for report_id in report_ids]

        scoped = await get_reports(db, compound_id=compound_id)
        assert {report.reported_type for report in scoped} == {
            item.value for item, _ in targets
        }
        assert await get_reports(db, compound_id=other_compound_id) == []
        recipients = await get_compound_moderators_and_admins(db, compound_id)
        assert {user.id for user in recipients} == {moderator_id, admin_id}

        await update_report_status(
            db,
            report=reports[0],
            reviewer_id=moderator.id,
            status=ReportStatus.UNDER_REVIEW.value,
            review_notes="Review started",
        )
        assert reports[0].status == ReportStatus.UNDER_REVIEW.value

        hide_action = await apply_report_action(
            db,
            report=reports[0],
            actor=moderator,
            action=ReportModerationAction.HIDE,
            reason="Confirmed abuse",
        )
        assert post.deleted_at is not None
        assert hide_action.details["before"]["deleted_at"] is None
        assert hide_action.details["after"]["deleted_at"] is not None

        await apply_report_action(
            db,
            report=reports[1],
            actor=moderator,
            action=ReportModerationAction.HIDE,
            reason="Confirmed comment abuse",
        )
        assert comment.deleted_at is not None
        assert (
            await resolve_report_target(
                db, ReportType.COMMENT.value, comment.id
            )
            is None
        )
        await apply_report_action(
            db,
            report=reports[1],
            actor=moderator,
            action=ReportModerationAction.RESTORE,
            reason="Restored after review",
        )
        assert comment.deleted_at is None

        await apply_report_action(
            db,
            report=reports[2],
            actor=moderator,
            action=ReportModerationAction.HIDE,
            reason="Hide reported business",
        )
        assert business.is_hidden is True
        await apply_report_action(
            db,
            report=reports[2],
            actor=moderator,
            action=ReportModerationAction.RESTORE,
            reason="Restore reported business",
        )
        assert business.is_hidden is False

        await apply_report_action(
            db,
            report=reports[4],
            actor=moderator,
            action=ReportModerationAction.HIDE,
            reason="Hide reported listing",
        )
        assert listing.deleted_at is not None
        await apply_report_action(
            db,
            report=reports[4],
            actor=moderator,
            action=ReportModerationAction.RESTORE,
            reason="Restore reported listing",
        )
        assert listing.deleted_at is None

        await apply_report_action(
            db,
            report=reports[3],
            actor=moderator,
            action=ReportModerationAction.SUSPEND,
            reason="Repeated abuse",
        )
        assert author.status == UserStatus.BANNED
        await apply_report_action(
            db,
            report=reports[0],
            actor=moderator,
            action=ReportModerationAction.RESOLVE,
            reason="Handled",
        )
        assert reports[0].status == ReportStatus.RESOLVED.value
        await apply_report_action(
            db,
            report=reports[1],
            actor=moderator,
            action=ReportModerationAction.DISMISS,
            reason="No violation found",
        )
        assert reports[1].status == ReportStatus.DISMISSED.value
        await db.commit()

        assert await db.scalar(select(func.count()).select_from(ModerationAction)) == 10
        assert await db.scalar(select(func.count()).select_from(AuditLog)) == 10

    await engine.dispose()


@pytest.mark.asyncio
async def test_admin_audit_endpoint_rejects_non_admin(db_session):
    moderator = User(
        id=1001,
        name="Legacy moderator",
        email="legacy-mod@example.com",
        password_hash="x",
        role=UserRole.MODERATOR,
        status=UserStatus.APPROVED,
    )
    with pytest.raises(HTTPException) as error:
        await list_audit_logs(
            skip=0,
            limit=50,
            actor_id=None,
            event_type=None,
            entity_type=None,
            entity_id=None,
            current_user=moderator,
            db=db_session,
        )
    assert error.value.status_code == 403
