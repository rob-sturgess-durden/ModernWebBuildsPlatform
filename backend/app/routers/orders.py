from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import HTMLResponse
from ..database import get_db
from ..models import OrderCreate, OrderResponse
from ..services.order_service import create_order, advance_order_status
from .. import config
from ..services.notification import (
    notify_new_order,
    notify_customer_status,
    notify_customer_received,
    is_whatsapp_opted_in,
    send_whatsapp_optin_request,
)

router = APIRouter(prefix="/orders", tags=["orders"])


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
        background_tasks.add_task(notify_customer_received, result, dict(restaurant).get("name", ""))

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
            "SELECT name FROM restaurants WHERE id = ?", (order["restaurant_id"],)
        ).fetchone()

    wa_from = config.TWILIO_WHATSAPP_FROM if config.WHATSAPP_ENABLED else None

    return OrderResponse(
        id=order["id"],
        order_number=order["order_number"],
        restaurant_id=order["restaurant_id"],
        restaurant_name=restaurant["name"] if restaurant else "",
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
