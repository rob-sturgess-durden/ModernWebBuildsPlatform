import json
import re
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Header, BackgroundTasks, Body
from ..database import get_db
from .. import config
from ..models import (
    AdminLogin, OrderResponse, OrderStatusUpdate,
    MenuItemCreate, MenuItemUpdate, MenuItem, CategoryCreate, ScrapeRequest,
    RestaurantUpdate, CustomerSummary,
)
from ..services.order_service import advance_order_status
from ..services.notification import notify_customer_status, send_email

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


@router.post("/magic-link")
def request_magic_link(body: dict = Body(...)):
    """Send a magic login link to the restaurant owner's email."""
    email = (body.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=422, detail="Email is required")

    with get_db() as db:
        row = db.execute(
            "SELECT id, name FROM restaurants WHERE LOWER(owner_email) = ?", (email,)
        ).fetchone()

        if row:
            token = secrets.token_urlsafe(32)
            expires = datetime.now(timezone.utc) + timedelta(minutes=30)
            db.execute(
                "INSERT INTO magic_links (restaurant_id, token, expires_at) VALUES (?, ?, ?)",
                (row["id"], token, expires.isoformat()),
            )

            link = f"{config.PUBLIC_BASE_URL}/admin?magic={token}"
            send_email(
                email,
                f"Your login link for {row['name']}",
                f"Hi!\n\nClick the link below to log into your {row['name']} dashboard:\n\n"
                f"{link}\n\n"
                f"This link expires in 30 minutes and can only be used once.\n\n"
                f"If you didn't request this, you can safely ignore this email.",
            )

    # Always return ok — don't reveal whether the email exists
    return {"ok": True}


@router.post("/magic-link/verify")
def verify_magic_link(body: dict = Body(...)):
    """Verify a magic link token and return admin credentials."""
    token = (body.get("token") or "").strip()
    if not token:
        raise HTTPException(status_code=422, detail="Token is required")

    now = datetime.now(timezone.utc).isoformat()

    with get_db() as db:
        row = db.execute(
            """SELECT ml.id, ml.restaurant_id, r.id as rid, r.name, r.slug, r.admin_token
               FROM magic_links ml
               JOIN restaurants r ON r.id = ml.restaurant_id
               WHERE ml.token = ? AND ml.used = 0 AND ml.expires_at > ?""",
            (token, now),
        ).fetchone()

        if not row:
            raise HTTPException(status_code=401, detail="Invalid or expired link")

        db.execute("UPDATE magic_links SET used = 1 WHERE id = ?", (row["id"],))

    return {
        "restaurant_id": row["rid"],
        "name": row["name"],
        "slug": row["slug"],
        "admin_token": row["admin_token"],
    }


# --- Dashboard stats ---

@router.get("/stats")
def get_admin_stats(authorization: str = Header(...)):
    restaurant = _get_restaurant_from_token(authorization)
    rid = restaurant["id"]
    with get_db() as db:
        # All-time totals
        totals = db.execute(
            "SELECT COUNT(*) as total_orders, COALESCE(SUM(subtotal), 0) as total_revenue "
            "FROM orders WHERE restaurant_id = ?",
            (rid,),
        ).fetchone()

        # This week (Monday to now)
        week = db.execute(
            "SELECT COUNT(*) as orders, COALESCE(SUM(subtotal), 0) as revenue "
            "FROM orders WHERE restaurant_id = ? AND created_at >= date('now', 'weekday 1', '-7 days')",
            (rid,),
        ).fetchone()

        # Today
        today = db.execute(
            "SELECT COUNT(*) as orders, COALESCE(SUM(subtotal), 0) as revenue "
            "FROM orders WHERE restaurant_id = ? AND date(created_at) = date('now')",
            (rid,),
        ).fetchone()

        # Pending orders count
        pending = db.execute(
            "SELECT COUNT(*) as c FROM orders WHERE restaurant_id = ? AND status = 'pending'",
            (rid,),
        ).fetchone()["c"]

        # Customer count
        customer_count = db.execute(
            "SELECT COUNT(DISTINCT LOWER(TRIM(customer_name)) || '|' || LOWER(TRIM(COALESCE(customer_email, '')))) as c "
            "FROM orders WHERE restaurant_id = ?",
            (rid,),
        ).fetchone()["c"]

    total_revenue = totals["total_revenue"]
    week_revenue = week["revenue"]
    commission_rate = 0.10

    return {
        "total_orders": totals["total_orders"],
        "total_revenue": round(total_revenue, 2),
        "total_commission": round(total_revenue * commission_rate, 2),
        "week_orders": week["orders"],
        "week_revenue": round(week_revenue, 2),
        "week_commission": round(week_revenue * commission_rate, 2),
        "today_orders": today["orders"],
        "today_revenue": round(today["revenue"], 2),
        "pending_orders": pending,
        "customer_count": customer_count,
    }


# --- Restaurant settings (own profile) ---

