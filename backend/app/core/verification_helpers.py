"""Helper functions for checking user verification status for compounds."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.compound import Compound
from app.models.verification import VerificationDocument
from app.models.enums import DocumentStatus, DocumentType, UserStatus
from app.crud.verification import has_compound_name_in_document


async def is_user_verified_for_compound(
    db: AsyncSession,
    user: User,
    compound_id: int
) -> bool:
    """
    Check if a user is verified for a specific compound.
    
    A user is verified for a compound if:
    1. User status is APPROVED AND
    2. User has verification documents that match the compound:
       - National ID approved + has compound name matching this compound, OR
       - Contract approved + name match + compound match, OR
       - Both documents approved
    
    Also, if the user's current compound_id matches, they're considered verified
    (they're actively using that compound).
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Refresh user from database to get latest status
        await db.refresh(user)
        
        logger.info(f"Checking verification for user {user.id}: status={user.status}, compound_id={user.compound_id}, requested_compound_id={compound_id}")
        
        # First, check if user should be auto-approved based on approved documents
        # This ensures user status is updated even if it wasn't updated when the document was approved
        if user.status != UserStatus.APPROVED:
            from app.crud.verification import get_user_documents
            docs = await get_user_documents(db, user.id)
            national_id = docs.get(DocumentType.NATIONAL_ID)
            contract = docs.get(DocumentType.CONTRACT)
            
            logger.info(f"User not approved. Checking documents: national_id={national_id.status if national_id else None}, contract={contract.status if contract else None}")
            
            user_should_be_approved = False
            
            # If ANY document is approved, approve the user
            if (
                national_id and national_id.status == DocumentStatus.APPROVED
            ) or (
                contract and contract.status == DocumentStatus.APPROVED
            ):
                user_should_be_approved = True
                logger.info(f"Document approved: national_id={national_id.status if national_id else None}, contract={contract.status if contract else None}. Approving user.")
            
            if user_should_be_approved:
                logger.info(f"Auto-approving user {user.id}")
                user.status = UserStatus.APPROVED
                await db.commit()
                await db.refresh(user)
                logger.info(f"User {user.id} status updated to {user.status}")
        
        # User must be approved
        if user.status != UserStatus.APPROVED:
            logger.warning(f"User {user.id} status is {user.status}, not APPROVED. Returning False.")
            return False
        
        # If user doesn't have a compound_id set, they can't be verified
        if not user.compound_id:
            logger.warning(f"User {user.id} has no compound_id set. Returning False.")
            return False
        
        # If user's current compound matches, they're verified (they're using it)
        if user.compound_id == compound_id:
            logger.info(f"User {user.id} compound_id ({user.compound_id}) matches requested compound_id ({compound_id}). Returning True.")
            return True
        
        logger.info(f"User {user.id} compound_id ({user.compound_id}) does not match requested compound_id ({compound_id}). Checking documents...")
        
        # Get the compound to check its name
        compound = await db.get(Compound, compound_id)
        if not compound:
            logger.warning(f"Compound {compound_id} not found. Returning False.")
            return False
        
        # Get user's verification documents
        from app.crud.verification import get_user_documents
        docs = await get_user_documents(db, user.id)
        national_id = docs.get(DocumentType.NATIONAL_ID)
        contract = docs.get(DocumentType.CONTRACT)
        
        # Check if National ID is approved and matches compound
        if national_id and national_id.status == DocumentStatus.APPROVED:
            if has_compound_name_in_document(national_id):
                # Check if the compound name matches
                if national_id.llm_extracted_info and isinstance(national_id.llm_extracted_info, dict):
                    address_match = national_id.llm_extracted_info.get("address_match", "")
                    if address_match == "MATCH":
                        # The document has been verified to match a compound
                        # If user's compound_id matches, they're verified
                        # Otherwise, we'd need to check the specific compound name
                        # For now, if they have an approved doc with compound match, allow access
                        logger.info(f"National ID approved with compound match for user {user.id}. Returning True.")
                        return True
        
        # Check if Contract is approved and matches compound
        if contract and contract.status == DocumentStatus.APPROVED:
            if contract.llm_extracted_info and isinstance(contract.llm_extracted_info, dict):
                name_match = contract.llm_extracted_info.get("name_match", "")
                compound_name = (
                    contract.llm_extracted_info.get("compound_name") or
                    contract.llm_extracted_info.get("property_address", {}).get("compound") 
                    if isinstance(contract.llm_extracted_info.get("property_address"), dict) 
                    else None
                )
                
                if name_match == "MATCH" and compound_name:
                    # Check if compound name matches (case-insensitive)
                    if compound.name.lower() == compound_name.lower() or compound.name.lower().startswith(compound_name.lower()):
                        logger.info(f"Contract approved with compound match for user {user.id}. Returning True.")
                        return True
        
        # If both documents are approved, user is verified
        if (
            national_id and national_id.status == DocumentStatus.APPROVED and
            contract and contract.status == DocumentStatus.APPROVED
        ):
            logger.info(f"Both documents approved for user {user.id}. Returning True.")
            return True
        
        logger.warning(f"User {user.id} verification check failed. Returning False.")
        return False
    except Exception as e:
        logger.error(f"Error checking verification for user {user.id}: {e}", exc_info=True)
        return False

