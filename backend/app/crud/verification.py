from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.verification import VerificationDocument
from app.models.user import User
from app.models.enums import DocumentType, DocumentStatus, UserStatus


def compute_verification_status(
    user: User,
    national_id: VerificationDocument | None,
    contract: VerificationDocument | None,
    *,
    is_verified_for_current_compound: bool = False,
) -> str:
    """Client-facing verification status for the active compound."""
    has_submitted_docs = bool(national_id or contract)

    if is_verified_for_current_compound:
        return "APPROVED"
    if user.status in (UserStatus.REJECTED, UserStatus.BANNED):
        return "REJECTED"

    for doc in (national_id, contract):
        if doc and doc.status in (
            DocumentStatus.REJECTED,
            DocumentStatus.REQUEST_MORE_DETAILS,
        ):
            return "REJECTED"

    if has_submitted_docs:
        for doc in (national_id, contract):
            if doc and doc.status == DocumentStatus.PENDING:
                return "PENDING"
        if national_id or contract:
            return "PENDING"

    if user.status == UserStatus.PENDING_VERIFICATION and has_submitted_docs:
        return "PENDING"
    return "UNVERIFIED"


def _docs_dict(documents: list[VerificationDocument]) -> dict[DocumentType, VerificationDocument | None]:
    return {
        DocumentType.NATIONAL_ID: next(
            (d for d in documents if d.type == DocumentType.NATIONAL_ID), None
        ),
        DocumentType.CONTRACT: next(
            (d for d in documents if d.type == DocumentType.CONTRACT), None
        ),
    }


async def get_user_documents(
    db: AsyncSession,
    user_id: int,
    compound_id: int | None = None,
) -> dict[DocumentType, VerificationDocument | None]:
    """Get verification documents for a user, optionally scoped to one compound."""
    query = select(VerificationDocument).where(VerificationDocument.user_id == user_id)
    if compound_id is not None:
        query = query.where(VerificationDocument.compound_id == compound_id)
    result = await db.execute(query)
    return _docs_dict(list(result.scalars().all()))


async def create_document(
    db: AsyncSession,
    user_id: int,
    document_type: DocumentType,
    file_url: str,
    compound_id: int,
) -> VerificationDocument:
    """Create or replace a verification document for a specific compound."""
    existing = await db.execute(
        select(VerificationDocument).where(
            VerificationDocument.user_id == user_id,
            VerificationDocument.type == document_type,
            VerificationDocument.compound_id == compound_id,
        )
    )
    existing_doc = existing.scalar_one_or_none()

    if existing_doc:
        existing_doc.file_url = file_url
        existing_doc.status = DocumentStatus.PENDING
        existing_doc.notes = None
        existing_doc.reviewer_id = None
        existing_doc.llm_verified = None
        existing_doc.llm_confidence = None
        existing_doc.llm_recommendation = None
        existing_doc.llm_reasoning = None
        existing_doc.llm_issues = None
        existing_doc.llm_extracted_info = None
        existing_doc.llm_verified_at = None
        await db.flush()
        await db.refresh(existing_doc)
        return existing_doc

    db_doc = VerificationDocument(
        user_id=user_id,
        compound_id=compound_id,
        type=document_type,
        file_url=file_url,
        status=DocumentStatus.PENDING,
    )
    db.add(db_doc)
    await db.flush()
    await db.refresh(db_doc)

    await check_and_update_user_status(db, user_id, compound_id)
    return db_doc


async def check_and_update_user_status(
    db: AsyncSession, user_id: int, compound_id: int | None = None
):
    """Check if user has both documents for a compound (status update on admin approval)."""
    if compound_id is None:
        return
    docs = await get_user_documents(db, user_id, compound_id)
    if docs[DocumentType.NATIONAL_ID] and docs[DocumentType.CONTRACT]:
        pass


def has_compound_name_in_document(doc: VerificationDocument) -> bool:
    """Check if document's LLM extracted info indicates compound name was found."""
    if not doc.llm_extracted_info or not isinstance(doc.llm_extracted_info, dict):
        return False

    compound_found = doc.llm_extracted_info.get("compound_name_in_address", False)
    if compound_found:
        return True

    address_match = doc.llm_extracted_info.get("address_match", "")
    return address_match == "MATCH"


