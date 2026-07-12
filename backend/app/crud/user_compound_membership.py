"""CRUD helpers for user verified compound memberships."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.compound import Compound
from app.models.user_compound_membership import UserCompoundMembership
from app.models.enums import UserStatus, DocumentStatus, DocumentType
from app.crud.verification import get_user_documents


async def ensure_user_compound_membership(
    db: AsyncSession, user_id: int, compound_id: int
) -> None:
    """Add a verified compound membership if it does not exist."""
    if not compound_id:
        return
    existing = await db.execute(
        select(UserCompoundMembership).where(
            UserCompoundMembership.user_id == user_id,
            UserCompoundMembership.compound_id == compound_id,
        )
    )
    if existing.scalar_one_or_none():
        return
    db.add(UserCompoundMembership(user_id=user_id, compound_id=compound_id))
    await db.flush()


async def get_membership_compound_ids(db: AsyncSession, user_id: int) -> set[int]:
    result = await db.execute(
        select(UserCompoundMembership.compound_id).where(
            UserCompoundMembership.user_id == user_id
        )
    )
    return set(result.scalars().all())


async def extract_compound_ids_from_documents(db: AsyncSession, user: User) -> set[int]:
    """Infer compound IDs from approved verification document LLM data."""
    if user.status != UserStatus.APPROVED:
        return set()

    docs = await get_user_documents(db, user.id)
    national_id = docs.get(DocumentType.NATIONAL_ID)
    contract = docs.get(DocumentType.CONTRACT)
    compound_ids: set[int] = set()

    async def add_matches_from_name(compound_name: str | None) -> None:
        if not compound_name:
            return
        result = await db.execute(
            select(Compound).where(Compound.name.ilike(f"{compound_name}%")).limit(10)
        )
        for compound in result.scalars().all():
            compound_ids.add(compound.id)

    if national_id and national_id.status == DocumentStatus.APPROVED and national_id.llm_extracted_info:
        if isinstance(national_id.llm_extracted_info, dict):
            compound_name = (
                national_id.llm_extracted_info.get("compound_name")
                or national_id.llm_extracted_info.get("compound_name_in_address")
                or (
                    national_id.llm_extracted_info.get("address", {}).get("compound")
                    if isinstance(national_id.llm_extracted_info.get("address"), dict)
                    else None
                )
            )
            await add_matches_from_name(compound_name)

    if contract and contract.status == DocumentStatus.APPROVED and contract.llm_extracted_info:
        if isinstance(contract.llm_extracted_info, dict):
            compound_name = contract.llm_extracted_info.get("compound_name") or (
                contract.llm_extracted_info.get("property_address", {}).get("compound")
                if isinstance(contract.llm_extracted_info.get("property_address"), dict)
                else None
            )
            await add_matches_from_name(compound_name)

    return compound_ids


async def get_verified_compound_ids(
    db: AsyncSession,
    user: User,
    *,
    persist_inferred: bool = False,
) -> set[int]:
    """
    Compound IDs the user may access.
    Primary source: approved verification documents. Stored memberships without
    document proof are not trusted (prevents skipping verification for new compounds).
    """
    compound_ids = set(await extract_compound_ids_from_documents(db, user))
    stored = await get_membership_compound_ids(db, user.id)

    if user.status != UserStatus.APPROVED:
        return stored

    if not compound_ids and stored:
        docs = await get_user_documents(db, user.id)
        has_approved = any(
            d and d.status == DocumentStatus.APPROVED
            for d in (docs.get(DocumentType.NATIONAL_ID), docs.get(DocumentType.CONTRACT))
        )
        if has_approved and len(stored) == 1:
            compound_ids = set(stored)

    if persist_inferred:
        for compound_id in compound_ids:
            await ensure_user_compound_membership(db, user.id, compound_id)

    return compound_ids


async def sync_user_compound_memberships(db: AsyncSession, user: User) -> set[int]:
    """Return verified compound IDs and persist document-inferred memberships."""
    return await get_verified_compound_ids(db, user, persist_inferred=True)


async def user_has_compound_membership(
    db: AsyncSession, user: User, compound_id: int
) -> bool:
    compound_ids = await sync_user_compound_memberships(db, user)
    return compound_id in compound_ids


async def reset_verification_for_new_compound(db: AsyncSession, user_id: int) -> None:
    """Clear prior verification so the user must submit documents for a new neighbourhood."""
    from app.models.verification import VerificationDocument

    result = await db.execute(
        select(VerificationDocument).where(VerificationDocument.user_id == user_id)
    )
    for doc in result.scalars().all():
        doc.status = DocumentStatus.PENDING
        doc.notes = "Re-verification required for new neighbourhood"
        doc.reviewer_id = None
        doc.llm_verified = None
        doc.llm_confidence = None
        doc.llm_recommendation = None
        doc.llm_reasoning = None
        doc.llm_issues = None
        doc.llm_extracted_info = None
        doc.llm_verified_at = None
    await db.flush()
