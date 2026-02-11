from ..database import get_db

VALID_TRANSITIONS = {
    "pending":   ["confirmed", "cancelled"],
    "confirmed": ["ready", "cancelled"],
    "ready":     ["collected"],
    "collected": [],
    "cancelled": [],
}


def generate_order_number(restaurant_id: int) -> str:
    """Generate a human-readable order number like BB-001."""
    with get_db() as db:
        row = db.execute(
            "SELECT name FROM restaurants WHERE id = ?", (restaurant_id,)
        ).fetchone()
        if not row:
            prefix = "XX"
        else:
            words = [w for w in row["name"].split() if w[0].isalpha()]
            prefix = "".join(w[0].upper() for w in words[:2]) if len(words) >= 2 else row["name"][:2].upper()

        count = db.execute(
            "SELECT COUNT(*) as c FROM orders WHERE restaurant_id = ?", (restaurant_id,)
        ).fetchone()["c"]

    return f"{prefix}-{count + 1:03d}"


def create_order(data: dict) -> dict:
    """Create a new order and return it."""
    order_number = generate_order_number(data["restaurant_id"])

    with get_db() as db:
        # Validate all menu items exist and belong to this restaurant
        items_info = []
        subtotal = 0.0
        for item in data["items"]:
            row = db.execute(
                "SELECT id, name, price, is_available FROM menu_items WHERE id = ? AND restaurant_id = ?",
                (item["menu_item_id"], data["restaurant_id"]),
            ).fetchone()
            if not row:
                raise ValueError(f"Menu item {item['menu_item_id']} not found for this restaurant")
            if not row["is_available"]:
                raise ValueError(f"Menu item '{row['name']}' is currently unavailable")
            line_total = row["price"] * item["quantity"]
            subtotal += line_total
            items_info.append({
                "menu_item_id": row["id"],
                "item_name": row["name"],
                "unit_price": row["price"],
                "quantity": item["quantity"],
                "notes": item.get("notes"),
            })

        # Insert order
        cursor = db.execute(
            """INSERT INTO orders (restaurant_id, order_number, customer_name, customer_phone,
               customer_email, pickup_time, special_instructions, subtotal, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')""",
            (
                data["restaurant_id"], order_number, data["customer_name"],
                data["customer_phone"], data.get("customer_email"),
                data["pickup_time"], data.get("special_instructions"), subtotal,
            ),
        )
        order_id = cursor.lastrowid

        # Insert order items
        for info in items_info:
            db.execute(
                """INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, item_name, notes)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (order_id, info["menu_item_id"], info["quantity"],
                 info["unit_price"], info["item_name"], info["notes"]),
            )

        # Fetch restaurant info for response
        restaurant = db.execute(
            "SELECT name FROM restaurants WHERE id = ?", (data["restaurant_id"],)
        ).fetchone()

    return {
        "id": order_id,
        "order_number": order_number,
        "restaurant_id": data["restaurant_id"],
        "restaurant_name": restaurant["name"] if restaurant else "",
        "customer_name": data["customer_name"],
        "customer_phone": data["customer_phone"],
        "customer_email": data.get("customer_email"),
        "pickup_time": data["pickup_time"],
        "special_instructions": data.get("special_instructions"),
        "subtotal": subtotal,
        "status": "pending",
        "items": [
            {
                "id": 0,
                "item_name": i["item_name"],
                "quantity": i["quantity"],
                "unit_price": i["unit_price"],
                "notes": i["notes"],
            }
            for i in items_info
        ],
        "created_at": "",
    }


def advance_order_status(order_id: int, new_status: str, restaurant_id: int) -> dict:
    """Advance an order's status. Returns the updated order dict."""
    with get_db() as db:
        order = db.execute(
            "SELECT * FROM orders WHERE id = ? AND restaurant_id = ?",
            (order_id, restaurant_id),
        ).fetchone()
        if not order:
            raise ValueError("Order not found")

        current = order["status"]
        allowed = VALID_TRANSITIONS.get(current, [])
        if new_status not in allowed:
            raise ValueError(
                f"Cannot transition from '{current}' to '{new_status}'. "
                f"Allowed: {allowed}"
            )

        db.execute(
            "UPDATE orders SET status = ?, status_changed_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_status, order_id),
        )

        # Fetch updated order with items
        updated = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        items = db.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,)).fetchall()
        restaurant = db.execute(
            "SELECT name FROM restaurants WHERE id = ?", (restaurant_id,)
        ).fetchone()

    return {
        "id": updated["id"],
        "order_number": updated["order_number"],
        "restaurant_id": updated["restaurant_id"],
        "restaurant_name": restaurant["name"] if restaurant else "",
        "customer_name": updated["customer_name"],
        "customer_phone": updated["customer_phone"],
        "customer_email": updated["customer_email"],
        "pickup_time": updated["pickup_time"],
        "special_instructions": updated["special_instructions"],
        "subtotal": updated["subtotal"],
        "status": updated["status"],
        "items": [
            {
                "id": i["id"],
                "item_name": i["item_name"],
                "quantity": i["quantity"],
                "unit_price": i["unit_price"],
                "notes": i["notes"],
            }
            for i in items
        ],
        "created_at": updated["created_at"],
    }
