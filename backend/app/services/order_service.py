import secrets
from ..database import get_db

VALID_TRANSITIONS = {
    "pending":   ["confirmed", "cancelled"],
    "confirmed": ["ready", "cancelled"],
    "ready":     ["collected"],
    "collected": [],
    "cancelled": [],
}

def normalize_phone(raw: str | None) -> str:
    """
    Best-effort phone normalization for Twilio.
    - strips spaces/symbols
    - supports UK local mobile format 07xxxxxxxxx -> +44xxxxxxxxxx
    - supports 00 prefix -> +
    """
    if not raw:
        return ""
    s = str(raw).strip()
    if s.startswith("whatsapp:"):
        s = s.split(":", 1)[1].strip()
    # keep leading + then digits
    s = s.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if s.startswith("00"):
        s = "+" + s[2:]
    if s.startswith("+"):
        return "+" + "".join(ch for ch in s[1:] if ch.isdigit())
    s = "".join(ch for ch in s if ch.isdigit())
    if not s:
        return ""
    # UK local mobile: 07xxxxxxxxx (11 digits)
    if s.startswith("0") and len(s) == 11:
        return "+44" + s[1:]
    if s.startswith("44") and len(s) >= 11:
        return "+" + s
    # Fallback: return as-is digits (may still be rejected by Twilio)
    return s


def generate_order_number(restaurant_id: int) -> str:
    """Generate a human-readable order number like BB-001.

    Note: order_number is UNIQUE across the whole table, not just per restaurant.
    So the sequence must be unique for a given prefix even if multiple restaurants share it.
    """
    with get_db() as db:
        row = db.execute(
            "SELECT name FROM restaurants WHERE id = ?", (restaurant_id,)
        ).fetchone()
        if not row:
            prefix = "XX"
        else:
            words = [w for w in row["name"].split() if w and w[0].isalpha()]
            # Use up to 3 initials to reduce collisions (e.g. "Bronson's Burgers Hackney" -> BBH).
            if words:
                prefix = "".join(w[0].upper() for w in words[:3])
            else:
                prefix = (row["name"][:2] or "XX").upper()

        # Find last order for this prefix and increment its numeric suffix.
        like = f"{prefix}-%"
        last = db.execute(
            "SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY id DESC LIMIT 1",
            (like,),
        ).fetchone()

    last_n = 0
    if last and last["order_number"]:
        try:
            last_n = int(str(last["order_number"]).rsplit("-", 1)[1])
        except Exception:
            last_n = 0

    return f"{prefix}-{last_n + 1:03d}"


def create_order(data: dict) -> dict:
    """Create a new order and return it."""
    from .credits import has_credits
    if not has_credits(data["restaurant_id"]):
        raise ValueError("This restaurant is not currently accepting orders")

    order_number = generate_order_number(data["restaurant_id"])
    owner_action_token = secrets.token_urlsafe(24)
    data["customer_phone"] = normalize_phone(data.get("customer_phone"))

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
               customer_email, pickup_time, special_instructions, subtotal, status, owner_action_token, sms_optin)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)""",
            (
                data["restaurant_id"], order_number, data["customer_name"],
                data["customer_phone"], data.get("customer_email"),
                data["pickup_time"], data.get("special_instructions"), subtotal,
                owner_action_token, 1 if data.get("sms_optin") else 0,
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
            "SELECT name, slug FROM restaurants WHERE id = ?", (data["restaurant_id"],)
        ).fetchone()

    return {
        "id": order_id,
        "order_number": order_number,
        "restaurant_id": data["restaurant_id"],
        "restaurant_name": restaurant["name"] if restaurant else "",
        "restaurant_slug": restaurant["slug"] if restaurant else "",
        "customer_name": data["customer_name"],
        "customer_phone": data["customer_phone"],
        "customer_email": data.get("customer_email"),
        "pickup_time": data["pickup_time"],
        "special_instructions": data.get("special_instructions"),
        "subtotal": subtotal,
        "status": "pending",
        "sms_optin": bool(data.get("sms_optin")),
        "owner_action_token": owner_action_token,
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

        # Deduct commission when order is collected (10% of subtotal)
        if new_status == "collected":
            from .credits import deduct_credits
            commission = round(order["subtotal"] * 0.10, 2)
            deduct_credits(restaurant_id, commission, "commission")

        # Fetch updated order with items
        updated = db.execute("SELECT * FROM orders WHERE id = ?", (order_id,)).fetchone()
        items = db.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,)).fetchall()
        restaurant = db.execute(
            "SELECT name, slug FROM restaurants WHERE id = ?", (restaurant_id,)
        ).fetchone()

    return {
        "id": updated["id"],
        "order_number": updated["order_number"],
        "restaurant_id": updated["restaurant_id"],
        "restaurant_name": restaurant["name"] if restaurant else "",
        "restaurant_slug": restaurant["slug"] if restaurant else "",
        "customer_name": updated["customer_name"],
        "customer_phone": updated["customer_phone"],
        "customer_email": updated["customer_email"],
        "pickup_time": updated["pickup_time"],
        "special_instructions": updated["special_instructions"],
        "subtotal": updated["subtotal"],
        "status": updated["status"],
        "sms_optin": bool(updated["sms_optin"]) if "sms_optin" in updated.keys() else False,
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
