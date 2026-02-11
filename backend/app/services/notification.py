import logging
import smtplib
from email.message import EmailMessage
from .. import config

logger = logging.getLogger(__name__)


def send_whatsapp(to_number: str, message: str) -> bool:
    """Send a WhatsApp message via Twilio. Returns True on success."""
    if not config.TWILIO_ACCOUNT_SID or not config.TWILIO_AUTH_TOKEN:
        logger.warning("Twilio credentials not configured, skipping WhatsApp")
        return False
    try:
        from twilio.rest import Client
        client = Client(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
        client.messages.create(
            body=message,
            from_=f"whatsapp:{config.TWILIO_WHATSAPP_FROM}",
            to=f"whatsapp:{to_number}",
        )
        logger.info(f"WhatsApp sent to {to_number}")
        return True
    except Exception as e:
        logger.error(f"Failed to send WhatsApp to {to_number}: {e}")
        return False


def send_email(to_email: str, subject: str, body: str) -> bool:
    """Send an email via SMTP. Returns True on success."""
    if not config.SMTP_USER or not config.SMTP_PASSWORD:
        logger.warning("SMTP credentials not configured, skipping email")
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
        f"Pickup: {order['pickup_time']}\n"
        f"Customer: {order['customer_name']} ({order['customer_phone']})\n"
    )
    if order.get("special_instructions"):
        message += f"Notes: {order['special_instructions']}\n"
    message += f"\nConfirm at: {config.FRONTEND_URL}/admin/dashboard"

    if restaurant.get("whatsapp_number"):
        send_whatsapp(restaurant["whatsapp_number"], message)
    if restaurant.get("owner_email"):
        send_email(
            restaurant["owner_email"],
            f"New Order {order['order_number']} - {restaurant['name']}",
            message,
        )


def notify_customer_status(order: dict, restaurant_name: str):
    """Notify customer of an order status change."""
    status = order["status"]
    messages = {
        "confirmed": (
            f"Your order {order['order_number']} at {restaurant_name} is confirmed!\n"
            f"Pickup at: {order['pickup_time']}\n"
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

    send_whatsapp(order["customer_phone"], message)
    if order.get("customer_email"):
        send_email(
            order["customer_email"],
            f"Order {order['order_number']} - {status.title()}",
            message,
        )
