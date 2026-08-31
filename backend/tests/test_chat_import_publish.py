import pytest
from sqlalchemy import func, select

from app.models.chat_import import ChatImportItem, ChatImportJob
from app.models.compound import Compound
from app.models.enums import (
    ChatImportItemDecision,
    ChatImportItemKind,
    ChatImportJobStatus,
    ChatImportSource,
)
from app.models.post import Comment, Post
from app.services.chat_import_publish import publish_chat_import_job


@pytest.mark.asyncio
@pytest.mark.unit
async def test_publish_chat_import_creates_posts_and_comments_in_bulk(db_session):
    compound = Compound(name="Import Bulk Compound", country="Egypt")
    db_session.add(compound)
    await db_session.flush()

    job = ChatImportJob(
        compound_id=compound.id,
        source=ChatImportSource.WHATSAPP,
        status=ChatImportJobStatus.PREVIEW,
        original_filename="chat.txt",
        stats={},
    )
    db_session.add(job)
    await db_session.flush()

    db_session.add_all(
        [
            ChatImportItem(
                job_id=job.id,
                kind=ChatImportItemKind.POST,
                decision=ChatImportItemDecision.APPROVED,
                raw_payload={},
                normalized={
                    "phone": "+201111111111",
                    "name": "Ali",
                    "content": "Hello neighbours",
                    "message_index": 1,
                    "post_category": "GENERAL",
                },
            ),
            ChatImportItem(
                job_id=job.id,
                kind=ChatImportItemKind.POST,
                decision=ChatImportItemDecision.APPROVED,
                raw_payload={},
                normalized={
                    "phone": "+201111111111",
                    "name": "Ali",
                    "content": "Second post",
                    "message_index": 2,
                    "post_category": "GENERAL",
                },
            ),
            ChatImportItem(
                job_id=job.id,
                kind=ChatImportItemKind.COMMENT,
                decision=ChatImportItemDecision.APPROVED,
                raw_payload={},
                normalized={
                    "phone": "+201222222222",
                    "name": "Mona",
                    "content": "Nice",
                    "parent_message_index": 1,
                },
            ),
        ]
    )
    await db_session.commit()

    stats = await publish_chat_import_job(db_session, job, actor_id=None)
    await db_session.commit()

    assert stats["errors"] == 0
    assert stats["posts_published"] == 2
    assert stats["comments_published"] == 1
    assert stats["users_created_or_matched"] == 2

    post_count = (
        await db_session.execute(
            select(func.count()).select_from(Post).where(Post.compound_id == compound.id)
        )
    ).scalar()
    comment_count = (
        await db_session.execute(select(func.count()).select_from(Comment))
    ).scalar()
    assert post_count == 2
    assert comment_count == 1
    assert job.status == ChatImportJobStatus.COMPLETED
