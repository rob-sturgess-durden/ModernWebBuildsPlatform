import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Body, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse
from ..database import get_db
from ..models import OrderCreate, OrderResponse, ReviewCreate, ReviewResponse
from ..services.order_service import create_order, advance_order_status
from .. import config
from ..services.notification import (
    notify_new_order,
    notify_customer_status,
    notify_customer_received,
    is_whatsapp_opted_in,
    send_whatsapp_optin_request,
    send_email,
    send_sms,
)

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("/check-verified")
def check_verified(phone: str = "", email: str = ""):
    """Check if a customer is already verified by phone or email."""
    phone = (phone or "").strip()
    email = (email or "").strip().lower()
    if not phone and not email:
        return {"verified": False}

    with get_db() as db:
        if phone:
            row = db.execute("SELECT id FROM verified_customers WHERE phone = ?", (phone,)).fetchone()
            if row:
                return {"verified": True}
        if email:
            row = db.execute("SELECT id FROM verified_customers WHERE email = ?", (email,)).fetchone()
            if row:
                return {"verified": True}
    return {"verified": False}


@router.post("/send-code")
def send_verification_code(body: dict = Body(...)):
    """Send a 4-digit verification code via email or SMS."""
    phone = (body.get("phone") or "").strip()
    email = (body.get("email") or "").strip().lower()
    if not phone and not email:
        raise HTTPException(status_code=422, detail="Phone or email required")

    code = str(random.randint(1000, 9999))
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)

    with get_db() as db:
        db.execute(
            "INSERT INTO verification_codes (phone, email, code, expires_at) VALUES (?, ?, ?, ?)",
            (phone or None, email or None, code, expires.isoformat()),
        )

    channel = None
    if email:
        send_email(
            email,
            "Your ForkIt verification code",
            f"Your verification code is: {code}\n\nThis code expires in 10 minutes.",
        )
        channel = "email"
    elif phone:
        send_sms(phone, f"Your ForkIt verification code is: {code}")
        channel = "sms"

    return {"ok": True, "channel": channel}


@router.post("/verify-code")
def verify_code(body: dict = Body(...)):
    """Verify a 4-digit code and mark the customer as verified."""
    phone = (body.get("phone") or "").strip()
    email = (body.get("email") or "").strip().lower()
    code = (body.get("code") or "").strip()
    if not code:
        raise HTTPException(status_code=422, detail="Code is required")

    now = datetime.now(timezone.utc).isoformat()

    with get_db() as db:
        # Match on phone or email, whichever was used to send
        conditions = []
        params = []
        if email:
            conditions.append("email = ?")
            params.append(email)
        if phone:
            conditions.append("phone = ?")
            params.append(phone)
        if not conditions:
            return {"verified": False}

        where = " OR ".join(conditions)
        row = db.execute(
            f"""SELECT id FROM verification_codes
                WHERE ({where}) AND code = ? AND used = 0 AND expires_at > ?
                ORDER BY id DESC LIMIT 1""",
            (*params, code, now),
        ).fetchone()

        if not row:
            return {"verified": False}

        db.execute("UPDATE verification_codes SET used = 1 WHERE id = ?", (row["id"],))

        # Mark customer as verified
        if phone:
            existing = db.execute("SELECT id FROM verified_customers WHERE phone = ?", (phone,)).fetchone()
            if not existing:
                db.execute("INSERT INTO verified_customers (phone, email) VALUES (?, ?)", (phone, email or None))
        if email:
            existing = db.execute("SELECT id FROM verified_customers WHERE email = ?", (email,)).fetchone()
            if not existing:
                db.execute("INSERT INTO verified_customers (phone, email) VALUES (?, ?)", (phone or None, email))

    return {"verified": True}


