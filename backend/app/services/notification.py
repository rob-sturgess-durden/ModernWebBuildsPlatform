import logging
import smtplib
from email.message import EmailMessage
import json as _json
import time
from .. import config
from ..database import get_db

logger = logging.getLogger(__name__)


def _format_pickup_time(raw: str | None) -> str:
    """Convert ISO pickup time like '2026-02-15T18:30:00.000Z' to 'Sat 15 Feb, 6:30 PM'."""
    if not raw:
        return ""
    try:
        from datetime import datetime, timezone
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        # Convert to UK time (UTC+0 in winter, UTC+1 in summer)
        try:
            from zoneinfo import ZoneInfo
            dt = dt.astimezone(ZoneInfo("Europe/London"))
        except Exception:
            pass
        return dt.strftime("%a %d %b, %-I:%M %p")
    except Exception:
        return raw

def _normalize_whatsapp_number(raw: str) -> str:
    n = (raw or "").strip()
    if n.startswith("whatsapp:"):
        n = n.split(":", 1)[1].strip()
    # Basic normalize: keep leading + and digits.
    n = "".join(ch for ch in n if ch == "+" or ch.isdigit())
    return n


def is_whatsapp_opted_in(phone: str) -> bool:
    phone = _normalize_whatsapp_number(phone)
    if not phone:
        return False
    with get_db() as db:
        row = db.execute("SELECT opted_in FROM whatsapp_optins WHERE phone = ?", (phone,)).fetchone()
    return bool(row and row["opted_in"])


def set_whatsapp_optin(phone: str, opted_in: bool, source: str = "whatsapp"):
    phone = _normalize_whatsapp_number(phone)
    if not phone:
        return
    with get_db() as db:
        db.execute(
            """INSERT INTO whatsapp_optins (phone, opted_in, source)
               VALUES (?, ?, ?)
               ON CONFLICT(phone) DO UPDATE
               SET opted_in = excluded.opted_in, source = excluded.source, updated_at = CURRENT_TIMESTAMP""",
            (phone, 1 if opted_in else 0, source),
        )

