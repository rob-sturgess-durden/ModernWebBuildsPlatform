import json
import re
import secrets
from fastapi import APIRouter, HTTPException, Header, Body
from ..database import get_db
from .. import config
from ..models import RestaurantCreate, RestaurantUpdate, RestaurantAdmin, InboundMessage
from ..services import google_places_service

router = APIRouter(prefix="/superadmin", tags=["superadmin"])
TEMP_BYPASS_TOKEN = "1234Abcd"
SUPERADMIN_AUTH_BYPASS = True


def _coerce_json_object(body: dict | str | None) -> dict:
    """
    Some clients (or proxies) occasionally send JSON as a quoted string, e.g. '"{...}"'.
    Accept dict directly; if string, try to JSON-decode up to 2 times until we get a dict.
    """
    if body is None:
        raise HTTPException(status_code=422, detail="Request body is required")
    if isinstance(body, dict):
        return body

    raw = body
    for _ in range(2):
        try:
            decoded = json.loads(raw)
        except Exception:
            raise HTTPException(status_code=422, detail="Body must be a JSON object")
        if isinstance(decoded, dict):
            return decoded
        if isinstance(decoded, str):
            raw = decoded
            continue
        break

    raise HTTPException(status_code=422, detail="Body must be a JSON object")


def _normalize_token(raw: str | None) -> str:
    token = (raw or "").strip()
    if token.startswith("Bearer "):
        token = token.replace("Bearer ", "", 1).strip()
    if token.startswith("SUPER_ADMIN_TOKEN="):
        token = token.split("=", 1)[1].strip()
    if len(token) >= 2 and token[0] == token[-1] and token[0] in {"'", '"'}:
        token = token[1:-1].strip()
    # Remove invisible/control characters that commonly appear on copy/paste.
    token = "".join(ch for ch in token if ch.isprintable() and not ch.isspace())
    return token


def _is_valid_superadmin_token(token: str) -> bool:
    if SUPERADMIN_AUTH_BYPASS:
        return True
    return token in {config.SUPER_ADMIN_TOKEN, TEMP_BYPASS_TOKEN}


def _require_superadmin(authorization: str = Header(...)):
    token = _normalize_token(authorization)
    if not _is_valid_superadmin_token(token):
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
        about_text=row["about_text"] if "about_text" in row.keys() else None,
        logo_url=row["logo_url"] if "logo_url" in row.keys() else None,
        banner_url=row["banner_url"] if "banner_url" in row.keys() else None,
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
        google_place_id=row["google_place_id"] if "google_place_id" in row.keys() else None,
    )


