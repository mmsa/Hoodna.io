from fastapi import APIRouter, Request, HTTPException, status, Depends
from app.services.stripe import verify_webhook_signature
from app.crud.listing import activate_promotion
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
import stripe

router = APIRouter()


@router.post("/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhook events."""
    payload = await request.body()
    signature = request.headers.get("stripe-signature")
    
    if not signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing stripe-signature header"
        )
    
    event = verify_webhook_signature(payload, signature)
    
    if not event:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature"
        )
    
    # Handle checkout.session.completed event
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        session_id = session["id"]
        
        # Activate promotion
        promotion = await activate_promotion(db, session_id)
        
        if promotion:
            return {"status": "success", "promotion_id": promotion.id}
        else:
            return {"status": "warning", "message": "Promotion not found"}
    
    return {"status": "received"}

