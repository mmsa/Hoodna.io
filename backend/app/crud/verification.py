from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.verification import VerificationDocument
from app.models.enums import DocumentType, DocumentStatus, UserStatus


def compute_verification_status(
    user: User,
    national_id: VerificationDocument | None,
    contract: VerificationDocument | None,
) -> str:
    """Client-facing verification status: UNVERIFIED | PENDING | APPROVED | REJECTED."""
    has_submitted_docs = bool(national_id or contract)

    if user.status == UserStatus.APPROVED:
        return "APPROVED"
    if user.status in (UserStatus.REJECTED, UserStatus.BANNED):
        return "REJECTED"

    for doc in (national_id, contract):
        if doc and doc.status in (
            DocumentStatus.REJECTED,
            DocumentStatus.REQUEST_MORE_DETAILS,
        ):
            return "REJECTED"

    if user.status == UserStatus.PENDING_VERIFICATION:
        return "PENDING" if has_submitted_docs else "UNVERIFIED"
    return "UNVERIFIED"


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


def has_compound_name_in_document(doc: VerificationDocument) -> bool:
    """Check if document's LLM extracted info indicates compound name was found."""
    if not doc.llm_extracted_info or not isinstance(doc.llm_extracted_info, dict):
        return False
    
    # Check for compound_name_in_address field
    compound_found = doc.llm_extracted_info.get("compound_name_in_address", False)
    if compound_found:
        return True
    
    # Also check address_match field
    address_match = doc.llm_extracted_info.get("address_match", "")
    return address_match == "MATCH"


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

    user = await db.get(User, doc.user_id)
    if user and user.compound_id:
        from app.crud.user_compound_membership import ensure_user_compound_membership
        await ensure_user_compound_membership(db, user.id, user.compound_id)

    # Check if user can be approved based on new rules:
    # 1. National ID approved + has compound name → approve user
    # 2. Contract approved (name match + compound match) → approve user  
    # 3. Both documents approved → approve user
    docs = await get_user_documents(db, doc.user_id)
    national_id = docs[DocumentType.NATIONAL_ID]
    contract = docs[DocumentType.CONTRACT]
    
    if not user or user.status != UserStatus.PENDING_VERIFICATION:
        await db.refresh(doc)
        return doc
    
    # Rule 1: National ID approved + has compound name → sufficient alone
    if (
        national_id
        and national_id.status == DocumentStatus.APPROVED
        and has_compound_name_in_document(national_id)
    ):
        user.status = UserStatus.APPROVED
        await db.flush()
        # Send notification
        from app.services.notifications import notify_verification_approved
        await notify_verification_approved(db, user.id)
        await db.refresh(doc)
        return doc
    
    # Rule 2: Contract approved + name match + compound match → sufficient alone
    if (
        contract
        and contract.status == DocumentStatus.APPROVED
        and contract.llm_extracted_info
        and isinstance(contract.llm_extracted_info, dict)
    ):
        name_match = contract.llm_extracted_info.get("name_match", "")
        if name_match == "MATCH" and has_compound_name_in_document(contract):
            user.status = UserStatus.APPROVED
            await db.flush()
            # Send notification
            from app.services.notifications import notify_verification_approved
            await notify_verification_approved(db, user.id)
            await db.refresh(doc)
            return doc
    
    # Rule 3: Both documents approved → approve user
    if (
        national_id
        and national_id.status == DocumentStatus.APPROVED
        and contract
        and contract.status == DocumentStatus.APPROVED
    ):
        user.status = UserStatus.APPROVED
        await db.flush()
        # Send notification
        from app.services.notifications import notify_verification_approved
        await notify_verification_approved(db, user.id)

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
    
    # Send notification
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
    
    # Send notification
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

    # Check if user can be approved based on new rules:
    # 1. National ID approved + has compound name → approve user
    # 2. Contract approved (name match + compound match) → approve user  
    # 3. Both documents approved → approve user
    if new_status == DocumentStatus.APPROVED:
        docs = await get_user_documents(db, doc.user_id)
        national_id = docs[DocumentType.NATIONAL_ID]
        contract = docs[DocumentType.CONTRACT]
        
        user = await db.get(User, doc.user_id)
        # Only update user status if they're not already approved
        if user and user.status != UserStatus.APPROVED:
            user_was_approved = False
            
            # If ANY document is approved, approve the user
            if (
                national_id and national_id.status == DocumentStatus.APPROVED
            ) or (
                contract and contract.status == DocumentStatus.APPROVED
            ):
                user.status = UserStatus.APPROVED
                user_was_approved = True
            
            if user_was_approved:
                await db.flush()
                # Send notification
                try:
                    from app.services.notifications import notify_verification_approved
                    await notify_verification_approved(db, user.id)
                except Exception:
                    # Don't fail if notification fails
                    pass

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
    from sqlalchemy import or_, func, desc, asc
    from app.models.user import User
    from app.models.enums import DocumentType
    
    # Base query with joins for search
    query = select(VerificationDocument).join(User, VerificationDocument.user_id == User.id)
    count_query = select(func.count()).select_from(VerificationDocument).join(User, VerificationDocument.user_id == User.id)
    
    # Apply filters
    if status_filter is not None:
        query = query.where(VerificationDocument.status == status_filter)
        count_query = count_query.where(VerificationDocument.status == status_filter)
    
    if document_type:
        try:
            doc_type = DocumentType[document_type.upper()]
            query = query.where(VerificationDocument.type == doc_type)
            count_query = count_query.where(VerificationDocument.type == doc_type)
        except KeyError:
            pass  # Invalid type, ignore filter
    
    if compound_id:
        query = query.where(User.compound_id == compound_id)
        count_query = count_query.where(User.compound_id == compound_id)
    
    # Apply search
    if search_query:
        search_pattern = f"%{search_query.lower()}%"
        search_filter = or_(
            User.name.ilike(search_pattern),
            User.email.ilike(search_pattern),
            VerificationDocument.notes.ilike(search_pattern),
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)
    
    # Apply sorting
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
        # Default: newest first
        query = query.order_by(desc(VerificationDocument.created_at))
    
    # Get total count
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    # Execute query
    result = await db.execute(query)
    documents = list(result.scalars().all())
    
    return documents, total