@router.post("", response_model=OrderResponse, status_code=201)
def place_order(order: OrderCreate, background_tasks: BackgroundTasks):
    if not order.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")
    try:
        result = create_order(order.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Send notifications in background
    with get_db() as db:
        restaurant = db.execute(
            "SELECT * FROM restaurants WHERE id = ?", (order.restaurant_id,)
        ).fetchone()
    if restaurant:
        background_tasks.add_task(notify_new_order, result, dict(restaurant))
        background_tasks.add_task(notify_customer_received, result, dict(restaurant).get("name", ""), order.restaurant_id)

    # Opt-in request (business-initiated template). If user is already opted-in, do nothing.
    if not is_whatsapp_opted_in(result["customer_phone"]):
        background_tasks.add_task(send_whatsapp_optin_request, result["customer_phone"])

    return result


@router.get("/{order_number}", response_model=OrderResponse)
def get_order_status(order_number: str):
    with get_db() as db:
        order = db.execute(
            "SELECT * FROM orders WHERE order_number = ?", (order_number,)
        ).fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        items = db.execute(
            "SELECT * FROM order_items WHERE order_id = ?", (order["id"],)
        ).fetchall()

        restaurant = db.execute(
            "SELECT name, slug FROM restaurants WHERE id = ?", (order["restaurant_id"],)
        ).fetchone()

    wa_from = config.TWILIO_WHATSAPP_FROM if config.WHATSAPP_ENABLED else None

    return OrderResponse(
        id=order["id"],
        order_number=order["order_number"],
        restaurant_id=order["restaurant_id"],
        restaurant_name=restaurant["name"] if restaurant else "",
        restaurant_slug=restaurant["slug"] if restaurant else "",
        customer_name=order["customer_name"],
        customer_phone=order["customer_phone"],
        customer_email=order["customer_email"],
        pickup_time=order["pickup_time"],
        special_instructions=order["special_instructions"],
        subtotal=order["subtotal"],
        status=order["status"],
        items=[
            {
                "id": i["id"],
                "menu_item_id": i["menu_item_id"],
                "item_name": i["item_name"],
                "quantity": i["quantity"],
                "unit_price": i["unit_price"],
                "notes": i["notes"],
            }
            for i in items
        ],
        created_at=order["created_at"] or "",
        sms_optin=bool(order["sms_optin"]) if "sms_optin" in order.keys() else False,
        notification_whatsapp=wa_from,
        notification_sms=config.SMS_ENABLED,
    )


@router.get("/{order_number}/owner-action", response_class=HTMLResponse)
def owner_action(
    order_number: str,
    action: str,
    token: str,
    background_tasks: BackgroundTasks,
):
    if action not in {"confirmed", "cancelled"}:
        raise HTTPException(status_code=400, detail="Action must be 'confirmed' or 'cancelled'")

    with get_db() as db:
        row = db.execute(
            "SELECT id, restaurant_id, owner_action_token, status FROM orders WHERE order_number = ?",
            (order_number,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Order not found")

        if not row["owner_action_token"] or row["owner_action_token"] != token:
            raise HTTPException(status_code=403, detail="Invalid action token")

        restaurant = db.execute(
            "SELECT name FROM restaurants WHERE id = ?",
            (row["restaurant_id"],),
        ).fetchone()

    if row["status"] != "pending":
        return HTMLResponse(
            f"<h2>Order {order_number} already {row['status']}</h2>"
            "<p>No change was applied.</p>",
            status_code=200,
        )

    try:
        updated = advance_order_status(row["id"], action, row["restaurant_id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if restaurant:
        background_tasks.add_task(notify_customer_status, updated, restaurant["name"])

    return HTMLResponse(
        f"<h2>Order {order_number} {action}</h2>"
        "<p>Customer notification has been sent.</p>",
        status_code=200,
    )


@router.post("/{order_number}/collect")
def customer_collect(order_number: str):
    """Customer confirms they have collected their order."""
    with get_db() as db:
        order = db.execute(
            "SELECT id, restaurant_id, status FROM orders WHERE order_number = ?",
            (order_number,),
        ).fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order["status"] == "collected":
            return {"ok": True, "status": "collected"}
        if order["status"] != "ready":
            raise HTTPException(status_code=400, detail="Order is not ready for collection")

    try:
        updated = advance_order_status(order["id"], "collected", order["restaurant_id"])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"ok": True, "status": updated["status"]}


@router.post("/{order_number}/review")
def submit_review(order_number: str, body: ReviewCreate):
    """Submit a review for a collected order."""
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

    with get_db() as db:
        order = db.execute(
            "SELECT id, restaurant_id, customer_name FROM orders WHERE order_number = ?",
            (order_number,),
        ).fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        existing = db.execute("SELECT id FROM reviews WHERE order_id = ?", (order["id"],)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="Review already submitted for this order")

        db.execute(
            "INSERT INTO reviews (order_id, restaurant_id, customer_name, rating, comment) VALUES (?, ?, ?, ?, ?)",
            (order["id"], order["restaurant_id"], order["customer_name"], body.rating, body.comment),
        )
    return {"ok": True}


@router.get("/{order_number}/review")
def get_review(order_number: str):
    """Get the review for an order, if one exists."""
    with get_db() as db:
        order = db.execute(
            "SELECT id FROM orders WHERE order_number = ?", (order_number,)
        ).fetchone()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        review = db.execute(
            "SELECT id, rating, comment, created_at FROM reviews WHERE order_id = ?",
            (order["id"],),
        ).fetchone()

    if not review:
        return {"review": None}
    return {"review": ReviewResponse(
        id=review["id"],
        rating=review["rating"],
        comment=review["comment"] or "",
        created_at=review["created_at"] or "",
    )}
