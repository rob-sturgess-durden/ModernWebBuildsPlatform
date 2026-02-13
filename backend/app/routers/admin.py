import json
import re
from fastapi import APIRouter, HTTPException, Header, BackgroundTasks
from ..database import get_db
from ..models import (
    AdminLogin, OrderResponse, OrderStatusUpdate,
    MenuItemCreate, MenuItemUpdate, MenuItem, CategoryCreate, ScrapeRequest,
)
from ..services.order_service import advance_order_status
from ..services.notification import notify_customer_status

router = APIRouter(prefix="/admin", tags=["admin"])


def _get_restaurant_from_token(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM restaurants WHERE admin_token = ?", (token,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    return dict(row)


def _norm_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (name or "").lower())


@router.post("/login")
def admin_login(body: AdminLogin):
    with get_db() as db:
        row = db.execute(
            "SELECT id, name, slug FROM restaurants WHERE admin_token = ?", (body.token,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"restaurant_id": row["id"], "name": row["name"], "slug": row["slug"]}


# --- Orders ---

@router.get("/orders", response_model=list[OrderResponse])
def list_orders(status: str | None = None, authorization: str = Header(...)):
    restaurant = _get_restaurant_from_token(authorization)
    with get_db() as db:
        if status:
            orders = db.execute(
                "SELECT * FROM orders WHERE restaurant_id = ? AND status = ? ORDER BY created_at DESC",
                (restaurant["id"], status),
            ).fetchall()
        else:
            orders = db.execute(
                "SELECT * FROM orders WHERE restaurant_id = ? ORDER BY created_at DESC",
                (restaurant["id"],),
            ).fetchall()

        result = []
        for o in orders:
            items = db.execute(
                "SELECT * FROM order_items WHERE order_id = ?", (o["id"],)
            ).fetchall()
            result.append(OrderResponse(
                id=o["id"],
                order_number=o["order_number"],
                restaurant_id=o["restaurant_id"],
                restaurant_name=restaurant["name"],
                customer_name=o["customer_name"],
                customer_phone=o["customer_phone"],
                customer_email=o["customer_email"],
                pickup_time=o["pickup_time"],
                special_instructions=o["special_instructions"],
                subtotal=o["subtotal"],
                status=o["status"],
                items=[
                    {"id": i["id"], "item_name": i["item_name"], "quantity": i["quantity"],
                     "unit_price": i["unit_price"], "notes": i["notes"]}
                    for i in items
                ],
                created_at=o["created_at"] or "",
            ))
    return result


@router.patch("/orders/{order_id}/status", response_model=OrderResponse)
def update_order_status(
    order_id: int,
    body: OrderStatusUpdate,
    background_tasks: BackgroundTasks,
    authorization: str = Header(...),
):
    restaurant = _get_restaurant_from_token(authorization)
    try:
        result = advance_order_status(order_id, body.status, restaurant["id"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    background_tasks.add_task(notify_customer_status, result, restaurant["name"])
    return result


# --- Menu ---

@router.get("/menu", response_model=list[MenuItem])
def list_menu_items(authorization: str = Header(...)):
    restaurant = _get_restaurant_from_token(authorization)
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY name",
            (restaurant["id"],),
        ).fetchall()
    return [MenuItem.from_row(r) for r in rows]


@router.post("/menu", response_model=MenuItem, status_code=201)
def add_menu_item(item: MenuItemCreate, authorization: str = Header(...)):
    restaurant = _get_restaurant_from_token(authorization)
    tags_json = json.dumps(item.dietary_tags) if item.dietary_tags else None
    with get_db() as db:
        cursor = db.execute(
            """INSERT INTO menu_items (restaurant_id, category_id, name, description, price, image_url, dietary_tags)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (restaurant["id"], item.category_id, item.name, item.description,
             item.price, item.image_url, tags_json),
        )
        row = db.execute("SELECT * FROM menu_items WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return MenuItem.from_row(row)


@router.put("/menu/{item_id}", response_model=MenuItem)
def update_menu_item(item_id: int, item: MenuItemUpdate, authorization: str = Header(...)):
    restaurant = _get_restaurant_from_token(authorization)
    with get_db() as db:
        existing = db.execute(
            "SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?",
            (item_id, restaurant["id"]),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Menu item not found")

        updates = {}
        if item.name is not None:
            updates["name"] = item.name
        if item.description is not None:
            updates["description"] = item.description
        if item.price is not None:
            updates["price"] = item.price
        if item.image_url is not None:
            updates["image_url"] = item.image_url
        if item.is_available is not None:
            updates["is_available"] = int(item.is_available)
        if item.dietary_tags is not None:
            updates["dietary_tags"] = json.dumps(item.dietary_tags)
        if item.category_id is not None:
            updates["category_id"] = item.category_id

        if updates:
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            values = list(updates.values()) + [item_id]
            db.execute(f"UPDATE menu_items SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?", values)

        row = db.execute("SELECT * FROM menu_items WHERE id = ?", (item_id,)).fetchone()
    return MenuItem.from_row(row)


@router.delete("/menu/{item_id}", status_code=204)
def delete_menu_item(item_id: int, authorization: str = Header(...)):
    restaurant = _get_restaurant_from_token(authorization)
    with get_db() as db:
        deleted = db.execute(
            "DELETE FROM menu_items WHERE id = ? AND restaurant_id = ?",
            (item_id, restaurant["id"]),
        ).rowcount
    if not deleted:
        raise HTTPException(status_code=404, detail="Menu item not found")


# --- Categories ---

@router.post("/categories", status_code=201)
def add_category(cat: CategoryCreate, authorization: str = Header(...)):
    restaurant = _get_restaurant_from_token(authorization)
    with get_db() as db:
        cursor = db.execute(
            "INSERT INTO menu_categories (restaurant_id, name, display_order) VALUES (?, ?, ?)",
            (restaurant["id"], cat.name, cat.display_order),
        )
    return {"id": cursor.lastrowid, "name": cat.name, "display_order": cat.display_order}


@router.get("/categories")
def list_categories(authorization: str = Header(...)):
    restaurant = _get_restaurant_from_token(authorization)
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM menu_categories WHERE restaurant_id = ? ORDER BY display_order",
            (restaurant["id"],),
        ).fetchall()
    return [dict(r) for r in rows]


# --- Scraper ---

@router.post("/menu/scrape")
def scrape_menu(
    body: ScrapeRequest,
    import_to_menu: bool = False,
    images_only: bool = False,
    authorization: str = Header(...),
):
    restaurant = _get_restaurant_from_token(authorization)

    url = body.url
    if not url:
        if body.source == "deliveroo":
            url = restaurant.get("deliveroo_url")
        elif body.source == "justeat":
            url = restaurant.get("justeat_url")

    if not url:
        raise HTTPException(status_code=400, detail=f"No {body.source} URL configured for this restaurant")

    try:
        if body.source == "deliveroo":
            from ..services.scraper_deliveroo import DeliverooScraper
            scraper = DeliverooScraper()
        elif body.source == "justeat":
            from ..services.scraper_justeat import JustEatScraper
            scraper = JustEatScraper()
        else:
            raise HTTPException(status_code=400, detail="Source must be 'deliveroo' or 'justeat'")

        items = scraper.scrape_menu(url)
    except ImportError:
        raise HTTPException(status_code=501, detail="Scraper not yet implemented")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")

    if not import_to_menu:
        return {"items": items, "count": len(items), "source": body.source, "mode": "preview"}

    imported = 0
    updated = 0
    skipped = 0

    with get_db() as db:
        # Build category cache and menu lookup once.
        categories = db.execute(
            "SELECT id, name FROM menu_categories WHERE restaurant_id = ?",
            (restaurant["id"],),
        ).fetchall()
        category_map = {_norm_name(c["name"]): c["id"] for c in categories}
        max_display = db.execute(
            "SELECT COALESCE(MAX(display_order), -1) as m FROM menu_categories WHERE restaurant_id = ?",
            (restaurant["id"],),
        ).fetchone()["m"]

        menu_rows = db.execute(
            "SELECT id, name FROM menu_items WHERE restaurant_id = ?",
            (restaurant["id"],),
        ).fetchall()
        menu_by_norm = {_norm_name(m["name"]): m["id"] for m in menu_rows}

        def ensure_category_id(raw_name: str) -> int | None:
            nonlocal max_display
            if not raw_name:
                return None
            key = _norm_name(raw_name)
            if not key:
                return None
            if key in category_map:
                return category_map[key]
            max_display += 1
            cur = db.execute(
                "INSERT INTO menu_categories (restaurant_id, name, display_order) VALUES (?, ?, ?)",
                (restaurant["id"], raw_name.strip(), max_display),
            )
            category_map[key] = cur.lastrowid
            return cur.lastrowid

        for item in items:
            name = (item.get("name") or "").strip()
            if not name:
                skipped += 1
                continue
            key = _norm_name(name)
            if not key:
                skipped += 1
                continue
            image_url = (item.get("image_url") or None)
            category_id = ensure_category_id(item.get("category", "Other"))
            existing_id = menu_by_norm.get(key)

            if images_only:
                if existing_id and image_url:
                    db.execute(
                        "UPDATE menu_items SET image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        (image_url, existing_id),
                    )
                    updated += 1
                else:
                    skipped += 1
                continue

            if existing_id:
                db.execute(
                    """UPDATE menu_items
                       SET description = ?, price = ?, category_id = ?, image_url = ?, source = ?, updated_at = CURRENT_TIMESTAMP
                       WHERE id = ?""",
                    (
                        item.get("description") or None,
                        float(item.get("price") or 0),
                        category_id,
                        image_url,
                        body.source,
                        existing_id,
                    ),
                )
                updated += 1
            else:
                cur = db.execute(
                    """INSERT INTO menu_items
                       (restaurant_id, category_id, name, description, price, image_url, source)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        restaurant["id"],
                        category_id,
                        name,
                        item.get("description") or None,
                        float(item.get("price") or 0),
                        image_url,
                        body.source,
                    ),
                )
                menu_by_norm[key] = cur.lastrowid
                imported += 1

    return {
        "items": items,
        "count": len(items),
        "source": body.source,
        "mode": "import",
        "images_only": images_only,
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
    }
