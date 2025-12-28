import stripe
from typing import Optional
from app.core.config import settings
from decimal import Decimal

stripe.api_key = settings.STRIPE_SECRET_KEY


def create_checkout_session(
    listing_id: int,
    amount: Decimal,
    currency: str,
    scope: str,
    duration_days: int,
    success_url: str,
    cancel_url: str
) -> dict:
    """
    Create a Stripe checkout session for listing promotion.
    Returns session object with id and url.
    """
    amount_cents = int(float(amount) * 100)  # Convert to cents
    
    session = stripe.checkout.Session.create(
        payment_method_types=['card'],
        line_items=[{
            'price_data': {
                'currency': currency.lower(),
                'product_data': {
                    'name': f'Promote Listing #{listing_id} - {scope}',
                    'description': f'Promote listing for {duration_days} days',
                },
                'unit_amount': amount_cents,
            },
            'quantity': 1,
        }],
        mode='payment',
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            'listing_id': str(listing_id),
            'scope': scope,
            'duration_days': str(duration_days),
        },
    )
    
    return {
        'session_id': session.id,
        'url': session.url,
    }


def verify_webhook_signature(payload: bytes, signature: str) -> Optional[dict]:
    """
    Verify Stripe webhook signature and return event data.
    Returns None if signature is invalid.
    """
    try:
        event = stripe.Webhook.construct_event(
            payload, signature, settings.STRIPE_WEBHOOK_SECRET
        )
        return event
    except ValueError:
        return None
    except stripe.error.SignatureVerificationError:
        return None

