import os
import secrets
from pathlib import Path

from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile

from .. import config
from ..database import get_db

router = APIRouter(prefix="/uploads", tags=["uploads"])

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def _normalize_bearer(authorization: str | None) -> str:
    if not authorization:
        return ""
    token = authorization.strip()
    if token.startswith("Bearer "):
        token = token.replace("Bearer ", "", 1).strip()
    token = "".join(ch for ch in token if ch.isprintable() and not ch.isspace())
    return token


def _is_superadmin(token: str) -> bool:
    # Keep in sync with backend/app/routers/superadmin.py behavior.
    try:
        from ..routers.superadmin import SUPERADMIN_AUTH_BYPASS, TEMP_BYPASS_TOKEN
    except Exception:
        SUPERADMIN_AUTH_BYPASS = False
        TEMP_BYPASS_TOKEN = ""

    if SUPERADMIN_AUTH_BYPASS:
        return True
    return token in {config.SUPER_ADMIN_TOKEN, TEMP_BYPASS_TOKEN}


def _get_admin_restaurant_id(token: str) -> int | None:
    if not token:
        return None
    with get_db() as db:
        row = db.execute("SELECT id FROM restaurants WHERE admin_token = ?", (token,)).fetchone()
        return int(row["id"]) if row else None


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)

def _looks_like_image(path: Path, ext: str) -> bool:
    try:
        with path.open("rb") as f:
            head = f.read(32)
    except Exception:
        return False

    if ext in {".jpg", ".jpeg"}:
        return head.startswith(b"\xff\xd8\xff")
    if ext == ".png":
        return head.startswith(b"\x89PNG\r\n\x1a\n")
    if ext == ".gif":
        return head.startswith(b"GIF87a") or head.startswith(b"GIF89a")
    if ext == ".webp":
        return head.startswith(b"RIFF") and b"WEBP" in head[:16]
    return False


def _resize_in_place(path: Path, kind: str) -> None:
    # Best-effort resize/rotate. If Pillow isn't available or file isn't an image, keep original.
    try:
        from PIL import Image, ImageOps
    except Exception:
        return

    limits = {
        "menu": (1200, 1200),
        "logo": (512, 512),
        "banner": (2400, 1350),
        "gallery": (2000, 2000),
    }
    max_w, max_h = limits.get(kind, (1600, 1600))

    with Image.open(path) as img:
        img = ImageOps.exif_transpose(img)
        img.thumbnail((max_w, max_h))

        fmt = (img.format or "").upper()
        ext = path.suffix.lower()

        save_kwargs = {}
        if ext in {".jpg", ".jpeg"} or fmt in {"JPEG", "JPG"}:
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            save_kwargs = {"quality": 85, "optimize": True}
            img.save(path, format="JPEG", **save_kwargs)
            return

        if ext == ".png" or fmt == "PNG":
            img.save(path, format="PNG", optimize=True)
            return

        if ext == ".webp" or fmt == "WEBP":
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGB")
            img.save(path, format="WEBP", quality=82, method=6)
            return

        if ext == ".gif" or fmt == "GIF":
            img.save(path, format="GIF")
            return


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    kind: str = Form("menu"),  # menu|logo|banner|gallery
    restaurant_id: int | None = Form(None),
    authorization: str | None = Header(None),
):
    token = _normalize_bearer(authorization)
    admin_rid = _get_admin_restaurant_id(token)
    is_super = _is_superadmin(token)

    if not admin_rid and not is_super:
        raise HTTPException(status_code=401, detail="Unauthorized")

    rid = admin_rid or restaurant_id
    if not rid:
        raise HTTPException(status_code=400, detail="restaurant_id is required for super admin uploads")

    kind = (kind or "menu").strip().lower()
    if kind not in {"menu", "logo", "banner", "gallery"}:
        raise HTTPException(status_code=400, detail="kind must be one of: menu, logo, banner, gallery")

    ctype = (file.content_type or "").lower()
    ext = ALLOWED_CONTENT_TYPES.get(ctype)
    if not ext:
        # Fall back to original extension if present and safe-ish.
        orig_ext = Path(file.filename or "").suffix.lower()
        if orig_ext in {".jpg", ".jpeg"}:
            ext = ".jpg"
        elif orig_ext in {".png", ".webp", ".gif"}:
            ext = orig_ext
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported content type: {file.content_type}")

    base_dir = Path(config.UPLOAD_DIR)
    target_dir = base_dir / f"r{rid}" / kind
    _ensure_dir(target_dir)

    fname = f"{secrets.token_urlsafe(12)}{ext}"
    target_path = target_dir / fname

    # Stream to disk with size limit.
    total = 0
    with target_path.open("wb") as out:
        while True:
            chunk = await file.read(1024 * 256)
            if not chunk:
                break
            total += len(chunk)
            if total > config.UPLOAD_MAX_BYTES:
                out.close()
                try:
                    target_path.unlink(missing_ok=True)
                except Exception:
                    pass
                raise HTTPException(status_code=413, detail="File too large")
            out.write(chunk)

    if not _looks_like_image(target_path, ext):
        try:
            target_path.unlink(missing_ok=True)
        except Exception:
            pass
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image")

    # Resize/optimize best-effort.
    try:
        _resize_in_place(target_path, kind)
    except Exception:
        pass

    rel = target_path.relative_to(base_dir).as_posix()
    url = f"{config.UPLOAD_BASE_PATH}/{rel}"

    return {"ok": True, "url": url, "bytes": total}
