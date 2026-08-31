"""CRUD helpers for user verified compound memberships."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.compound import Compound
from app.models.user_compound_membership import UserCompoundMembership
from app.models.enums import UserStatus, DocumentStatus
from app.models.verification import VerificationDocument


async def ensure_user_compound_membership(
    db: AsyncSession,
    user_id: int,
    compound_id: int,
    *,
    source: str = "DOCUMENT",
) -> None:
    """Create or promote a compound membership to VERIFIED."""
    if not compound_id:
        return
    existing = await db.execute(
        select(UserCompoundMembership).where(
            UserCompoundMembership.user_id == user_id,
            UserCompoundMembership.compound_id == compound_id,
        )
    )
    membership = existing.scalar_one_or_none()
    if membership:
        membership.verification_status = "VERIFIED"
        membership.verification_source = source
        await db.flush()
        return
    db.add(
        UserCompoundMembership(
            user_id=user_id,
            compound_id=compound_id,
            verification_status="VERIFIED",
            verification_source=source,
        )
    )
    await db.flush()


async def ensure_pending_compound_membership(
    db: AsyncSession,
    user_id: int,
    compound_id: int,
    *,
    source: str = "REQUEST",
) -> None:
    """Track requested access without granting community permissions."""
    if not compound_id:
        return
    existing = await db.execute(
        select(UserCompoundMembership).where(
            UserCompoundMembership.user_id == user_id,
            UserCompoundMembership.compound_id == compound_id,
        )
    )
    membership = existing.scalar_one_or_none()
    if membership:
        # Keep VERIFIED as-is. Never replace a chat-import invite with a
        # generic request — that strips the path that auto-approves residents.
        if membership.verification_status == "VERIFIED":
            return
        if membership.verification_source == "CHAT_IMPORT" and source != "CHAT_IMPORT":
            return
        membership.verification_status = "PENDING"
        membership.verification_source = source
        await db.flush()
        return
    db.add(
        UserCompoundMembership(
            user_id=user_id,
            compound_id=compound_id,
            verification_status="PENDING",
            verification_source=source,
        )
    )
    await db.flush()


async def get_membership_compound_ids(db: AsyncSession, user_id: int) -> set[int]:
    result = await db.execute(
        select(UserCompoundMembership.compound_id).where(
            UserCompoundMembership.user_id == user_id,
            UserCompoundMembership.verification_status == "VERIFIED",
        )
    )
    return set(result.scalars().all())


async def _adopt_memberships_from_phone_twins(db: AsyncSession, user: User) -> None:
    """Copy compound memberships from duplicate accounts that share this phone."""
    from app.utils.phone import phone_lookup_candidates

    if not user.phone:
        return
    candidates = phone_lookup_candidates(user.phone)
    if not candidates:
        return
    twins = list(
        (
            await db.execute(
                select(User).where(User.phone.in_(candidates), User.id != user.id)
            )
        ).scalars().all()
    )
    if not twins:
        return
    existing = set(
        (
            await db.execute(
                select(UserCompoundMembership.compound_id).where(
                    UserCompoundMembership.user_id == user.id
                )
            )
        ).scalars().all()
    )
    twin_rows = list(
        (
            await db.execute(
                select(UserCompoundMembership).where(
                    UserCompoundMembership.user_id.in_([twin.id for twin in twins])
                )
            )
        ).scalars().all()
    )
    for row in twin_rows:
        if row.compound_id in existing:
            continue
        db.add(
            UserCompoundMembership(
                user_id=user.id,
                compound_id=row.compound_id,
                verification_status=row.verification_status,
                verification_source=row.verification_source,
            )
        )
        existing.add(row.compound_id)
    if user.compound_id is None:
        for twin in twins:
            if twin.compound_id:
                user.compound_id = twin.compound_id
                break
    await db.flush()


async def sync_primary_compound_from_memberships(db: AsyncSession, user: User) -> set[int]:
    """Attach verified neighbourhoods onto users.compound_id so clients can route to feed."""
    from app.models.enums import UserRole

    await _adopt_memberships_from_phone_twins(db, user)
    verified = await get_membership_compound_ids(db, user.id)
    if verified and (user.compound_id is None or user.compound_id not in verified):
        user.compound_id = sorted(verified)[0]
    if verified:
        if user.status == UserStatus.PENDING_VERIFICATION:
            user.status = UserStatus.APPROVED
        if user.role is None:
            user.role = UserRole.USER
    await db.flush()
    return verified


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

    Membership verification_status is authoritative. Document approval promotes
    a membership at review time; re-inferring on every request would resurrect
    stale compound IDs after an admin corrects a historical mapping.
    """
    return await get_membership_compound_ids(db, user.id)


