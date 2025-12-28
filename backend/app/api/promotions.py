from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.marketplace import PromotionCheckout, CheckoutSessionResponse
from app.crud.listing import create_promotion, get_listing_by_id
from app.services.stripe import create_checkout_session
from app.core.dependencies import get_current_approved_user
from app.core.config import settings
from app.models.user import User
from app.models.enums import PromotionScope
from decimal import Decimal

router = APIRouter()

# Pricing configuration (in EGP)
PROMOTION_PRICES = {
    "CROSS_COMPOUND": Decimal("50.00"),  # 50 EGP per week
    "PUBLIC": Decimal("100.00"),  # 100 EGP per week
}


@router.post("/checkout", response_model=CheckoutSessionResponse)
async def create_promotion_checkout(
    checkout_data: PromotionCheckout,
    current_user: User = Depends(get_current_approved_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe checkout session for promoting a listing."""
    # Verify listing exists and belongs to user
    listing = await get_listing_by_id(db, checkout_data.listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Listing not found"
        )
    
    if listing.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to promote this listing"
        )
    
    # Validate scope
    if checkout_data.scope not in ["CROSS_COMPOUND", "PUBLIC"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid scope. Must be CROSS_COMPOUND or PUBLIC"
        )
    
    # Calculate amount
    base_price = PROMOTION_PRICES.get(checkout_data.scope, Decimal("50.00"))
    total_amount = base_price * Decimal(checkout_data.duration_days) / Decimal("7")
    
    # Create promotion record with pending payment
    promotion = await create_promotion(
        db=db,
        listing_id=checkout_data.listing_id,
        scope=PromotionScope(checkout_data.scope),
        duration_days=checkout_data.duration_days,
        amount=float(total_amount),
        currency="EGP",
        stripe_session_id=None,
    )
    
    # Create Stripe checkout session
    success_url = f"{settings.CORS_ORIGINS[0]}/promote/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{settings.CORS_ORIGINS[0]}/promote/{checkout_data.listing_id}"
    
    session = create_checkout_session(
        listing_id=checkout_data.listing_id,
        amount=total_amount,
        currency="EGP",
        scope=checkout_data.scope,
        duration_days=checkout_data.duration_days,
        success_url=success_url,
        cancel_url=cancel_url,
    )
    
    # Update promotion with session ID
    promotion.stripe_session_id = session["session_id"]
    await db.flush()
    
    return CheckoutSessionResponse(
        session_id=session["session_id"],
        url=session["url"],
    )

