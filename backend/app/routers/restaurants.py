from fastapi import APIRouter, HTTPException
from ..database import get_db
from ..models import RestaurantSummary, RestaurantDetail, InstagramPost
from ..services.instagram_service import get_recent_posts

router = APIRouter(prefix="/restaurants", tags=["restaurants"])


@router.get("", response_model=list[RestaurantSummary])
def list_restaurants():
    with get_db() as db:
        rows = db.execute(
            "SELECT id, name, slug, address, cuisine_type, theme, logo_url, banner_url FROM restaurants WHERE is_active = 1 ORDER BY name"
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/{slug}", response_model=RestaurantDetail)
def get_restaurant(slug: str):
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM restaurants WHERE slug = ? AND is_active = 1", (slug,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    return RestaurantDetail.from_row(row)


@router.get("/{slug}/instagram", response_model=list[InstagramPost])
def get_instagram_feed(slug: str, limit: int = 8):
    limit = max(1, min(int(limit), 12))
    with get_db() as db:
        row = db.execute(
            "SELECT instagram_handle FROM restaurants WHERE slug = ? AND is_active = 1", (slug,)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    handle = row["instagram_handle"]
    if not handle:
        return []
    posts = get_recent_posts(handle, limit=limit)
    return [InstagramPost(**p) for p in posts]
