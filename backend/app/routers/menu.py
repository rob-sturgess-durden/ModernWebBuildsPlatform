from fastapi import APIRouter, HTTPException
from ..database import get_db
from ..models import MenuCategory, MenuItem

router = APIRouter(prefix="/restaurants/{slug}/menu", tags=["menu"])


@router.get("", response_model=list[MenuCategory])
def get_menu(slug: str):
    with get_db() as db:
        restaurant = db.execute(
            "SELECT id FROM restaurants WHERE slug = ? AND is_active = 1", (slug,)
        ).fetchone()
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        rid = restaurant["id"]
        categories = db.execute(
            "SELECT * FROM menu_categories WHERE restaurant_id = ? AND is_active = 1 ORDER BY display_order",
            (rid,),
        ).fetchall()

        items = db.execute(
            "SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = 1 ORDER BY name",
            (rid,),
        ).fetchall()

    # Group items by category
    items_by_cat = {}
    uncategorized = []
    for item in items:
        mi = MenuItem.from_row(item)
        if item["category_id"]:
            items_by_cat.setdefault(item["category_id"], []).append(mi)
        else:
            uncategorized.append(mi)

    result = []
    for cat in categories:
        result.append(MenuCategory(
            id=cat["id"],
            name=cat["name"],
            display_order=cat["display_order"],
            items=items_by_cat.get(cat["id"], []),
        ))

    if uncategorized:
        result.append(MenuCategory(id=0, name="Other", display_order=999, items=uncategorized))

    return result