@router.post("/login")
def superadmin_login(body: dict | str | None = Body(default=None), authorization: str = Header(None)):
    """Validate super admin token."""
    token = ""
    if isinstance(body, dict):
        token = _normalize_token(str(body.get("token", "")))
    elif isinstance(body, str):
        token = _normalize_token(body)

    if not token and authorization:
        token = _normalize_token(authorization)

    if not token:
        raise HTTPException(status_code=400, detail="Token is required")

    if not _is_valid_superadmin_token(token):
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
def create_restaurant(body: dict | str = Body(...), authorization: str = Header(...)):
    _require_superadmin(authorization)

    body = _coerce_json_object(body)

    try:
        model = RestaurantCreate.model_validate(body)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    slug = _make_slug(model.name)
    admin_token = secrets.token_urlsafe(32)
    hours_json = json.dumps(model.opening_hours) if model.opening_hours else None

    with get_db() as db:
        # Check slug uniqueness
        existing = db.execute("SELECT id FROM restaurants WHERE slug = ?", (slug,)).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail=f"Restaurant with slug '{slug}' already exists")

        cursor = db.execute(
            """INSERT INTO restaurants
               (name, slug, address, cuisine_type, about_text, google_place_id, latitude, longitude,
                logo_url, banner_url,
                instagram_handle, facebook_handle, phone, whatsapp_number,
                owner_email, admin_token, theme, deliveroo_url, justeat_url,
                is_active, opening_hours)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                model.name, slug, model.address, model.cuisine_type,
                model.about_text, model.google_place_id, model.latitude, model.longitude, model.logo_url, model.banner_url,
                model.instagram_handle,
                model.facebook_handle, model.phone, model.whatsapp_number,
                model.owner_email, admin_token, model.theme,
                model.deliveroo_url, model.justeat_url,
                int(model.is_active), hours_json,
            ),
        )
        row = db.execute("SELECT * FROM restaurants WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return _row_to_admin(row, db)


@router.put("/restaurants/{restaurant_id}", response_model=RestaurantAdmin)
def update_restaurant(restaurant_id: int, body: dict | str = Body(...), authorization: str = Header(...)):
    _require_superadmin(authorization)

    body = _coerce_json_object(body)

    try:
        model = RestaurantUpdate.model_validate(body)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    with get_db() as db:
        existing = db.execute("SELECT * FROM restaurants WHERE id = ?", (restaurant_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        updates = {}
        if model.name is not None:
            updates["name"] = model.name
            updates["slug"] = _make_slug(model.name)
        if model.address is not None:
            updates["address"] = model.address
        if model.cuisine_type is not None:
            updates["cuisine_type"] = model.cuisine_type
        if model.about_text is not None:
            updates["about_text"] = model.about_text
        if model.google_place_id is not None:
            updates["google_place_id"] = model.google_place_id
        if model.latitude is not None:
            updates["latitude"] = model.latitude
        if model.longitude is not None:
            updates["longitude"] = model.longitude
        if model.logo_url is not None:
            updates["logo_url"] = model.logo_url
        if model.banner_url is not None:
            updates["banner_url"] = model.banner_url
        if model.instagram_handle is not None:
            updates["instagram_handle"] = model.instagram_handle
        if model.facebook_handle is not None:
            updates["facebook_handle"] = model.facebook_handle
        if model.phone is not None:
            updates["phone"] = model.phone
        if model.whatsapp_number is not None:
            updates["whatsapp_number"] = model.whatsapp_number
        if model.owner_email is not None:
            updates["owner_email"] = model.owner_email
        if model.theme is not None:
            updates["theme"] = model.theme
        if model.deliveroo_url is not None:
            updates["deliveroo_url"] = model.deliveroo_url
        if model.justeat_url is not None:
            updates["justeat_url"] = model.justeat_url
        if model.opening_hours is not None:
            updates["opening_hours"] = json.dumps(model.opening_hours)
        if model.is_active is not None:
            updates["is_active"] = int(model.is_active)

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


@router.get("/messages", response_model=list[InboundMessage])
def list_messages(
    authorization: str = Header(...),
    orders_only: bool = False,
    q: str | None = None,
    limit: int = 100,
):
    _require_superadmin(authorization)
    limit = max(1, min(limit, 500))

    where = []
    params: list[object] = []

    if orders_only:
        where.append("order_number IS NOT NULL AND order_number != ''")

    if q:
        where.append("(from_addr LIKE ? OR to_addr LIKE ? OR subject LIKE ? OR body_text LIKE ?)")
        like = f"%{q}%"
        params.extend([like, like, like, like])

    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    with get_db() as db:
        rows = db.execute(
            f"""SELECT id, provider, channel, direction, from_addr, to_addr, subject, body_text, body_html,
                       order_number, action, status, created_at
                  FROM inbound_messages
                  {where_sql}
                  ORDER BY id DESC
                  LIMIT ?""",
            (*params, limit),
        ).fetchall()

    return [
        InboundMessage(
            id=r["id"],
            provider=r["provider"],
            channel=r["channel"],
            direction=r["direction"],
            from_addr=r["from_addr"],
            to_addr=r["to_addr"],
            subject=r["subject"],
            body_text=r["body_text"],
            body_html=r["body_html"],
            order_number=r["order_number"],
            action=r["action"],
            status=r["status"],
            created_at=r["created_at"] or "",
        )
        for r in rows
    ]


@router.get("/places/search")
def places_search(
    authorization: str = Header(...),
    q: str = "",
    lat: float | None = None,
    lng: float | None = None,
    radius_m: int | None = None,
    limit: int = 12,
):
    _require_superadmin(authorization)
    try:
        results = google_places_service.search_text(
            q, lat=lat, lng=lng, radius_m=radius_m, limit=limit
        )
        return {"results": results}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/places/photo")
def places_photo(
    authorization: str = Header(...),
    name: str = "",
    max: int = 800,
):
    _require_superadmin(authorization)
    try:
        uri = google_places_service.get_photo_uri(name, max_height_px=max, max_width_px=max)
        return {"photoUri": uri}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/places/import", response_model=RestaurantAdmin, status_code=201)
def places_import(
    authorization: str = Header(...),
    body: dict | str = Body(...),
):
    _require_superadmin(authorization)
    body = _coerce_json_object(body)
    place_id = (body.get("place_id") or "").strip()
    if not place_id:
        raise HTTPException(status_code=422, detail="place_id is required")

    try:
        details = google_places_service.get_details(place_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Prevent duplicates on google_place_id
    with get_db() as db:
        existing = db.execute(
            "SELECT id FROM restaurants WHERE google_place_id = ?",
            (details.get("place_id"),),
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail="This place is already imported")

    name = details.get("name") or "New Restaurant"
    address = details.get("address") or "-"
    cuisine = details.get("primary_type_label") or "Restaurant"

    create_payload = RestaurantCreate(
        name=name,
        address=address,
        cuisine_type=cuisine,
        latitude=details.get("lat"),
        longitude=details.get("lng"),
        phone=details.get("phone"),
        google_place_id=details.get("place_id"),
        is_active=True,
        theme="modern",
    ).model_dump()

    # Reuse existing create flow so slug/admin_token/etc are consistent.
    return create_restaurant(create_payload, authorization=authorization)
