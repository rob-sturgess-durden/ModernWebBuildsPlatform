from fastapi import APIRouter, HTTPException, BackgroundTasks
from ..database import get_db
from ..models import OrderCreate, OrderResponse
from ..services.order_service import create_order
from ..services.notification import notify_new_order

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
    )
