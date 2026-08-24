"""Admin APIs for WhatsApp/Telegram compound chat import."""
from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_admin
from app.db.session import get_db
from app.crud.compound import get_compound_by_id
from app.models.chat_import import ChatImportJob
from app.models.enums import (
    ChatImportItemDecision,
    ChatImportItemKind,
    ChatImportJobStatus,
    ChatImportSource,
)
from app.models.moderation import AuditLog
from app.models.user import User
from app.schemas.chat_import import (
    ChatImportItemsPatchRequest,
    ChatImportJobListItem,
    ChatImportJobResponse,
    ChatImportPublishResponse,
)
from app.services.chat_import_parser import detect_and_parse_bytes, summarize_parsed
from app.services.chat_import_classify import enrich_import_items_with_llm
from app.services.chat_import_publish import (
    get_job_with_items,
    publish_chat_import_job,
    replace_job_items_from_parse,
)
from app.services.storage import LOCAL_STORAGE_DIR

router = APIRouter()

CHAT_IMPORT_DIR = LOCAL_STORAGE_DIR / "chat-imports"
CHAT_IMPORT_DIR.mkdir(parents=True, exist_ok=True)


def _job_response(job: ChatImportJob) -> ChatImportJobResponse:
    return ChatImportJobResponse.model_validate(job)


