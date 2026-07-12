"""CRUD helpers for user verified compound memberships."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.compound import Compound
from app.models.user_compound_membership import UserCompoundMembership
from app.models.enums import UserStatus, DocumentStatus
from app.models.verification import VerificationDocument


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


def _compound_name_from_doc_llm(doc: VerificationDocument) -> str | None:
    """Best-effort compound name from LLM extraction on an approved document."""
    if not doc.llm_extracted_info or not isinstance(doc.llm_extracted_info, dict):
        return None
    info = doc.llm_extracted_info

    for key in ("compound_name", "compound_name_in_address"):
        value = info.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if value is True:
            address = info.get("address")
            if isinstance(address, dict):
                compound = address.get("compound")
                if isinstance(compound, str) and compound.strip():
                    return compound.strip()

    address = info.get("address")
    if isinstance(address, dict):
        compound = address.get("compound")
        if isinstance(compound, str) and compound.strip():
            return compound.strip()

    property_address = info.get("property_address")
    if isinstance(property_address, dict):
        compound = property_address.get("compound")
        if isinstance(compound, str) and compound.strip():
            return compound.strip()

    return None


async def _compound_ids_matching_name(
    db: AsyncSession, compound_name: str | None
) -> set[int]:
    if not compound_name:
        return set()
    result = await db.execute(
        select(Compound.id).where(Compound.name.ilike(f"{compound_name.strip()}%")).limit(10)
    )
    return set(result.scalars().all())


async def _get_approved_documents(db: AsyncSession, user_id: int) -> list[VerificationDocument]:
    result = await db.execute(
        select(VerificationDocument).where(
            VerificationDocument.user_id == user_id,
            VerificationDocument.status == DocumentStatus.APPROVED,
        )
    )
    return list(result.scalars().all())


async def extract_compound_ids_from_documents(db: AsyncSession, user: User) -> set[int]:
    """
    Compound IDs inferred from all approved verification documents.
    Uses both stored compound_id and LLM-extracted compound names so historical
    verifications (e.g. Palm Hills) are not lost when the user switches compound.
    """
    compound_ids: set[int] = set()
    for doc in await _get_approved_documents(db, user.id):
        if doc.compound_id:
            compound_ids.add(doc.compound_id)
        llm_name = _compound_name_from_doc_llm(doc)
        compound_ids |= await _compound_ids_matching_name(db, llm_name)
    return compound_ids


async def get_verified_compound_ids(
    db: AsyncSession,
    user: User,
    *,
    persist_inferred: bool = False,
) -> set[int]:
    """
    Compound IDs the user may access.
    Approved users: document inference + all stored memberships (includes admin grants).
    """
    compound_ids = set(await extract_compound_ids_from_documents(db, user))
    stored = await get_membership_compound_ids(db, user.id)

    if user.status == UserStatus.APPROVED:
        compound_ids |= stored

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


async def remove_user_compound_membership(
    db: AsyncSession, user_id: int, compound_id: int
) -> bool:
    """Remove a compound membership. Returns True if a row was deleted."""
    result = await db.execute(
        select(UserCompoundMembership).where(
            UserCompoundMembership.user_id == user_id,
            UserCompoundMembership.compound_id == compound_id,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        return False
    await db.delete(membership)
    await db.flush()
    return True


async def admin_sync_user_compounds(
    db: AsyncSession,
    user: User,
    compound_ids: list[int],
    *,
    primary_compound_id: int | None = None,
    approve_user: bool = False,
) -> set[int]:
    """
    Replace a user's compound memberships with the given list (admin override).
    Optionally set primary compound and approve the user account.
    """
    from app.crud.compound import get_compound_by_id

    unique_ids = list(dict.fromkeys(compound_ids))
    for compound_id in unique_ids:
        compound = await get_compound_by_id(db, compound_id)
        if not compound:
            raise ValueError(f"Compound {compound_id} not found")

    if primary_compound_id is not None and primary_compound_id not in unique_ids:
        raise ValueError("Primary compound must be included in compound_ids")

    current = await get_membership_compound_ids(db, user.id)
    to_remove = current - set(unique_ids)
    for compound_id in to_remove:
        await remove_user_compound_membership(db, user.id, compound_id)

    for compound_id in unique_ids:
        await ensure_user_compound_membership(db, user.id, compound_id)

    if primary_compound_id is not None:
        user.compound_id = primary_compound_id
    elif unique_ids:
        if user.compound_id not in unique_ids:
            user.compound_id = unique_ids[0]
    elif user.compound_id is not None:
        user.compound_id = None

    if approve_user and user.status != UserStatus.APPROVED:
        user.status = UserStatus.APPROVED

    await db.flush()
    return set(unique_ids)
