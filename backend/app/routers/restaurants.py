from fastapi import APIRouter, HTTPException, Query
from ..database import get_db
from ..models import RestaurantSummary, RestaurantDetail, InstagramPost, GalleryImage
from ..services.instagram_service import get_recent_posts

router = APIRouter(prefix="/restaurants", tags=["restaurants"])


def _require_accessible(slug: str, password: str | None = None):
    """Return the restaurant row if accessible, or raise 403/404."""
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM restaurants WHERE slug = ? AND is_active = 1", (slug,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    status = row["status"] if "status" in row.keys() else "live"
    if status == "pending":
        preview_pw = row["preview_password"] if "preview_password" in row.keys() else None
        if not preview_pw or not password or password != preview_pw:
            raise HTTPException(status_code=403, detail="password_required")
    return row


@router.get("", response_model=list[RestaurantSummary])
def list_restaurants():
    with get_db() as db:
        rows = db.execute(
            "SELECT id, name, slug, address, cuisine_type, theme, logo_url, banner_url "
            "FROM restaurants WHERE is_active = 1 AND COALESCE(status, 'live') = 'live' ORDER BY name"
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/{slug}", response_model=RestaurantDetail)
def get_restaurant(slug: str, password: str | None = Query(None)):
    row = _require_accessible(slug, password)
    return RestaurantDetail.from_row(row)


@router.get("/{slug}/instagram", response_model=list[InstagramPost])
def get_instagram_feed(slug: str, limit: int = 8, password: str | None = Query(None)):
    limit = max(1, min(int(limit), 12))
    row = _require_accessible(slug, password)
    handle = (row["instagram_handle"] or "").strip().lstrip("@")
    if not handle:
        return []
    posts = get_recent_posts(handle, limit=limit)
    return [InstagramPost(**p) for p in posts]


@router.get("/{slug}/gallery", response_model=list[GalleryImage])
def get_gallery(slug: str, password: str | None = Query(None)):
    row = _require_accessible(slug, password)
    with get_db() as db:
        rows = db.execute(
            "SELECT id, image_url, caption, display_order FROM gallery_images "
            "WHERE restaurant_id = ? ORDER BY display_order, id",
            (row["id"],),
        ).fetchall()
    return [dict(r) for r in rows]
