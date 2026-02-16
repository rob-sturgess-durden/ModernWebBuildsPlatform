import re
import logging
import json
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from fastapi.responses import PlainTextResponse
from .. import config
from ..database import get_db
from ..services.order_service import advance_order_status
from ..services.notification import notify_customer_status

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks/sendgrid", tags=["webhooks"])


ORDER_RE = re.compile(r"\b[A-Z]{2}-\d{3}\b")


def _extract_action(text: str) -> str | None:
    t = (text or "").lower()
    if "confirm" in t or "accept" in t or "approved" in t:
        return "confirmed"
    if "cancel" in t or "reject" in t or "decline" in t:
        return "cancelled"
    return None


@router.post("/inbound", response_class=PlainTextResponse)
async def sendgrid_inbound(request: Request, background_tasks: BackgroundTasks):
    """
    SendGrid Inbound Parse webhook.

    Configure webhook URL:
      https://forkitt.com/api/webhooks/sendgrid/inbound?token=YOUR_TOKEN
    """
    token = request.query_params.get("token", "")
    if not config.SENDGRID_INBOUND_TOKEN:
        raise HTTPException(status_code=500, detail="SENDGRID_INBOUND_TOKEN is not set on server")
    if token != config.SENDGRID_INBOUND_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid inbound token")

    # Requires python-multipart in env.
    form = await request.form()
    subject = str(form.get("subject", "") or "")
    text = str(form.get("text", "") or "")
    html = str(form.get("html", "") or "")
    from_email = str(form.get("from", "") or "")
    to_email = str(form.get("to", "") or "")
    message_id = str(form.get("message_id", "") or "")

    haystack = "\n".join([subject, text, html])
    m = ORDER_RE.search(haystack)
    if not m:
        logger.info("Inbound email ignored (no order number). from=%s to=%s subject=%s", from_email, to_email, subject)
        with get_db() as db:
            db.execute(
                """INSERT INTO inbound_messages
                   (provider, channel, direction, from_addr, to_addr, subject, body_text, body_html, status, meta_json)
                   VALUES ('sendgrid', 'email', 'inbound', ?, ?, ?, ?, ?, 'ignored', ?)""",
                (
                    from_email,
                    to_email,
                    subject[:500],
                    text[:10000],
                    html[:20000],
                    json.dumps({"message_id": message_id}),
                ),
            )
        return "ignored: no order number"

    order_number = m.group(0)
    action = _extract_action(haystack)
    if not action:
        logger.info("Inbound email ignored (no action). order=%s subject=%s", order_number, subject)
        with get_db() as db:
            db.execute(
                """INSERT INTO inbound_messages
                   (provider, channel, direction, from_addr, to_addr, subject, body_text, body_html, order_number, status, meta_json)
                   VALUES ('sendgrid', 'email', 'inbound', ?, ?, ?, ?, ?, ?, 'ignored', ?)""",
                (
                    from_email,
                    to_email,
                    subject[:500],
                    text[:10000],
                    html[:20000],
                    order_number,
                    json.dumps({"message_id": message_id}),
                ),
            )
        return "ignored: no action"

    with get_db() as db:
        row = db.execute(
            "SELECT id, restaurant_id, status FROM orders WHERE order_number = ?",
            (order_number,),
        ).fetchone()
        if not row:
            db.execute(
                """INSERT INTO inbound_messages
                   (provider, channel, direction, from_addr, to_addr, subject, body_text, body_html, order_number, action, status, meta_json)
                   VALUES ('sendgrid', 'email', 'inbound', ?, ?, ?, ?, ?, ?, ?, 'ignored', ?)""",
                (
                    from_email,
                    to_email,
                    subject[:500],
                    text[:10000],
                    html[:20000],
                    order_number,
                    action,
                    json.dumps({"message_id": message_id}),
                ),
            )
            return f"ignored: order not found ({order_number})"

        restaurant = db.execute(
            "SELECT name FROM restaurants WHERE id = ?",
            (row["restaurant_id"],),
        ).fetchone()

    try:
        updated = advance_order_status(row["id"], action, row["restaurant_id"])
    except ValueError as exc:
        with get_db() as db:
            db.execute(
                """INSERT INTO inbound_messages
                   (provider, channel, direction, from_addr, to_addr, subject, body_text, body_html, order_number, action, status, meta_json)
                   VALUES ('sendgrid', 'email', 'inbound', ?, ?, ?, ?, ?, ?, ?, 'ignored', ?)""",
                (
                    from_email,
                    to_email,
                    subject[:500],
                    text[:10000],
                    html[:20000],
                    order_number,
                    action,
                    json.dumps({"message_id": message_id, "error": str(exc)}),
                ),
            )
        return f"ignored: {str(exc)}"

    if restaurant:
        background_tasks.add_task(notify_customer_status, updated, restaurant["name"])

    with get_db() as db:
        db.execute(
            """INSERT INTO inbound_messages
               (provider, channel, direction, from_addr, to_addr, subject, body_text, body_html, order_number, action, status, meta_json)
               VALUES ('sendgrid', 'email', 'inbound', ?, ?, ?, ?, ?, ?, ?, 'ok', ?)""",
            (
                from_email,
                to_email,
                subject[:500],
                text[:10000],
                html[:20000],
                order_number,
                action,
                json.dumps({"message_id": message_id}),
            ),
        )

    return f"ok: {order_number} -> {action}"
