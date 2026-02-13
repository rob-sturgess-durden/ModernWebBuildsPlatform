from fastapi import APIRouter, HTTPException
from ..database import get_db
from ..models import RestaurantSummary, RestaurantDetail

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
