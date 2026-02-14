import json
import time
from datetime import datetime, timezone

import requests

from ..database import get_db


INSTAGRAM_APP_ID = "936619743392459"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"


def _iso_from_unix(ts: int | None) -> str | None:
    if not ts:
        return None
    return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat()


def _scrape_public_profile(handle: str, limit: int) -> list[dict]:
    # Best-effort public endpoint. This can break if Instagram changes it.
    url = f"https://i.instagram.com/api/v1/users/web_profile_info/?username={handle}"
    headers = {
        "User-Agent": UA,
        "Accept": "application/json",
        "X-IG-App-ID": INSTAGRAM_APP_ID,
    }
    r = requests.get(url, headers=headers, timeout=20)
    r.raise_for_status()
    payload = r.json()
    user = (payload.get("data") or {}).get("user") or {}
    edges = ((user.get("edge_owner_to_timeline_media") or {}).get("edges") or [])[:limit]

    posts: list[dict] = []
    for e in edges:
        node = e.get("node") or {}
        shortcode = node.get("shortcode")
        if not shortcode:
            continue
        caption_edges = ((node.get("edge_media_to_caption") or {}).get("edges") or [])
        caption = None
        if caption_edges:
            caption = ((caption_edges[0] or {}).get("node") or {}).get("text")

        posts.append(
            {
                "id": str(node.get("id") or shortcode),
                "shortcode": shortcode,
                "permalink": f"https://www.instagram.com/p/{shortcode}/",
                "media_url": node.get("display_url") or node.get("thumbnail_src"),
                "caption": caption,
                "timestamp": _iso_from_unix(node.get("taken_at_timestamp")),
                "is_video": bool(node.get("is_video")),
            }
        )
    return posts


def get_recent_posts(handle: str, limit: int = 8, ttl_seconds: int = 1800) -> list[dict]:
    handle = (handle or "").lstrip("@").strip()
    if not handle:
        return []

    now = int(time.time())

    with get_db() as db:
        row = db.execute(
            "SELECT fetched_at, json FROM instagram_cache WHERE instagram_handle = ?",
            (handle,),
        ).fetchone()
        if row:
            fetched_at = row["fetched_at"]
            try:
                # SQLite returns str timestamp by default.
                fetched_ts = int(datetime.fromisoformat(fetched_at.replace("Z", "+00:00")).timestamp())
            except Exception:
                fetched_ts = 0
            if fetched_ts and (now - fetched_ts) < ttl_seconds:
                try:
                    cached = json.loads(row["json"])
                    if isinstance(cached, list):
                        return cached[:limit]
                except Exception:
                    pass

    # Cache miss (or stale): fetch again.
    try:
        posts = _scrape_public_profile(handle, limit=limit)
    except Exception:
        posts = []

    with get_db() as db:
        db.execute(
            "INSERT INTO instagram_cache(instagram_handle, fetched_at, json) VALUES (?, CURRENT_TIMESTAMP, ?) "
            "ON CONFLICT(instagram_handle) DO UPDATE SET fetched_at = CURRENT_TIMESTAMP, json = excluded.json",
            (handle, json.dumps(posts)),
        )

    return posts[:limit]

