"""Helper functions for checking user verification status for compounds."""
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.models.enums import DocumentStatus, DocumentType, UserStatus
from app.crud.verification import get_user_documents
from app.crud.user_compound_membership import (
    ensure_user_compound_membership,
    user_has_compound_membership,
)


async def is_user_verified_for_compound(
    db: AsyncSession,
    user: User,
    compound_id: int
) -> bool:
    """
    Check if a user is verified for a specific compound via approved documents.
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        await db.refresh(user)

        if user.status != UserStatus.APPROVED and user.compound_id:
            docs = await get_user_documents(db, user.id, compound_id)
            national_id = docs.get(DocumentType.NATIONAL_ID)
            contract = docs.get(DocumentType.CONTRACT)

            if (
                national_id and national_id.status == DocumentStatus.APPROVED
            ) or (
                contract and contract.status == DocumentStatus.APPROVED
            ):
                user.status = UserStatus.APPROVED
                await db.commit()
                await db.refresh(user)
                await ensure_user_compound_membership(db, user.id, compound_id)
                await db.commit()

        if user.status != UserStatus.APPROVED:
            return False

        has_membership = await user_has_compound_membership(db, user, compound_id)
        logger.info(
            "User %s verified for compound %s: %s",
            user.id,
            compound_id,
            has_membership,
        )
        return has_membership
    except Exception as e:
        logger.error(f"Error checking verification for user {user.id}: {e}", exc_info=True)
        return False
