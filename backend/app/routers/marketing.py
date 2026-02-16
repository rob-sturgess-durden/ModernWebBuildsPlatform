from fastapi import APIRouter, HTTPException

from ..database import get_db
from ..models import MarketingSignupCreate, MarketingSignupResponse

router = APIRouter(prefix="/marketing", tags=["marketing"])


@router.post("/signup", response_model=MarketingSignupResponse, status_code=201)
def marketing_signup(body: MarketingSignupCreate):
    """
    Capture a marketing signup from the restaurant page.
    The user must provide at least one of: email or phone.
    """
    name = (body.name or "").strip() or None
    email = (body.email or "").strip().lower() or None
    phone = (body.phone or "").strip() or None

    if not email and not phone:
        raise HTTPException(status_code=422, detail="Please enter at least an email or phone number.")

    rid = body.restaurant_id
    if rid is not None and rid <= 0:
        rid = None

    with get_db() as db:
        # Best-effort: avoid duplicates for the same restaurant + contact.
        existing = None
        if rid is not None and (email or phone):
            existing = db.execute(
                "SELECT id FROM marketing_signups "
                "WHERE restaurant_id = ? AND COALESCE(email, '') = COALESCE(?, '') AND COALESCE(phone, '') = COALESCE(?, '') "
                "ORDER BY id DESC LIMIT 1",
                (rid, email, phone),
            ).fetchone()
        if existing:
            return MarketingSignupResponse(id=int(existing["id"]))

        cur = db.execute(
            "INSERT INTO marketing_signups (restaurant_id, name, email, phone) VALUES (?, ?, ?, ?)",
            (rid, name, email, phone),
        )
        return MarketingSignupResponse(id=int(cur.lastrowid))

