import requests

from .. import config


PLACES_BASE = "https://places.googleapis.com/v1"
UA = "Mozilla/5.0 (ModernWebBuildsPlatform; +https://modernwebbuilds.co.uk)"


def _headers(field_mask: str) -> dict:
    if not config.GOOGLE_PLACES_API_KEY:
        raise RuntimeError("GOOGLE_PLACES_API_KEY is not configured")
    return {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": config.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": field_mask,
    }


def search_text(query: str, *, lat: float | None = None, lng: float | None = None, radius_m: int | None = None, limit: int = 20) -> list[dict]:
    """
    Text search for restaurants/cafes near a location (optional).
    Returns a list of lightweight place dicts.
    """
    query = (query or "").strip()
    if not query:
        return []

    body: dict = {
        "textQuery": query,
        "languageCode": "en",
        "maxResultCount": max(1, min(int(limit), 20)),
        # Keep to relevant venue types
        "includedType": "restaurant",
    }

    if lat is not None and lng is not None:
        # Bias results near the provided point.
        body["locationBias"] = {
            "circle": {
                "center": {"latitude": float(lat), "longitude": float(lng)},
                "radius": float(radius_m or 3000),
            }
        }

    r = requests.post(
        f"{PLACES_BASE}/places:searchText",
        json=body,
        headers=_headers(
            "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.primaryTypeDisplayName,places.photos"
        ),
        timeout=20,
    )
    r.raise_for_status()
    data = r.json() or {}
    places = data.get("places") or []
    results: list[dict] = []
    for p in places:
        loc = p.get("location") or {}
        dn = p.get("displayName") or {}
        photos = p.get("photos") or []
        photo_name = None
        if photos:
            photo_name = (photos[0] or {}).get("name")
        results.append(
            {
                "place_id": p.get("id"),
                "name": dn.get("text") or None,
                "address": p.get("formattedAddress") or None,
                "lat": loc.get("latitude"),
                "lng": loc.get("longitude"),
                "primary_type": p.get("primaryType"),
                "primary_type_label": (p.get("primaryTypeDisplayName") or {}).get("text"),
                "photo_name": photo_name,
            }
        )
    return [r for r in results if r.get("place_id") and r.get("name")]


def get_details(place_id: str) -> dict:
    place_id = (place_id or "").strip()
    if not place_id:
        raise ValueError("place_id required")
    r = requests.get(
        f"{PLACES_BASE}/places/{place_id}",
        headers=_headers(
            "id,displayName,formattedAddress,location,internationalPhoneNumber,nationalPhoneNumber,websiteUri,primaryType,primaryTypeDisplayName,googleMapsUri,photos"
        ),
        timeout=20,
    )
    r.raise_for_status()
    p = r.json() or {}
    loc = p.get("location") or {}
    dn = p.get("displayName") or {}
    photos = p.get("photos") or []
    photo_name = None
    if photos:
        photo_name = (photos[0] or {}).get("name")
    return {
        "place_id": p.get("id") or place_id,
        "name": dn.get("text") or None,
        "address": p.get("formattedAddress") or None,
        "lat": loc.get("latitude"),
        "lng": loc.get("longitude"),
        "phone": p.get("internationalPhoneNumber") or p.get("nationalPhoneNumber"),
        "website": p.get("websiteUri"),
        "maps_url": p.get("googleMapsUri"),
        "primary_type": p.get("primaryType"),
        "primary_type_label": (p.get("primaryTypeDisplayName") or {}).get("text"),
        "photo_name": photo_name,
    }


def get_photo_uri(photo_name: str, *, max_height_px: int = 800, max_width_px: int = 800) -> str | None:
    """
    Returns a short-lived public URL (photoUri) for a Places photo.
    Note: Google Places photos have usage/branding requirements and are not a stable asset URL.
    """
    photo_name = (photo_name or "").strip()
    if not photo_name:
        return None
    if not config.GOOGLE_PLACES_API_KEY:
        raise RuntimeError("GOOGLE_PLACES_API_KEY is not configured")

    params = {
        "maxHeightPx": str(int(max_height_px)),
        "maxWidthPx": str(int(max_width_px)),
        "skipHttpRedirect": "true",
    }
    headers = {
        "X-Goog-Api-Key": config.GOOGLE_PLACES_API_KEY,
        "User-Agent": UA,
        "Accept": "application/json",
    }
    r = requests.get(f"{PLACES_BASE}/{photo_name}/media", params=params, headers=headers, timeout=20)
    r.raise_for_status()
    payload = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    return payload.get("photoUri")
