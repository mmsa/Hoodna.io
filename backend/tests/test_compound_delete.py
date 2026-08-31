import pytest
from sqlalchemy import func, select

from app.crud.compound import delete_compound
from app.crud.user import create_user_by_phone
from app.models.compound import Compound
from app.models.enums import PostCategory
from app.models.post import Comment, Post
from app.models.user_compound_membership import UserCompoundMembership


@pytest.mark.asyncio
@pytest.mark.unit
async def test_force_delete_compound_removes_posts_in_bulk(db_session):
    compound = Compound(name="Test Delete Compound", country="Egypt")
    db_session.add(compound)
    await db_session.flush()

    author = await create_user_by_phone(
        db_session, "+201888888888", "Import Author", creation_source="CHAT_IMPORT"
    )
    author.compound_id = compound.id
    db_session.add(
        UserCompoundMembership(
            user_id=author.id,
            compound_id=compound.id,
            verification_status="PENDING",
            verification_source="CHAT_IMPORT",
        )
    )

    posts = [
        Post(
            compound_id=compound.id,
            author_id=author.id,
            content=f"Imported post {index}",
            category=PostCategory.GENERAL,
        )
        for index in range(8)
    ]
    db_session.add_all(posts)
    await db_session.flush()
    db_session.add_all(
        [
            Comment(post_id=post.id, author_id=author.id, content="hi")
            for post in posts
        ]
    )
    await db_session.commit()

    with pytest.raises(PermissionError):
        await delete_compound(db_session, compound.id, force=False)

    stats = await delete_compound(db_session, compound.id, force=True)
    await db_session.commit()

    assert stats["posts"] == 8
    assert stats["imported_users_deleted"] >= 1
    remaining_posts = (
        await db_session.execute(
            select(func.count()).select_from(Post).where(Post.compound_id == compound.id)
        )
    ).scalar()
    assert remaining_posts == 0
    assert await db_session.get(Compound, compound.id) is None
