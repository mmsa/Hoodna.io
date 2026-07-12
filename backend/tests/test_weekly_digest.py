from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select

from app.models.compound import Compound
from app.models.digest import DigestDelivery
from app.models.enums import (
    DigestDeliveryStatus,
    NotificationType,
    PostCategory,
    UserRole,
    UserStatus,
)
from app.models.notification import Notification
from app.models.post import Post
from app.models.user import User
from app.services.weekly_digest import run_weekly_digest


START = datetime(2026, 7, 6, tzinfo=timezone.utc)
END = datetime(2026, 7, 13, tzinfo=timezone.utc)


async def _resident(db_session) -> User:
    compound = Compound(name="Digest Compound", country="Egypt")
    db_session.add(compound)
    await db_session.flush()
    user = User(
        name="Resident",
        email="resident-digest@example.com",
        password_hash="not-used",
        role=UserRole.USER,
        status=UserStatus.APPROVED,
        compound_id=compound.id,
        created_at=START,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest.mark.asyncio
async def test_weekly_digest_skips_empty_summary(db_session):
    user = await _resident(db_session)

    result = await run_weekly_digest(
        db_session, period_start=START, period_end=END
    )

    assert result["sent"] == 0
    assert result["skipped_empty"] == 1
    delivery = await db_session.scalar(
        select(DigestDelivery).where(DigestDelivery.user_id == user.id)
    )
    assert delivery.status == DigestDeliveryStatus.SKIPPED
    assert await db_session.scalar(select(func.count(Notification.id))) == 0


@pytest.mark.asyncio
async def test_weekly_digest_prevents_duplicate_notification(db_session):
    user = await _resident(db_session)
    db_session.add(
        Post(
            compound_id=user.compound_id,
            author_id=user.id,
            content="A useful local update",
            category=PostCategory.GENERAL,
            created_at=datetime(2026, 7, 10, tzinfo=timezone.utc),
        )
    )
    await db_session.commit()

    first = await run_weekly_digest(
        db_session, period_start=START, period_end=END
    )
    second = await run_weekly_digest(
        db_session, period_start=START, period_end=END
    )

    assert first["sent"] == 1
    assert second["duplicate"] is True
    assert (
        await db_session.scalar(
            select(func.count(Notification.id)).where(
                Notification.type == NotificationType.WEEKLY_DIGEST
            )
        )
        == 1
    )
    assert await db_session.scalar(select(func.count(DigestDelivery.id))) == 1
