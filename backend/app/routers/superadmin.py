import json
import re
import secrets
from fastapi import APIRouter, HTTPException, Header
from ..database import get_db
from .. import config
from ..models import RestaurantCreate, RestaurantUpdate, RestaurantAdmin

router = APIRouter(prefix="/superadmin", tags=["superadmin"])


def _require_superadmin(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    if token != config.SUPER_ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid super admin token")


def _make_slug(name: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", name).strip().replace(" ", "-").lower()
    return re.sub(r"-+", "-", slug)


def _row_to_admin(row, db) -> dict:
    hours = None
    if row["opening_hours"]:
        try:
            hours = json.loads(row["opening_hours"])
        except (json.JSONDecodeError, TypeError):
            pass

    order_count = db.execute(
        "SELECT COUNT(*) as c FROM orders WHERE restaurant_id = ?", (row["id"],)
    ).fetchone()["c"]
    menu_count = db.execute(
        "SELECT COUNT(*) as c FROM menu_items WHERE restaurant_id = ?", (row["id"],)
    ).fetchone()["c"]

    return RestaurantAdmin(
        id=row["id"],
        name=row["name"],
        slug=row["slug"],
        address=row["address"],
        cuisine_type=row["cuisine_type"],
        latitude=row["latitude"],
        longitude=row["longitude"],
        instagram_handle=row["instagram_handle"],
        facebook_handle=row["facebook_handle"],
        phone=row["phone"],
        whatsapp_number=row["whatsapp_number"],
        owner_email=row["owner_email"],
        admin_token=row["admin_token"],
        theme=row["theme"],
        deliveroo_url=row["deliveroo_url"],
        justeat_url=row["justeat_url"],
        is_active=bool(row["is_active"]),
        opening_hours=hours,
        created_at=row["created_at"],
        order_count=order_count,
        menu_item_count=menu_count,
    )


@router.post("/login")
def superadmin_login(body: dict, authorization: str = Header(None)):
    """Validate super admin token."""
    token = body.get("token") or (authorization.replace("Bearer ", "") if authorization else "")
    if token != config.SUPER_ADMIN_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid super admin token")
    return {"ok": True, "role": "superadmin"}


@router.get("/restaurants", response_model=list[RestaurantAdmin])
def list_all_restaurants(authorization: str = Header(...)):
    _require_superadmin(authorization)
    with get_db() as db:
        rows = db.execute("SELECT * FROM restaurants ORDER BY name").fetchall()
        return [_row_to_admin(r, db) for r in rows]


@router.get("/restaurants/{restaurant_id}", response_model=RestaurantAdmin)
def get_restaurant(restaurant_id: int, authorization: str = Header(...)):
    _require_superadmin(authorization)
    with get_db() as db:
        row = db.execute("SELECT * FROM restaurants WHERE id = ?", (restaurant_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Restaurant not found")
        return _row_to_admin(row, db)


@router.post("/restaurants", response_model=RestaurantAdmin, status_code=201)
def create_restaurant(body: RestaurantCreate, authorization: str = Header(...)):
    _require_superadmin(authorization)

    slug = _make_slug(body.name)
    admin_token = secrets.token_urlsafe(32)
    hours_json = json.dumps(body.opening_hours) if body.opening_hours else None

    with get_db() as db:
        # Check slug uniqueness
        existing = db.execute("SELECT id FROM restaurants WHERE slug = ?", (slug,)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail=f"Restaurant with slug '{slug}' already exists")

        cursor = db.execute(
            """INSERT INTO restaurants
               (name, slug, address, cuisine_type, latitude, longitude,
                instagram_handle, facebook_handle, phone, whatsapp_number,
                owner_email, admin_token, theme, deliveroo_url, justeat_url,
                is_active, opening_hours)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                body.name, slug, body.address, body.cuisine_type,
                body.latitude, body.longitude, body.instagram_handle,
                body.facebook_handle, body.phone, body.whatsapp_number,
                body.owner_email, admin_token, body.theme,
                body.deliveroo_url, body.justeat_url,
                int(body.is_active), hours_json,
            ),
        )
        row = db.execute("SELECT * FROM restaurants WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return _row_to_admin(row, db)


@router.put("/restaurants/{restaurant_id}", response_model=RestaurantAdmin)
def update_restaurant(restaurant_id: int, body: RestaurantUpdate, authorization: str = Header(...)):
    _require_superadmin(authorization)

    with get_db() as db:
        existing = db.execute("SELECT * FROM restaurants WHERE id = ?", (restaurant_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        updates = {}
        if body.name is not None:
            updates["name"] = body.name
            updates["slug"] = _make_slug(body.name)
        if body.address is not None:
            updates["address"] = body.address
        if body.cuisine_type is not None:
            updates["cuisine_type"] = body.cuisine_type
        if body.latitude is not None:
            updates["latitude"] = body.latitude
        if body.longitude is not None:
            updates["longitude"] = body.longitude
        if body.instagram_handle is not None:
            updates["instagram_handle"] = body.instagram_handle
        if body.facebook_handle is not None:
            updates["facebook_handle"] = body.facebook_handle
        if body.phone is not None:
            updates["phone"] = body.phone
        if body.whatsapp_number is not None:
            updates["whatsapp_number"] = body.whatsapp_number
        if body.owner_email is not None:
            updates["owner_email"] = body.owner_email
        if body.theme is not None:
            updates["theme"] = body.theme
        if body.deliveroo_url is not None:
            updates["deliveroo_url"] = body.deliveroo_url
        if body.justeat_url is not None:
            updates["justeat_url"] = body.justeat_url
        if body.opening_hours is not None:
            updates["opening_hours"] = json.dumps(body.opening_hours)
        if body.is_active is not None:
            updates["is_active"] = int(body.is_active)

        if updates:
            set_clause = ", ".join(f"{k} = ?" for k in updates)
            values = list(updates.values()) + [restaurant_id]
            db.execute(
                f"UPDATE restaurants SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                values,
            )

        row = db.execute("SELECT * FROM restaurants WHERE id = ?", (restaurant_id,)).fetchone()
        return _row_to_admin(row, db)


@router.delete("/restaurants/{restaurant_id}", status_code=204)
def delete_restaurant(restaurant_id: int, authorization: str = Header(...)):
    _require_superadmin(authorization)
    with get_db() as db:
        # Delete related data first
        db.execute(
            "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = ?)",
            (restaurant_id,),
        )
        db.execute("DELETE FROM orders WHERE restaurant_id = ?", (restaurant_id,))
        db.execute("DELETE FROM menu_items WHERE restaurant_id = ?", (restaurant_id,))
        db.execute("DELETE FROM menu_categories WHERE restaurant_id = ?", (restaurant_id,))
        deleted = db.execute("DELETE FROM restaurants WHERE id = ?", (restaurant_id,)).rowcount
    if not deleted:
        raise HTTPException(status_code=404, detail="Restaurant not found")


@router.post("/restaurants/{restaurant_id}/regenerate-token")
def regenerate_admin_token(restaurant_id: int, authorization: str = Header(...)):
    """Generate a new admin token for a restaurant."""
    _require_superadmin(authorization)
    new_token = secrets.token_urlsafe(32)
    with get_db() as db:
        updated = db.execute(
            "UPDATE restaurants SET admin_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_token, restaurant_id),
        ).rowcount
    if not updated:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return {"admin_token": new_token}


@router.get("/stats")
def get_stats(authorization: str = Header(...)):
    """Get platform-wide statistics."""
    _require_superadmin(authorization)
    with get_db() as db:
        restaurants = db.execute("SELECT COUNT(*) as c FROM restaurants").fetchone()["c"]
        active = db.execute("SELECT COUNT(*) as c FROM restaurants WHERE is_active = 1").fetchone()["c"]
        orders = db.execute("SELECT COUNT(*) as c FROM orders").fetchone()["c"]
        pending = db.execute("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'").fetchone()["c"]
        revenue = db.execute("SELECT COALESCE(SUM(subtotal), 0) as total FROM orders WHERE status = 'collected'").fetchone()["total"]
        menu_items = db.execute("SELECT COUNT(*) as c FROM menu_items").fetchone()["c"]
    return {
        "restaurants": restaurants,
        "active_restaurants": active,
        "total_orders": orders,
        "pending_orders": pending,
        "total_revenue": round(revenue, 2),
        "total_menu_items": menu_items,
    }