def _store_message(
    provider: str,
    channel: str,
    direction: str,
    from_addr: str | None,
    to_addr: str | None,
    subject: str | None,
    body_text: str | None,
    body_html: str | None,
    order_number: str | None,
    action: str | None,
    status: str,
    meta: dict | None = None,
):
    try:
        with get_db() as db:
            db.execute(
                """INSERT INTO inbound_messages
                   (provider, channel, direction, from_addr, to_addr, subject, body_text, body_html,
                    order_number, action, status, meta_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    provider,
                    channel,
                    direction,
                    from_addr,
                    to_addr,
                    subject,
                    body_text,
                    body_html,
                    order_number,
                    action,
                    status,
                    _json.dumps(meta or {}),
                ),
            )
    except Exception:
        # Never break primary flows because audit storage failed.
        pass


def send_whatsapp(to_number: str, message: str) -> bool:
    """Send a WhatsApp message via Twilio. Returns True on success."""
    if not config.WHATSAPP_ENABLED:
        return False
    if not config.TWILIO_ACCOUNT_SID or not config.TWILIO_AUTH_TOKEN:
        logger.warning("Twilio credentials not configured, skipping WhatsApp")
        return False
    try:
        from twilio.rest import Client
        client = Client(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
        msg = client.messages.create(
            body=message,
            from_=f"whatsapp:{config.TWILIO_WHATSAPP_FROM}",
            to=f"whatsapp:{to_number}",
        )
        _store_message(
            provider="twilio",
            channel="whatsapp",
            direction="outbound",
            from_addr=f"whatsapp:{config.TWILIO_WHATSAPP_FROM}",
            to_addr=f"whatsapp:{to_number}",
            subject=None,
            body_text=message,
            body_html=None,
            order_number=None,
            action=None,
            status="ok",
            meta={"sid": getattr(msg, "sid", None)},
        )
        logger.info("WhatsApp queued to %s (sid=%s)", to_number, getattr(msg, "sid", None))
        return True
    except Exception as e:
        code = getattr(e, "code", None)
        _store_message(
            provider="twilio",
            channel="whatsapp",
            direction="outbound",
            from_addr=f"whatsapp:{config.TWILIO_WHATSAPP_FROM}",
            to_addr=f"whatsapp:{to_number}",
            subject=None,
            body_text=message,
            body_html=None,
            order_number=None,
            action=None,
            status="error",
            meta={"error_code": code, "error": str(e)[:500]},
        )
        logger.error("Failed to send WhatsApp to %s (code=%s): %s", to_number, code, e)
        return False


def send_sms(to_number: str, message: str) -> bool:
    """Send an SMS via Twilio. Returns True on success."""
    if not config.SMS_ENABLED:
        return False
    if not config.TWILIO_ACCOUNT_SID or not config.TWILIO_AUTH_TOKEN:
        logger.warning("Twilio credentials not configured, skipping SMS")
        return False
    if not config.TWILIO_SMS_FROM:
        logger.warning("TWILIO_SMS_FROM not configured, skipping SMS")
        return False
    try:
        from twilio.rest import Client
        client = Client(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
        msg = client.messages.create(
            body=message,
            from_=config.TWILIO_SMS_FROM,
            to=to_number,
        )
        _store_message(
            provider="twilio",
            channel="sms",
            direction="outbound",
            from_addr=config.TWILIO_SMS_FROM,
            to_addr=to_number,
            subject=None,
            body_text=message,
            body_html=None,
            order_number=None,
            action=None,
            status="ok",
            meta={"sid": getattr(msg, "sid", None)},
        )
        logger.info("SMS queued to %s (sid=%s)", to_number, getattr(msg, "sid", None))
        return True
    except Exception as e:
        code = getattr(e, "code", None)
        _store_message(
            provider="twilio",
            channel="sms",
            direction="outbound",
            from_addr=config.TWILIO_SMS_FROM,
            to_addr=to_number,
            subject=None,
            body_text=message,
            body_html=None,
            order_number=None,
            action=None,
            status="error",
            meta={"error_code": code, "error": str(e)[:500]},
        )
        logger.error("Failed to send SMS to %s (code=%s): %s", to_number, code, e)
        return False


def send_whatsapp_template(to_number: str, content_sid: str, content_variables: dict | None = None) -> bool:
    """Send a WhatsApp message using Twilio Content Templates."""
    if not config.WHATSAPP_ENABLED:
        return False
    if not config.TWILIO_ACCOUNT_SID or not config.TWILIO_AUTH_TOKEN:
        logger.warning("Twilio credentials not configured, skipping WhatsApp")
        return False
    if not content_sid:
        logger.warning("No content_sid provided, skipping template message")
        return False
    try:
        from twilio.rest import Client
        client = Client(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
        msg = client.messages.create(
            from_=f"whatsapp:{config.TWILIO_WHATSAPP_FROM}",
            to=f"whatsapp:{to_number}",
            content_sid=content_sid,
            content_variables=_json.dumps(content_variables or {}),
        )
        _store_message(
            provider="twilio",
            channel="whatsapp",
            direction="outbound",
            from_addr=f"whatsapp:{config.TWILIO_WHATSAPP_FROM}",
            to_addr=f"whatsapp:{to_number}",
            subject=None,
            body_text=None,
            body_html=None,
            order_number=None,
            action=None,
            status="ok",
            meta={"sid": getattr(msg, "sid", None), "content_sid": content_sid, "content_variables": (content_variables or {})},
        )
        logger.info("WhatsApp template sent to %s", to_number)
        return True
    except Exception as e:
        code = getattr(e, "code", None)
        _store_message(
            provider="twilio",
            channel="whatsapp",
            direction="outbound",
            from_addr=f"whatsapp:{config.TWILIO_WHATSAPP_FROM}",
            to_addr=f"whatsapp:{to_number}",
            subject=None,
            body_text=None,
            body_html=None,
            order_number=None,
            action=None,
            status="error",
            meta={"error_code": code, "error": str(e)[:500], "content_sid": content_sid},
        )
        logger.error("Failed to send WhatsApp template to %s: %s", to_number, e)
        return False


def send_whatsapp_template_with_sid(
    to_number: str,
    content_sid: str,
    content_variables: dict | None = None,
) -> tuple[bool, str | None]:
    """Send a WhatsApp template message and return (ok, message_sid)."""
    if not config.WHATSAPP_ENABLED:
        return False, None
    if not config.TWILIO_ACCOUNT_SID or not config.TWILIO_AUTH_TOKEN:
        logger.warning("Twilio credentials not configured, skipping WhatsApp")
        return False, None
    if not content_sid:
        logger.warning("No content_sid provided, skipping template message")
        return False, None
    try:
        from twilio.rest import Client
        client = Client(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
        msg = client.messages.create(
            from_=f"whatsapp:{config.TWILIO_WHATSAPP_FROM}",
            to=f"whatsapp:{to_number}",
            content_sid=content_sid,
            content_variables=_json.dumps(content_variables or {}),
        )
        _store_message(
            provider="twilio",
            channel="whatsapp",
            direction="outbound",
            from_addr=f"whatsapp:{config.TWILIO_WHATSAPP_FROM}",
            to_addr=f"whatsapp:{to_number}",
            subject=None,
            body_text=None,
            body_html=None,
            order_number=None,
            action=None,
            status="ok",
            meta={
                "sid": getattr(msg, "sid", None),
                "content_sid": content_sid,
                "content_variables": (content_variables or {}),
            },
        )
        return True, getattr(msg, "sid", None)
    except Exception as e:
        code = getattr(e, "code", None)
        _store_message(
            provider="twilio",
            channel="whatsapp",
            direction="outbound",
            from_addr=f"whatsapp:{config.TWILIO_WHATSAPP_FROM}",
            to_addr=f"whatsapp:{to_number}",
            subject=None,
            body_text=None,
            body_html=None,
            order_number=None,
            action=None,
            status="error",
            meta={"error_code": code, "error": str(e)[:500], "content_sid": content_sid},
        )
        logger.error("Failed to send WhatsApp template to %s (code=%s): %s", to_number, code, e)
        return False, None


def _twilio_fetch_message_status(message_sid: str) -> tuple[str | None, int | None]:
    try:
        from twilio.rest import Client
        client = Client(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
        m = client.messages(message_sid).fetch()
        return getattr(m, "status", None), getattr(m, "error_code", None)
    except Exception:
        return None, None


def _check_delivery_and_optin(to_number: str, message_sid: str):
    """Best-effort: if Twilio marks send as failed/undelivered, send opt-in template."""
    if not message_sid:
        return
    if not config.TWILIO_OPTIN_ENABLED:
        return
    if not config.TWILIO_OPTIN_CONTENT_SID:
        return

    def _recent_optin_sent(within_hours: int = 12) -> bool:
        try:
            to_key = f"whatsapp:{to_number}"
            needle = f"%{config.TWILIO_OPTIN_CONTENT_SID}%"
            with get_db() as db:
                row = db.execute(
                    """SELECT 1
                       FROM inbound_messages
                       WHERE provider = 'twilio'
                         AND channel = 'whatsapp'
                         AND direction = 'outbound'
                         AND to_addr = ?
                         AND meta_json LIKE ?
                         AND created_at >= datetime('now', ?)
                       LIMIT 1""",
                    (to_key, needle, f"-{within_hours} hours"),
                ).fetchone()
            return bool(row)
        except Exception:
            return False

    # Twilio may take a few seconds to transition from queued -> failed/undelivered.
    for _ in range(6):  # ~12s max
        time.sleep(2)
        status, code = _twilio_fetch_message_status(message_sid)
        if status in {"failed", "undelivered"}:
            logger.warning(
                "WhatsApp delivery failed to %s (sid=%s status=%s code=%s); sending opt-in template",
                to_number,
                message_sid,
                status,
                code,
            )
            if not _recent_optin_sent():
                send_whatsapp_optin_request(to_number)
            return
        if status in {"delivered", "sent"}:
            return


def send_whatsapp_optin_request(to_number: str) -> bool:
    """Send the approved opt-in template so we can message the user later."""
    if not config.WHATSAPP_ENABLED:
        return False
    if not config.TWILIO_OPTIN_ENABLED:
        return False
    if not config.TWILIO_OPTIN_CONTENT_SID:
        logger.warning("TWILIO_OPTIN_CONTENT_SID not set; cannot send opt-in template")
        return False
    return send_whatsapp_template(to_number, config.TWILIO_OPTIN_CONTENT_SID, {})


def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send an email via SendGrid API (preferred) or SMTP fallback."""
    if config.SENDGRID_API_KEY:
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail

            message = Mail(
                from_email=config.SENDGRID_FROM,
                to_emails=to_email,
                subject=subject,
                html_content=body.replace("\n", "<br/>"),
            )
            sg = SendGridAPIClient(config.SENDGRID_API_KEY)
            if config.SENDGRID_DATA_RESIDENCY:
                sg.set_sendgrid_data_residency(config.SENDGRID_DATA_RESIDENCY)
            response = sg.send(message)
            if 200 <= response.status_code < 300:
                logger.info("Email sent via SendGrid to %s", to_email)
                return True
            logger.error(
                "SendGrid email failed to %s: status=%s body=%s",
                to_email, response.status_code, response.body,
            )
        except Exception as e:
            logger.error(f"SendGrid email failed to {to_email}: {e}")

    if not config.SMTP_USER or not config.SMTP_PASSWORD:
        logger.warning("No SendGrid API key or SMTP credentials configured, skipping email")
        return False

    try:
        msg = EmailMessage()
        msg.set_content(body)
        msg["Subject"] = subject
        msg["From"] = config.SMTP_FROM
        msg["To"] = to_email
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT) as server:
            server.starttls()
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.send_message(msg)
        logger.info(f"Email sent to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


def notify_new_order(order: dict, restaurant: dict):
    """Notify restaurant owner of a new order."""
    items_text = "\n".join(
        f"  {i['quantity']}x {i['item_name']} - £{i['unit_price'] * i['quantity']:.2f}"
        for i in order["items"]
    )
    message = (
        f"New order {order['order_number']}!\n\n"
        f"{items_text}\n\n"
        f"Subtotal: £{order['subtotal']:.2f}\n"
        f"Pickup: {_format_pickup_time(order['pickup_time'])}\n"
        f"Customer: {order['customer_name']} ({order['customer_phone']})\n"
    )
    if order.get("special_instructions"):
        message += f"Notes: {order['special_instructions']}\n"
    token = order.get("owner_action_token", "")
    accept_url = f"{config.PUBLIC_BASE_URL}/api/orders/{order['order_number']}/owner-action?action=confirmed&token={token}"
    reject_url = f"{config.PUBLIC_BASE_URL}/api/orders/{order['order_number']}/owner-action?action=cancelled&token={token}"
    message += (
        "\nOwner actions:\n"
        f"Accept: {accept_url}\n"
        f"Reject: {reject_url}\n"
    )
    message += f"\nDashboard: {config.PUBLIC_BASE_URL}/admin/dashboard"

    if restaurant.get("whatsapp_number"):
        owner_wa = restaurant["whatsapp_number"]

        # WhatsApp often requires templates for business-initiated messages (outside the 24h window).
        # If a template SID is configured, use it. Otherwise fall back to plain text.
        if config.TWILIO_OWNER_NEW_ORDER_CONTENT_SID:
            ok, sid = send_whatsapp_template_with_sid(
                owner_wa,
                config.TWILIO_OWNER_NEW_ORDER_CONTENT_SID,
                {
                    # ContentVariables keys must match the template variable names (e.g. {{first_name}}).
                    "first_name": restaurant.get("name") or "there",
                },
            )
            if ok and sid:
                _check_delivery_and_optin(owner_wa, sid)
        else:
            ok = send_whatsapp(owner_wa, message)

        if not ok:
            # If owner isn't opted-in, send the opt-in template to establish a session for future messages.
            if config.TWILIO_OPTIN_ENABLED and not is_whatsapp_opted_in(owner_wa):
                logger.info("Sending WhatsApp opt-in template to owner %s", owner_wa)
                send_whatsapp_optin_request(owner_wa)
            logger.warning("Owner WhatsApp notification failed for %s", order.get("order_number"))
    if restaurant.get("owner_email"):
        send_email(
            restaurant["owner_email"],
            f"New Order {order['order_number']} - {restaurant['name']}",
            message,
        )


def notify_customer_received(order: dict, restaurant_name: str):
    """Send customer a confirmation immediately after order placement."""
    subject = f"Order received: {order['order_number']} · {restaurant_name}"
    body = (
        f"We've received your order {order['order_number']} at {restaurant_name}.\n\n"
        f"Pickup time: {_format_pickup_time(order.get('pickup_time'))}\n"
        f"Subtotal: £{order.get('subtotal', 0):.2f}\n\n"
        f"Track your order: {config.PUBLIC_BASE_URL}/order/{order['order_number']}\n"
        "You'll receive updates when the restaurant confirms and prepares your order.\n"
    )

    if order.get("customer_email"):
        send_email(order["customer_email"], subject, body)

    phone = order.get("customer_phone") or ""
    if not phone:
        return

    # WhatsApp is session-limited: only attempt if opted-in; otherwise send the opt-in template.
    if is_whatsapp_opted_in(phone):
        ok = send_whatsapp(phone, body)
        if not ok:
            send_whatsapp_optin_request(phone)
    else:
        send_whatsapp_optin_request(phone)

    # SMS opt-in: send confirmation if customer ticked the box.
    if order.get("sms_optin") and phone:
        send_sms(phone, body)


def notify_customer_status(order: dict, restaurant_name: str):
    """Notify customer of an order status change."""
    status = order["status"]
    messages = {
        "confirmed": (
            f"Your order {order['order_number']} at {restaurant_name} is confirmed!\n"
            f"Pickup at: {_format_pickup_time(order['pickup_time'])}\n"
            f"Pay at the restaurant. See you soon!"
        ),
        "ready": (
            f"Your order {order['order_number']} at {restaurant_name} is ready for collection!\n"
            f"Please pick it up as soon as possible."
        ),
        "cancelled": (
            f"Your order {order['order_number']} at {restaurant_name} has been cancelled.\n"
            f"Please contact the restaurant for details."
        ),
    }
    message = messages.get(status)
    if not message:
        return

    # Only message via WhatsApp after explicit opt-in; otherwise request opt-in first.
    if is_whatsapp_opted_in(order["customer_phone"]):
        send_whatsapp(order["customer_phone"], message)
    else:
        send_whatsapp_optin_request(order["customer_phone"])

    # SMS: check the sms_optin flag stored on the order.
    if order.get("sms_optin") and order.get("customer_phone"):
        send_sms(order["customer_phone"], message)

    if order.get("customer_email"):
        send_email(
            order["customer_email"],
            f"Order {order['order_number']} - {status.title()}",
            message,
        )
