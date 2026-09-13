import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

import app.models.all  # noqa: F401
from app.api.community import _to_post_response
from app.crud.account import (
    create_or_get_pending_deletion_request,
    deletion_request_response,
    get_deletion_request,
)
from app.crud.saved_post import get_saved_posts, save_post
from app.db.base import Base
from app.models.compound import Compound
from app.models.enums import UserRole, UserStatus
from app.models.post import Comment, Post
from app.models.user import User


def _engine():
    return create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )


@pytest.mark.asyncio
async def test_saved_posts_empty_list_and_commented_post_serialize():
    engine = _engine()
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with sessions() as db:
        compound = Compound(name="VGK", country="Egypt")
        db.add(compound)
        await db.flush()
        author = User(
            name="Author",
            email="author-saved@example.com",
            password_hash="x",
            role=UserRole.RESIDENT,
            status=UserStatus.APPROVED,
            compound_id=compound.id,
        )
        saver = User(
            name="Saver",
            email="saver@example.com",
            password_hash="x",
            role=UserRole.RESIDENT,
            status=UserStatus.APPROVED,
            compound_id=compound.id,
        )
        db.add_all([author, saver])
        await db.flush()

        assert await get_saved_posts(db, saver.id) == []

        post = Post(compound_id=compound.id, author_id=author.id, content="Test post")
        db.add(post)
        await db.flush()
        db.add(Comment(post_id=post.id, author_id=author.id, content="Nice"))
        await save_post(db, saver.id, post.id)
        await db.flush()

        saved = await get_saved_posts(db, saver.id)
        assert len(saved) == 1
        payload = _to_post_response(saved[0], saver.id, is_saved=True)
        assert payload.content == "Test post"
        assert payload.author_name == "Author"
        assert payload.is_saved is True
        assert payload.comments[0].author_name == "Author"
        assert payload.reaction_counts["LIKE"] == 0
    await engine.dispose()


@pytest.mark.asyncio
async def test_deletion_request_lookup_is_null_until_created():
    engine = _engine()
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with sessions() as db:
        user = User(
            name="Resident",
            email="delete-lookup@example.com",
            password_hash="x",
            role=UserRole.RESIDENT,
            status=UserStatus.APPROVED,
        )
        db.add(user)
        await db.flush()
        assert await get_deletion_request(db, user.id) is None
        created, first_created = await create_or_get_pending_deletion_request(db, user.id, None)
        assert first_created is True
        found = await get_deletion_request(db, user.id)
        assert found is not None
        payload = deletion_request_response(found)
        assert payload.id == created.id
        assert payload.status == "PENDING"
    await engine.dispose()