@router.get("/restaurant")
def get_admin_restaurant(authorization: str = Header(...)):
    """Return the current restaurant's details for editing (no admin_token)."""
    restaurant = _get_restaurant_from_token(authorization)
    with get_db() as db:
        row = db.execute(
            "SELECT id, name, slug, address, cuisine_type, about_text, banner_text, latitude, longitude, "
            "logo_url, banner_url, instagram_handle, facebook_handle, phone, whatsapp_number, "
            "mobile_number, notification_channel, owner_email, theme, deliveroo_url, justeat_url, is_active, opening_hours, "
            "status, preview_password "
            "FROM restaurants WHERE id = ?",
            (restaurant["id"],),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    out = dict(row)
    if out.get("opening_hours"):
        try:
            out["opening_hours"] = json.loads(out["opening_hours"])
            # Handle double-encoded JSON (e.g. "\"{...}\"")
            if isinstance(out["opening_hours"], str):
                try:
                    hours2 = json.loads(out["opening_hours"])
                    if isinstance(hours2, dict):
                        out["opening_hours"] = hours2
                except (TypeError, json.JSONDecodeError):
                    out["opening_hours"] = None
        except (TypeError, json.JSONDecodeError):
            out["opening_hours"] = None
    return out


@router.patch("/restaurant")
def update_admin_restaurant(body: RestaurantUpdate, authorization: str = Header(...)):
    """Update the current restaurant's details (allowed fields only)."""
    restaurant = _get_restaurant_from_token(authorization)
    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.address is not None:
        updates["address"] = body.address
    if body.cuisine_type is not None:
        updates["cuisine_type"] = body.cuisine_type
    if body.about_text is not None:
        updates["about_text"] = body.about_text
    if body.latitude is not None:
        updates["latitude"] = body.latitude
    if body.longitude is not None:
        updates["longitude"] = body.longitude
    if body.logo_url is not None:
        updates["logo_url"] = body.logo_url
    if body.banner_url is not None:
        updates["banner_url"] = body.banner_url
    if body.instagram_handle is not None:
        updates["instagram_handle"] = body.instagram_handle
    if body.facebook_handle is not None:
        updates["facebook_handle"] = body.facebook_handle
    if body.phone is not None:
        updates["phone"] = body.phone
    whatsapp_number = getattr(body, "whatsapp_number", None)
    if whatsapp_number is not None:
        updates["whatsapp_number"] = whatsapp_number
        updates["mobile_number"] = whatsapp_number
    if body.mobile_number is not None:
        updates["mobile_number"] = body.mobile_number
        updates.setdefault("whatsapp_number", body.mobile_number)
    if body.notification_channel is not None:
        updates["notification_channel"] = (body.notification_channel or "").strip().lower()
    if body.owner_email is not None:
        updates["owner_email"] = body.owner_email
    if body.theme is not None:
        updates["theme"] = (body.theme or "").strip().lower() or "modern"
    if body.deliveroo_url is not None:
        updates["deliveroo_url"] = body.deliveroo_url
    if body.justeat_url is not None:
        updates["justeat_url"] = body.justeat_url
    if body.is_active is not None:
        updates["is_active"] = int(body.is_active)
    if body.opening_hours is not None:
        updates["opening_hours"] = json.dumps(body.opening_hours)
    if body.google_place_id is not None:
        updates["google_place_id"] = body.google_place_id
    if body.banner_text is not None:
        updates["banner_text"] = body.banner_text
    if body.preview_password is not None:
        updates["preview_password"] = body.preview_password or None
    if not updates:
        return get_admin_restaurant(authorization)
    set_parts = [f"{k} = ?" for k in updates]
    values = list(updates.values()) + [restaurant["id"]]
    with get_db() as db:
        db.execute(
            f"UPDATE restaurants SET {', '.join(set_parts)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            values,
        )
    return get_admin_restaurant(authorization)


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


@router.get("/customers", response_model=list[CustomerSummary])
def list_customers(authorization: str = Header(...)):
    restaurant = _get_restaurant_from_token(authorization)
    with get_db() as db:
        rows = db.execute(
            "SELECT customer_name, customer_email, COUNT(*) as order_count, MAX(created_at) as last_order_at "
            "FROM orders WHERE restaurant_id = ? "
            "GROUP BY LOWER(TRIM(customer_name)), LOWER(TRIM(customer_email)) "
            "ORDER BY last_order_at DESC",
            (restaurant["id"],),
        ).fetchall()
    return [dict(r) for r in rows]


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


# --- Gallery ---

@router.get("/gallery")
def list_gallery(authorization: str = Header(...)):
    restaurant = _get_restaurant_from_token(authorization)
    with get_db() as db:
        rows = db.execute(
            "SELECT id, image_url, caption, display_order FROM gallery_images "
            "WHERE restaurant_id = ? ORDER BY display_order, id",
            (restaurant["id"],),
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("/gallery", status_code=201)
def add_gallery_image(body: dict, authorization: str = Header(...)):
    restaurant = _get_restaurant_from_token(authorization)
    image_url = (body.get("image_url") or "").strip()
    if not image_url:
        raise HTTPException(status_code=400, detail="image_url is required")
    caption = (body.get("caption") or "").strip() or None
    with get_db() as db:
        max_order = db.execute(
            "SELECT COALESCE(MAX(display_order), -1) as m FROM gallery_images WHERE restaurant_id = ?",
            (restaurant["id"],),
        ).fetchone()["m"]
        cursor = db.execute(
            "INSERT INTO gallery_images (restaurant_id, image_url, caption, display_order) VALUES (?, ?, ?, ?)",
            (restaurant["id"], image_url, caption, max_order + 1),
        )
    return {"id": cursor.lastrowid, "image_url": image_url, "caption": caption, "display_order": max_order + 1}


@router.delete("/gallery/{image_id}", status_code=204)
def delete_gallery_image(image_id: int, authorization: str = Header(...)):
    restaurant = _get_restaurant_from_token(authorization)
    with get_db() as db:
        deleted = db.execute(
            "DELETE FROM gallery_images WHERE id = ? AND restaurant_id = ?",
            (image_id, restaurant["id"]),
        ).rowcount
    if not deleted:
        raise HTTPException(status_code=404, detail="Gallery image not found")
