from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.verification import VerificationDocument
from app.models.enums import DocumentType, DocumentStatus
from app.models.user import User
from app.models.enums import UserStatus


async def get_user_documents(
    db: AsyncSession, user_id: int
) -> dict[DocumentType, VerificationDocument | None]:
    """Get all verification documents for a user."""
    result = await db.execute(
        select(VerificationDocument).where(VerificationDocument.user_id == user_id)
    )
    documents = result.scalars().all()

    return {
        DocumentType.NATIONAL_ID: next(
            (d for d in documents if d.type == DocumentType.NATIONAL_ID), None
        ),
        DocumentType.CONTRACT: next(
            (d for d in documents if d.type == DocumentType.CONTRACT), None
        ),
    }


async def create_document(
    db: AsyncSession, user_id: int, document_type: DocumentType, file_url: str
) -> VerificationDocument:
    """Create a verification document."""
    # Check if document of this type already exists
    existing = await db.execute(
        select(VerificationDocument).where(
            VerificationDocument.user_id == user_id,
            VerificationDocument.type == document_type,
        )
    )
    existing_doc = existing.scalar_one_or_none()

    if existing_doc:
        # Update existing document
        existing_doc.file_url = file_url
        existing_doc.status = DocumentStatus.PENDING
        existing_doc.notes = None
        await db.flush()
        await db.refresh(existing_doc)
        return existing_doc

    db_doc = VerificationDocument(
        user_id=user_id,
        type=document_type,
        file_url=file_url,
        status=DocumentStatus.PENDING,
    )
    db.add(db_doc)
    await db.flush()
    await db.refresh(db_doc)

    # Check if user should be auto-approved (both documents uploaded)
    await check_and_update_user_status(db, user_id)

    return db_doc


async def check_and_update_user_status(db: AsyncSession, user_id: int):
    """Check if user has both documents and update status if needed."""
    docs = await get_user_documents(db, user_id)

    if docs[DocumentType.NATIONAL_ID] and docs[DocumentType.CONTRACT]:
        # Both documents exist, but status update happens on admin approval
        pass


async def approve_document(
    db: AsyncSession, doc_id: int, reviewer_id: int, notes: str | None = None
) -> VerificationDocument:
    """Approve a verification document."""
    doc = await db.get(VerificationDocument, doc_id)
    if not doc:
        raise ValueError("Document not found")

    doc.status = DocumentStatus.APPROVED
    doc.reviewer_id = reviewer_id
    doc.notes = notes

    await db.flush()

    # Check if both documents are approved, then approve user
    docs = await get_user_documents(db, doc.user_id)
    if (
        docs[DocumentType.NATIONAL_ID]
        and docs[DocumentType.NATIONAL_ID].status == DocumentStatus.APPROVED
        and docs[DocumentType.CONTRACT]
        and docs[DocumentType.CONTRACT].status == DocumentStatus.APPROVED
    ):
        user = await db.get(User, doc.user_id)
        if user and user.status == UserStatus.PENDING_VERIFICATION:
            user.status = UserStatus.APPROVED

    await db.refresh(doc)
    return doc


async def reject_document(
    db: AsyncSession, doc_id: int, reviewer_id: int, notes: str | None = None
) -> VerificationDocument:
    """Reject a verification document."""
    doc = await db.get(VerificationDocument, doc_id)
    if not doc:
        raise ValueError("Document not found")

    doc.status = DocumentStatus.REJECTED
    doc.reviewer_id = reviewer_id
    doc.notes = notes

    await db.flush()
    await db.refresh(doc)
    return doc


async def request_more_details_document(
    db: AsyncSession, doc_id: int, reviewer_id: int, notes: str | None = None
) -> VerificationDocument:
    """Request more details for a verification document."""
    doc = await db.get(VerificationDocument, doc_id)
    if not doc:
        raise ValueError("Document not found")

    doc.status = DocumentStatus.REQUEST_MORE_DETAILS
    doc.reviewer_id = reviewer_id
    doc.notes = notes

    await db.flush()
    await db.refresh(doc)
    return doc


async def update_document_status(
    db: AsyncSession,
    doc_id: int,
    new_status: DocumentStatus,
    reviewer_id: int,
    notes: str | None = None,
) -> VerificationDocument:
    """Update document status to any valid status."""
    doc = await db.get(VerificationDocument, doc_id)
    if not doc:
        raise ValueError("Document not found")

    doc.status = new_status
    doc.reviewer_id = reviewer_id
    if notes is not None:
        doc.notes = notes

    await db.flush()

    # Check if both documents are approved, then approve user
    if new_status == DocumentStatus.APPROVED:
        docs = await get_user_documents(db, doc.user_id)
        if (
            docs[DocumentType.NATIONAL_ID]
            and docs[DocumentType.NATIONAL_ID].status == DocumentStatus.APPROVED
            and docs[DocumentType.CONTRACT]
            and docs[DocumentType.CONTRACT].status == DocumentStatus.APPROVED
        ):
            from app.models.user import User
            from app.models.enums import UserStatus

            user = await db.get(User, doc.user_id)
            if user and user.status == UserStatus.PENDING_VERIFICATION:
                user.status = UserStatus.APPROVED

    await db.refresh(doc)
    return doc


async def get_pending_documents(
    db: AsyncSession, skip: int = 0, limit: int = 100
) -> list[VerificationDocument]:
    """Get all pending verification documents."""
    result = await db.execute(
        select(VerificationDocument)
        .where(VerificationDocument.status == DocumentStatus.PENDING)
        .offset(skip)
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_documents_with_status(
    db: AsyncSession,
    status_filter: DocumentStatus | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[VerificationDocument]:
    """Get verification documents with optional status filter. If status_filter is None, returns all documents."""
    query = select(VerificationDocument).order_by(
        VerificationDocument.created_at.desc()
    )

    if status_filter is not None:
        query = query.where(VerificationDocument.status == status_filter)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())