async def sync_user_compound_memberships(db: AsyncSession, user: User) -> set[int]:
    """Return verified compound IDs and persist document-inferred memberships."""
    return await get_verified_compound_ids(db, user, persist_inferred=True)


async def user_has_compound_membership(
    db: AsyncSession, user: User, compound_id: int
) -> bool:
    compound_ids = await sync_user_compound_memberships(db, user)
    return compound_id in compound_ids


async def get_user_switchable_compounds(db: AsyncSession, user: User) -> list[dict]:
    """
    Compounds the user may switch to: verified memberships plus the current
    compound when still completing verification there.
    """
    from app.crud.compound import get_compound_by_id

    verified_compound_ids = await sync_user_compound_memberships(db, user)
    seen_ids: set[int] = set()
    result: list[dict] = []

    membership_result = await db.execute(
        select(UserCompoundMembership).where(
            UserCompoundMembership.user_id == user.id
        )
    )
    for membership in membership_result.scalars().all():
        compound = await get_compound_by_id(db, membership.compound_id)
        if not compound:
            continue
        is_verified = membership.compound_id in verified_compound_ids
        seen_ids.add(compound.id)
        result.append({
            "id": compound.id,
            "name": compound.name,
            "area": compound.area,
            "is_current": compound.id == user.compound_id,
            "is_verified": is_verified,
            "verification_status": "VERIFIED" if is_verified else "PENDING",
        })

    if user.compound_id and user.compound_id not in seen_ids:
        compound = await get_compound_by_id(db, user.compound_id)
        if compound:
            result.append({
                "id": compound.id,
                "name": compound.name,
                "area": compound.area,
                "is_current": True,
                "is_verified": False,
                "verification_status": "PENDING",
            })

    # Compounds with any verification activity (in-progress, not yet verified)
    doc_result = await db.execute(
        select(VerificationDocument.compound_id)
        .where(
            VerificationDocument.user_id == user.id,
            VerificationDocument.compound_id.isnot(None),
        )
        .distinct()
    )
    for compound_id in doc_result.scalars().all():
        if compound_id is None or compound_id in seen_ids:
            continue
        if compound_id in verified_compound_ids:
            continue
        compound = await get_compound_by_id(db, compound_id)
        if compound:
            seen_ids.add(compound.id)
            result.append({
                "id": compound.id,
                "name": compound.name,
                "area": compound.area,
                "is_current": compound.id == user.compound_id,
                "is_verified": False,
                "verification_status": "PENDING",
            })

    result.sort(key=lambda x: (not x["is_current"], not x["is_verified"], x["name"]))
    return result


async def user_can_switch_to_compound(
    db: AsyncSession, user: User, compound_id: int
) -> bool:
    switchable = await get_user_switchable_compounds(db, user)
    return any(c["id"] == compound_id for c in switchable)


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

    # When an admin corrects a historical one-compound assignment, move approved
    # documents from the removed compound to the selected primary compound.
    # This keeps document history aligned without affecting multi-compound docs
    # that already have a same-type document at the target.
    if primary_compound_id is not None and to_remove:
        docs_result = await db.execute(
            select(VerificationDocument).where(
                VerificationDocument.user_id == user.id,
                VerificationDocument.compound_id.in_(to_remove),
                VerificationDocument.status == DocumentStatus.APPROVED,
            )
        )
        for doc in docs_result.scalars().all():
            target_result = await db.execute(
                select(VerificationDocument).where(
                    VerificationDocument.user_id == user.id,
                    VerificationDocument.compound_id == primary_compound_id,
                    VerificationDocument.type == doc.type,
                    VerificationDocument.id != doc.id,
                )
            )
            if target_result.scalar_one_or_none() is None:
                doc.compound_id = primary_compound_id

    for compound_id in to_remove:
        await remove_user_compound_membership(db, user.id, compound_id)

    for compound_id in unique_ids:
        await ensure_user_compound_membership(
            db, user.id, compound_id, source="ADMIN"
        )

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
