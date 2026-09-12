"""Create a throwaway SQLite database for local smoke testing.

Not used by production or CI. Lets the API boot without Postgres so HTTP
journeys can be exercised end to end during a pre-launch review.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from app.db.base import Base  # noqa: E402

# Import every model module so metadata is complete before create_all.
from app.models import (  # noqa: E402,F401
    business,
    chat_import,
    compound,
    compound_moderator,
    digest,
    feature_flag,
    launch_accounts,
    listing,
    message,
    moderation,
    notification,
    post,
    report,
    review,
    saved_listing,
    saved_post,
    service_category,
    service_provider,
    telemetry,
    user,
    user_compound_membership,
    verification,
)
from app.core.security import get_password_hash  # noqa: E402
from app.models.compound import Compound  # noqa: E402
from app.models.enums import UserRole, UserStatus  # noqa: E402
from app.models.user import User  # noqa: E402


def _assert_safe_target(db_url: str) -> None:
    """Refuse to run against anything that could be real data.

    This script drops every table, so an accidental run with a production
    DATABASE_URL exported in the shell would destroy the platform. Only a local
    SQLite file or an explicitly local host is allowed.
    """
    if db_url.startswith("sqlite"):
        return
    if any(host in db_url for host in ("@localhost", "@127.0.0.1", "@db:")):
        return
    raise SystemExit(
        "Refusing to run: smoke_bootstrap.py drops all tables and DATABASE_URL "
        "does not point at a local SQLite file or a local database host."
    )


async def main() -> None:
    db_url = os.environ["DATABASE_URL"]
    _assert_safe_target(db_url)
    engine = create_async_engine(db_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with session_factory() as session:
        compound_row = Compound(
            compound_id="smoke-gardens",
            name="Smoke Test Gardens",
            area="New Cairo",
            status_2025="Ready to Move",
        )
        session.add(compound_row)
        await session.flush()

        session.add(
            User(
                name="Smoke Admin",
                email="smoke-admin@example.com",
                password_hash=get_password_hash("smoke-admin-password"),
                role=UserRole.ADMIN,
                status=UserStatus.APPROVED,
                compound_id=compound_row.id,
                phone="201000000001",
                phone_verified=True,
                email_verified=True,
                creation_source="SMOKE",
            )
        )
        await session.commit()

    await engine.dispose()
    print("smoke database ready")


if __name__ == "__main__":
    asyncio.run(main())