async def _promote_user_if_any_doc_approved(
    db: AsyncSession, user_id: int, compound_id: int | None = None
) -> None:
    """When admin approves a document, approve the user if any doc is approved for that compound."""
    docs = await get_user_documents(db, user_id, compound_id)
    national_id = docs[DocumentType.NATIONAL_ID]
    contract = docs[DocumentType.CONTRACT]

    user = await db.get(User, user_id)
    if not user:
        return

    has_approved = (
        national_id and national_id.status == DocumentStatus.APPROVED
    ) or (contract and contract.status == DocumentStatus.APPROVED)
    if not has_approved:
        return

    if user.status != UserStatus.APPROVED:
        user.status = UserStatus.APPROVED
        await db.flush()
        try:
            from app.services.notifications import notify_verification_approved
            await notify_verification_approved(db, user.id)
        except Exception:
            pass


async def approve_document(
    db: AsyncSession, doc_id: int, reviewer_id: int, notes: str | None = None
) -> VerificationDocument:
    """Approve a verification document (works from any prior status — admin override)."""
    doc = await db.get(VerificationDocument, doc_id)
    if not doc:
        raise ValueError("Document not found")

    previous_status = doc.status
    doc.status = DocumentStatus.APPROVED
    doc.reviewer_id = reviewer_id
    if notes is not None:
        doc.notes = notes
    elif previous_status not in (DocumentStatus.APPROVED, DocumentStatus.PENDING):
        doc.notes = f"[Admin override: {previous_status.value} → APPROVED]"

    await db.flush()

    membership_compound_id = doc.compound_id
    if membership_compound_id:
        from app.crud.user_compound_membership import ensure_user_compound_membership
        await ensure_user_compound_membership(db, doc.user_id, membership_compound_id)

    await _promote_user_if_any_doc_approved(db, doc.user_id, doc.compound_id)

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

    from app.services.notifications import notify_verification_rejected
    await notify_verification_rejected(db, doc.user_id, notes)

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

    from app.services.notifications import notify_verification_request_more
    await notify_verification_request_more(db, doc.user_id, notes)

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

    if new_status == DocumentStatus.APPROVED:
        if doc.compound_id:
            from app.crud.user_compound_membership import ensure_user_compound_membership
            await ensure_user_compound_membership(db, doc.user_id, doc.compound_id)
        await _promote_user_if_any_doc_approved(db, doc.user_id, doc.compound_id)

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
    search_query: str | None = None,
    document_type: str | None = None,
    compound_id: int | None = None,
    sort_by: str = "created_at_desc",
) -> tuple[list[VerificationDocument], int]:
    """
    Get verification documents with optional filters, search, and sorting.
    Returns (documents, total_count).
    """
    from sqlalchemy import or_, func, desc, asc, and_
    from app.models.user import User
    from app.models.enums import DocumentType

    query = select(VerificationDocument).join(User, VerificationDocument.user_id == User.id)
    count_query = select(func.count()).select_from(VerificationDocument).join(
        User, VerificationDocument.user_id == User.id
    )

    if status_filter is not None:
        query = query.where(VerificationDocument.status == status_filter)
        count_query = count_query.where(VerificationDocument.status == status_filter)

    if document_type:
        try:
            doc_type = DocumentType[document_type.upper()]
            query = query.where(VerificationDocument.type == doc_type)
            count_query = count_query.where(VerificationDocument.type == doc_type)
        except KeyError:
            pass

    if compound_id:
        query = query.where(
            or_(
                VerificationDocument.compound_id == compound_id,
                and_(
                    VerificationDocument.compound_id.is_(None),
                    User.compound_id == compound_id,
                ),
            )
        )
        count_query = count_query.where(
            or_(
                VerificationDocument.compound_id == compound_id,
                and_(
                    VerificationDocument.compound_id.is_(None),
                    User.compound_id == compound_id,
                ),
            )
        )

    if search_query:
        search_pattern = f"%{search_query.lower()}%"
        search_filter = or_(
            User.name.ilike(search_pattern),
            User.email.ilike(search_pattern),
            VerificationDocument.notes.ilike(search_pattern),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if sort_by == "created_at_asc":
        query = query.order_by(asc(VerificationDocument.created_at))
    elif sort_by == "created_at_desc":
        query = query.order_by(desc(VerificationDocument.created_at))
    elif sort_by == "user_name_asc":
        query = query.order_by(asc(User.name))
    elif sort_by == "user_name_desc":
        query = query.order_by(desc(User.name))
    elif sort_by == "status_asc":
        query = query.order_by(asc(VerificationDocument.status))
    elif sort_by == "status_desc":
        query = query.order_by(desc(VerificationDocument.status))
    else:
        query = query.order_by(desc(VerificationDocument.created_at))

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.offset(skip).limit(limit)

    result = await db.execute(query)
    documents = list(result.scalars().all())

    return documents, total