@router.get("/chat-imports", response_model=list[ChatImportJobListItem])
async def list_chat_imports(
    compound_id: int | None = None,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(ChatImportJob).order_by(ChatImportJob.id.desc())
    if compound_id is not None:
        query = query.where(ChatImportJob.compound_id == compound_id)
    result = await db.execute(query.limit(100))
    return list(result.scalars().all())


@router.post("/chat-imports", response_model=ChatImportJobResponse, status_code=201)
async def create_chat_import(
    compound_id: int = Form(...),
    source: ChatImportSource = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    compound = await get_compound_by_id(db, compound_id)
    if not compound:
        raise HTTPException(status_code=404, detail="Compound not found")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty upload")

    job = ChatImportJob(
        compound_id=compound_id,
        uploaded_by_id=current_user.id,
        source=source,
        status=ChatImportJobStatus.UPLOADED,
        original_filename=file.filename,
        stats={},
    )
    db.add(job)
    await db.flush()

    job_dir = CHAT_IMPORT_DIR / str(job.id)
    job_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(file.filename or "export.bin").name
    storage_path = job_dir / safe_name
    storage_path.write_bytes(content)
    job.storage_path = str(storage_path)

    db.add(
        AuditLog(
            actor_id=current_user.id,
            event_type="chat_import.upload",
            entity_type="CHAT_IMPORT_JOB",
            entity_id=str(job.id),
            data={
                "compound_id": compound_id,
                "source": source.value,
                "filename": safe_name,
                "bytes": len(content),
            },
        )
    )
    await db.commit()
    job = await get_job_with_items(db, job.id)
    return _job_response(job)


@router.get("/chat-imports/{job_id}", response_model=ChatImportJobResponse)
async def get_chat_import(
    job_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    job = await get_job_with_items(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    return _job_response(job)


@router.post("/chat-imports/{job_id}/parse", response_model=ChatImportJobResponse)
async def parse_chat_import(
    job_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    job = await get_job_with_items(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    if not job.storage_path or not Path(job.storage_path).exists():
        raise HTTPException(status_code=400, detail="Uploaded file missing")

    storage_path = Path(job.storage_path)
    original_filename = job.original_filename
    source = job.source

    # Commit PARSING immediately so the UI can show progress and we don't hold
    # a DB transaction open during ZIP parse + optional LLM calls.
    job.status = ChatImportJobStatus.PARSING
    job.error_message = None
    await db.commit()

    try:
        content = storage_path.read_bytes()
        parsed = detect_and_parse_bytes(content, original_filename, source)
        # Cheap LLM refine on ambiguous/commercial messages only (soft-fails)
        llm_stats = await enrich_import_items_with_llm(parsed.items)
        stats = summarize_parsed(parsed)
        stats.update(llm_stats)

        job = await get_job_with_items(db, job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Import job not found")
        await replace_job_items_from_parse(
            db, job, parsed.users, parsed.items, stats
        )
        db.add(
            AuditLog(
                actor_id=current_user.id,
                event_type="chat_import.parse",
                entity_type="CHAT_IMPORT_JOB",
                entity_id=str(job.id),
                data={"stats": stats},
            )
        )
        await db.commit()
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        job = await get_job_with_items(db, job_id)
        if job:
            job.status = ChatImportJobStatus.FAILED
            job.error_message = str(exc)[:1000]
            await db.commit()
        raise HTTPException(status_code=400, detail=f"Parse failed: {exc}") from exc

    job = await get_job_with_items(db, job_id)
    return _job_response(job)


@router.patch("/chat-imports/{job_id}/items", response_model=ChatImportJobResponse)
async def patch_chat_import_items(
    job_id: int,
    body: ChatImportItemsPatchRequest,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    job = await get_job_with_items(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    if job.status not in (
        ChatImportJobStatus.PREVIEW,
        ChatImportJobStatus.UPLOADED,
        ChatImportJobStatus.COMPLETED,
    ):
        raise HTTPException(status_code=400, detail="Job is not editable in current status")

    by_id = {item.id: item for item in job.items}
    for update in body.items:
        item = by_id.get(update.id)
        if not item:
            raise HTTPException(status_code=404, detail=f"Item {update.id} not found")
        if item.published_entity_id:
            continue
        if update.decision is not None:
            item.decision = update.decision
        if update.kind is not None:
            item.kind = update.kind
        if update.normalized is not None:
            item.normalized = {**(item.normalized or {}), **update.normalized}
        if update.reject_reason is not None:
            item.reject_reason = update.reject_reason
        if item.decision == ChatImportItemDecision.REJECTED and not item.reject_reason:
            item.reject_reason = "Rejected by admin"

    await db.commit()
    job = await get_job_with_items(db, job_id)
    return _job_response(job)


@router.post("/chat-imports/{job_id}/publish", response_model=ChatImportPublishResponse)
async def publish_chat_import(
    job_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    job = await get_job_with_items(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    if job.status not in (ChatImportJobStatus.PREVIEW, ChatImportJobStatus.COMPLETED):
        raise HTTPException(status_code=400, detail="Job must be in PREVIEW before publish")

    approved = [
        item
        for item in job.items
        if item.decision == ChatImportItemDecision.APPROVED
        and item.kind
        in (
            ChatImportItemKind.USER,
            ChatImportItemKind.POST,
            ChatImportItemKind.COMMENT,
            ChatImportItemKind.LISTING,
        )
    ]
    if not approved:
        raise HTTPException(status_code=400, detail="No approved items to publish")

    try:
        stats = await publish_chat_import_job(db, job, actor_id=current_user.id)
        await db.commit()
    except Exception as exc:  # noqa: BLE001
        await db.rollback()
        job = await get_job_with_items(db, job_id)
        if job:
            job.status = ChatImportJobStatus.FAILED
            job.error_message = str(exc)[:1000]
            await db.commit()
        raise HTTPException(status_code=400, detail=f"Publish failed: {exc}") from exc

    job = await get_job_with_items(db, job_id)
    return ChatImportPublishResponse(
        job_id=job.id,
        status=job.status,
        stats=stats,
    )


@router.delete("/chat-imports/{job_id}", status_code=204)
async def delete_chat_import(
    job_id: int,
    current_user: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    job = await get_job_with_items(db, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    if job.status == ChatImportJobStatus.PUBLISHING:
        raise HTTPException(status_code=400, detail="Cannot delete while publishing")

    storage_path = job.storage_path
    await db.delete(job)
    db.add(
        AuditLog(
            actor_id=current_user.id,
            event_type="chat_import.delete",
            entity_type="CHAT_IMPORT_JOB",
            entity_id=str(job_id),
            data={},
        )
    )
    await db.commit()

    if storage_path:
        job_dir = Path(storage_path).parent
        if job_dir.exists() and job_dir.parent == CHAT_IMPORT_DIR:
            shutil.rmtree(job_dir, ignore_errors=True)
    return None
