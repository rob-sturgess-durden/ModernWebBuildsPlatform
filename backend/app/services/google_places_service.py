import io
import secrets
from pathlib import Path

import requests

from .. import config


PLACES_BASE = "https://places.googleapis.com/v1"
UA = "Mozilla/5.0 (ForkIt; +https://forkitt.com)"


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
            "id,displayName,formattedAddress,location,internationalPhoneNumber,nationalPhoneNumber,websiteUri,primaryType,primaryTypeDisplayName,googleMapsUri,photos,editorialSummary"
        ),
        timeout=20,
    )
    r.raise_for_status()
    p = r.json() or {}
    loc = p.get("location") or {}
    dn = p.get("displayName") or {}
    photos = p.get("photos") or []
    photo_names = [ph.get("name") for ph in photos if ph.get("name")]
    editorial = (p.get("editorialSummary") or {}).get("text") or None
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
        "photo_name": photo_names[0] if photo_names else None,
        "photo_names": photo_names,
        "editorial_summary": editorial,
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


# ---------------------------------------------------------------------------
# Download a Google Places photo and save it as a permanent upload
# ---------------------------------------------------------------------------

_EXT_MAP = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def download_photo_to_upload(photo_name: str, restaurant_id: int, kind: str = "gallery",
                             *, max_px: int = 1600) -> str | None:
    """
    Download a Google Places photo by its resource name and persist it into
    the upload directory.  Returns the public URL path (e.g. /api/media/r5/banner/xxx.jpg)
    or None on failure.
    """
    # First get the real image URL via the Places API
    photo_uri = get_photo_uri(photo_name, max_height_px=max_px, max_width_px=max_px)
    if not photo_uri:
        return None

    # Download the actual image bytes
    resp = requests.get(photo_uri, timeout=30, stream=True, headers={"User-Agent": UA})
    resp.raise_for_status()

    ctype = (resp.headers.get("content-type") or "image/jpeg").split(";")[0].strip().lower()
    ext = _EXT_MAP.get(ctype, ".jpg")

    base_dir = Path(config.UPLOAD_DIR)
    target_dir = base_dir / f"r{restaurant_id}" / kind
    target_dir.mkdir(parents=True, exist_ok=True)

    fname = f"{secrets.token_urlsafe(12)}{ext}"
    target_path = target_dir / fname

    total = 0
    with target_path.open("wb") as f:
        for chunk in resp.iter_content(chunk_size=256 * 1024):
            total += len(chunk)
            if total > config.UPLOAD_MAX_BYTES:
                target_path.unlink(missing_ok=True)
                return None
            f.write(chunk)

    # Best-effort resize using the same logic as uploads router
    try:
        from PIL import Image, ImageOps
        limits = {"banner": (2400, 1350), "logo": (512, 512), "gallery": (2000, 2000)}
        max_w, max_h = limits.get(kind, (1600, 1600))
        with Image.open(target_path) as img:
            img = ImageOps.exif_transpose(img)
            img.thumbnail((max_w, max_h))
            save_kw = {}
            if ext in {".jpg", ".jpeg"}:
                if img.mode not in ("RGB", "L"):
                    img = img.convert("RGB")
                save_kw = {"quality": 85, "optimize": True}
                img.save(target_path, format="JPEG", **save_kw)
            elif ext == ".png":
                img.save(target_path, format="PNG", optimize=True)
            elif ext == ".webp":
                if img.mode not in ("RGB", "RGBA"):
                    img = img.convert("RGB")
                img.save(target_path, format="WEBP", quality=82, method=6)
    except Exception:
        pass  # keep original if Pillow unavailable

    rel = target_path.relative_to(base_dir).as_posix()
    return f"{config.UPLOAD_BASE_PATH}/{rel}"


# ---------------------------------------------------------------------------
# Fetch logo / favicon from a restaurant's own website
# ---------------------------------------------------------------------------

def fetch_website_logo(website_url: str, restaurant_id: int) -> str | None:
    """
    Try to grab a logo or high-res favicon from the restaurant's website.
    Looks for og:image, apple-touch-icon, and standard favicons.
    Returns a permanent upload URL or None.
    """
    if not website_url:
        return None

    try:
        resp = requests.get(website_url, timeout=15, headers={
            "User-Agent": UA,
            "Accept": "text/html",
        }, allow_redirects=True)
        resp.raise_for_status()
        html = resp.text[:200_000]  # limit parsing
    except Exception:
        return None

    import re
    from urllib.parse import urljoin

    logo_url = None

    # 1) og:image – often a good logo/brand image
    m = re.search(r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)', html, re.I)
    if not m:
        m = re.search(r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']', html, re.I)
    if m:
        logo_url = urljoin(website_url, m.group(1))

    # 2) apple-touch-icon (usually 180x180+)
    if not logo_url:
        m = re.search(r'<link[^>]+rel=["\']apple-touch-icon["\'][^>]+href=["\']([^"\']+)', html, re.I)
        if m:
            logo_url = urljoin(website_url, m.group(1))

    # 3) Any large favicon
    if not logo_url:
        m = re.search(r'<link[^>]+rel=["\'](?:icon|shortcut icon)["\'][^>]+href=["\']([^"\']+)', html, re.I)
        if m:
            logo_url = urljoin(website_url, m.group(1))

    if not logo_url:
        return None

    # Download and save as logo
    try:
        img_resp = requests.get(logo_url, timeout=15, headers={"User-Agent": UA}, stream=True)
        img_resp.raise_for_status()

        ctype = (img_resp.headers.get("content-type") or "").split(";")[0].strip().lower()
        ext = _EXT_MAP.get(ctype)
        if not ext:
            # Guess from URL
            url_lower = logo_url.lower()
            if ".png" in url_lower:
                ext = ".png"
            elif ".svg" in url_lower:
                return None  # skip SVGs for now
            elif ".webp" in url_lower:
                ext = ".webp"
            else:
                ext = ".jpg"

        base_dir = Path(config.UPLOAD_DIR)
        target_dir = base_dir / f"r{restaurant_id}" / "logo"
        target_dir.mkdir(parents=True, exist_ok=True)

        fname = f"{secrets.token_urlsafe(12)}{ext}"
        target_path = target_dir / fname

        total = 0
        with target_path.open("wb") as f:
            for chunk in img_resp.iter_content(chunk_size=256 * 1024):
                total += len(chunk)
                if total > 2 * 1024 * 1024:  # 2MB limit for logos
                    target_path.unlink(missing_ok=True)
                    return None
                f.write(chunk)

        # Resize to logo dimensions
        try:
            from PIL import Image, ImageOps
            with Image.open(target_path) as img:
                img = ImageOps.exif_transpose(img)
                img.thumbnail((512, 512))
                if ext in {".jpg", ".jpeg"}:
                    if img.mode not in ("RGB", "L"):
                        img = img.convert("RGB")
                    img.save(target_path, format="JPEG", quality=85, optimize=True)
                elif ext == ".png":
                    img.save(target_path, format="PNG", optimize=True)
                elif ext == ".webp":
                    if img.mode not in ("RGB", "RGBA"):
                        img = img.convert("RGB")
                    img.save(target_path, format="WEBP", quality=82, method=6)
        except Exception:
            pass

        rel = target_path.relative_to(base_dir).as_posix()
        return f"{config.UPLOAD_BASE_PATH}/{rel}"
    except Exception:
        return None
