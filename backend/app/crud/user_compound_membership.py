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


async def sync_user_compound_memberships(db: AsyncSession, user: User) -> set[int]:
    """
    Return all compound IDs the user can switch to.
    Ensures membership rows exist for current compound and document matches.
    """
    compound_ids = await get_membership_compound_ids(db, user.id)

    if user.status != UserStatus.APPROVED:
        return compound_ids

    if user.compound_id:
        compound_ids.add(user.compound_id)
        await ensure_user_compound_membership(db, user.id, user.compound_id)

    for compound_id in await extract_compound_ids_from_documents(db, user):
        compound_ids.add(compound_id)
        await ensure_user_compound_membership(db, user.id, compound_id)

    return compound_ids


async def user_has_compound_membership(
    db: AsyncSession, user: User, compound_id: int
) -> bool:
    compound_ids = await sync_user_compound_memberships(db, user)
    return compound_id in compound_ids
