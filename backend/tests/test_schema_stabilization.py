import asyncio
from datetime import datetime, timezone

import app.models.all  # noqa: F401
from app.crud.listing import (
    archive_listing,
    get_listing_by_id,
    hide_listing,
    restore_listing,
)
from app.crud.post import delete_post, get_post_by_id, restore_post
from app.db.base import Base
from app.models.enums import ListingStatus
from app.models.listing import Listing
from app.models.post import Post


class StubSession:
    def __init__(self, instance):
        self.instance = instance
        self.flush_count = 0

    async def get(self, model, instance_id):
        return self.instance

    async def flush(self):
        self.flush_count += 1


class ScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class QuerySession:
    def __init__(self, value):
        self.value = value
        self.queries = []

    async def scalar(self, query):
        self.queries.append(query)
        return self.value

    async def execute(self, query):
        self.queries.append(query)
        return ScalarResult(self.value)


def test_reports_and_soft_delete_columns_are_in_metadata():
    reports = Base.metadata.tables["reports"]
    assert {
        "id",
        "reporter_id",
        "reported_type",
        "reported_id",
        "reason",
        "description",
        "status",
        "reviewed_by_id",
        "reviewed_at",
        "review_notes",
        "created_at",
        "updated_at",
    } == set(reports.columns.keys())
    assert {foreign_key.target_fullname for foreign_key in reports.foreign_keys} == {
        "users.id"
    }
    assert {
        "ix_reports_id",
        "ix_reports_reporter_id",
        "ix_reports_reported_id",
        "ix_reports_status",
        "ix_reports_created_at",
    }.issubset({index.name for index in reports.indexes})

    for table_name in ("posts", "listings"):
        table = Base.metadata.tables[table_name]
        assert table.c.deleted_at.nullable is True
        assert f"ix_{table_name}_deleted_at" in {
            index.name for index in table.indexes
        }


def test_post_soft_delete_and_restore():
    async def exercise():
        post = Post()
        session = StubSession(post)

        assert await delete_post(session, 1) is True
        assert post.deleted_at is not None
        assert post.deleted_at.tzinfo is not None
        assert await delete_post(session, 1) is True

        assert await restore_post(session, 1) is True
        assert post.deleted_at is None
        assert await restore_post(session, 1) is False

    asyncio.run(exercise())


def test_get_by_id_excludes_deleted_unless_requested():
    async def exercise():
        post_session = QuerySession(Post())
        await get_post_by_id(post_session, 1)
        await get_post_by_id(post_session, 1, include_deleted=True)
        assert "posts.deleted_at IS NULL" in str(post_session.queries[0])
        assert "posts.deleted_at IS NULL" not in str(post_session.queries[1])

        listing_session = QuerySession(Listing())
        await get_listing_by_id(listing_session, 1)
        await get_listing_by_id(
            listing_session,
            1,
            include_deleted=True,
        )
        assert "listings.deleted_at IS NULL" in str(listing_session.queries[0])
        assert "listings.deleted_at IS NULL" not in str(
            listing_session.queries[1]
        )

    asyncio.run(exercise())


def test_listing_hide_restore_preserves_archive_status():
    async def exercise():
        listing = Listing(status=ListingStatus.ACTIVE)
        session = StubSession(listing)

        assert await hide_listing(session, 1) is True
        assert isinstance(listing.deleted_at, datetime)
        assert listing.deleted_at.tzinfo == timezone.utc

        assert await restore_listing(session, 1) is True
        assert listing.deleted_at is None
        assert listing.status == ListingStatus.ACTIVE

        assert await archive_listing(session, 1) is True
        assert listing.status == ListingStatus.ARCHIVED
        assert listing.deleted_at is None

    asyncio.run(exercise())
