import logging
import json
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from urllib.parse import parse_qs
from .. import config
from ..database import get_db
from ..services.notification import set_whatsapp_optin

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/twilio/whatsapp")
async def twilio_whatsapp_webhook(request: Request):
    """Receive inbound WhatsApp messages from Twilio."""
    raw_body = (await request.body()).decode("utf-8", errors="ignore")
    parsed = parse_qs(raw_body, keep_blank_values=True)

    def first(key: str) -> str:
        vals = parsed.get(key, [""])
        return str(vals[0]) if vals else ""

    from_number = first("From")
    to_number = first("To")
    body = first("Body").strip()
    message_sid = first("MessageSid")
    button_text = first("ButtonText").strip()
    button_payload = first("ButtonPayload").strip()

    if config.TWILIO_VALIDATE_SIGNATURE:
        signature = request.headers.get("X-Twilio-Signature", "")
        if not config.TWILIO_AUTH_TOKEN:
            raise HTTPException(status_code=500, detail="TWILIO_AUTH_TOKEN missing for signature validation")
        try:
            from twilio.request_validator import RequestValidator
            validator = RequestValidator(config.TWILIO_AUTH_TOKEN)
            url = str(request.url)
            data = {k: v[0] if isinstance(v, list) and v else "" for k, v in parsed.items()}
            if not validator.validate(url, data, signature):
                raise HTTPException(status_code=403, detail="Invalid Twilio signature")
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Twilio signature validation failed: %s", exc)
            raise HTTPException(status_code=500, detail="Webhook validation error")

    logger.info(
        "Inbound WhatsApp message sid=%s from=%s to=%s body=%s",
        message_sid,
        from_number,
        to_number,
        body,
    )

    # Handle opt-in / opt-out.  Any inbound message opts the user in,
    # except explicit opt-out keywords.
    response_text = None
    choice = (button_text or button_payload or body).strip().lower()
    if choice in {"no", "n", "stop", "unsubscribe", "opt out", "optout"}:
        set_whatsapp_optin(from_number, False, source="twilio_quick_reply")
        response_text = "No problem. You will not receive WhatsApp order updates. Send any message to opt back in."
    elif choice:
        set_whatsapp_optin(from_number, True, source="twilio_quick_reply")
        response_text = "Thanks! You'll now receive order updates via WhatsApp. Reply STOP to opt out."

    # Strip "whatsapp:" prefix to get the plain E.164 number
    phone_clean = from_number.replace("whatsapp:", "").strip()

    with get_db() as db:
        db.execute(
            """INSERT INTO inbound_messages
               (provider, channel, direction, from_addr, to_addr, body_text, status, meta_json)
               VALUES ('twilio', 'whatsapp', 'inbound', ?, ?, ?, 'ok', ?)""",
            (
                from_number,
                to_number,
                body[:5000],
                json.dumps({
                    "message_sid": message_sid,
                    "button_text": button_text,
                    "button_payload": button_payload,
                }),
            ),
        )
        # Mark the sender as verified (any inbound WhatsApp proves they own the number)
        if phone_clean:
            existing = db.execute(
                "SELECT id FROM verified_customers WHERE phone = ?", (phone_clean,)
            ).fetchone()
            if not existing:
                db.execute(
                    "INSERT INTO verified_customers (phone) VALUES (?)", (phone_clean,)
                )

    if response_text:
        # Minimal TwiML reply.
        twiml = (
            "<?xml version='1.0' encoding='UTF-8'?>"
            "<Response>"
            f"<Message>{response_text}</Message>"
            "</Response>"
        )
        return Response(content=twiml, media_type="application/xml")

    # Empty TwiML response: acknowledge receipt and do not auto-reply.
    return Response(content="<?xml version='1.0' encoding='UTF-8'?><Response></Response>", media_type="application/xml")


@router.post("/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events (checkout.session.completed)."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if not config.STRIPE_WEBHOOK_SECRET:
        logger.warning("STRIPE_WEBHOOK_SECRET not configured, rejecting webhook")
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    import stripe
    stripe.api_key = config.STRIPE_SECRET_KEY

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, config.STRIPE_WEBHOOK_SECRET)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata") or {}
        restaurant_id = metadata.get("restaurant_id")

        if restaurant_id:
            from ..services.credits import add_credits
            new_balance = add_credits(int(restaurant_id), 10.0, "stripe_topup")
            logger.info(
                "Stripe topup: restaurant=%s session=%s new_balance=%.2f",
                restaurant_id, session.get("id"), new_balance,
            )
        else:
            logger.warning("Stripe checkout.session.completed without restaurant_id metadata: %s", session.get("id"))

    return Response(status_code=200)
