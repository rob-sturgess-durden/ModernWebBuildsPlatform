#!/usr/bin/env bash
set -euo pipefail

# Fetches Instagram posts locally (works from residential IPs) and pushes
# the JSON into the server's instagram_cache table via SSH + temp file.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PEM_PATH="/Users/robsturgess/python-local/ai-python-bot/tradingbot.pem"
REMOTE_USER="ubuntu"
REMOTE_HOST="35.176.77.68"
REMOTE_DB="/opt/modernwebdevelopment/backend/data/orders.db"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pem)  PEM_PATH="$2"; shift 2 ;;
    --host) REMOTE_HOST="$2"; shift 2 ;;
    --user) REMOTE_USER="$2"; shift 2 ;;
    *)      echo "Unknown option: $1"; exit 1 ;;
  esac
done

INSTAGRAM_APP_ID="936619743392459"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

echo "==> Fetching restaurant list"
RESTAURANTS=$(curl -s "https://modernwebbuilds.co.uk/api/restaurants")
SLUGS=$(echo "$RESTAURANTS" | python3 -c "import sys,json; [print(r['slug']) for r in json.load(sys.stdin)]")

for SLUG in $SLUGS; do
  DETAIL=$(curl -s "https://modernwebbuilds.co.uk/api/restaurants/$SLUG")
  HANDLE=$(echo "$DETAIL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('instagram_handle') or '')")

  if [[ -z "$HANDLE" ]]; then
    echo "    $SLUG: no instagram handle, skipping"
    continue
  fi

  echo "==> Scraping @$HANDLE for $SLUG"
  POSTS_JSON=$(curl -s \
    "https://i.instagram.com/api/v1/users/web_profile_info/?username=$HANDLE" \
    -H "User-Agent: $UA" \
    -H "X-IG-App-ID: $INSTAGRAM_APP_ID" \
    | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    user = (data.get('data') or {}).get('user') or {}
    edges = ((user.get('edge_owner_to_timeline_media') or {}).get('edges') or [])[:8]
    posts = []
    for e in edges:
        node = e.get('node') or {}
        sc = node.get('shortcode')
        if not sc: continue
        cap_edges = ((node.get('edge_media_to_caption') or {}).get('edges') or [])
        cap = ((cap_edges[0] or {}).get('node') or {}).get('text') if cap_edges else None
        posts.append({
            'id': str(node.get('id') or sc),
            'shortcode': sc,
            'permalink': f'https://www.instagram.com/p/{sc}/',
            'media_url': node.get('display_url') or node.get('thumbnail_src'),
            'caption': cap,
            'timestamp': None,
            'is_video': bool(node.get('is_video')),
        })
    print(json.dumps(posts))
except Exception:
    print('[]')
")

  COUNT=$(echo "$POSTS_JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
  echo "    Found $COUNT posts"

  if [[ "$COUNT" -gt 0 ]]; then
    # Write a Python helper script to the server that safely inserts via parameterised query
    LOCAL_TMP=$(mktemp /tmp/ig_cache_XXXXXX.json)
    echo "$POSTS_JSON" > "$LOCAL_TMP"
    scp -i "$PEM_PATH" "$LOCAL_TMP" "$REMOTE_USER@$REMOTE_HOST:/tmp/ig_cache_upload.json"
    rm -f "$LOCAL_TMP"

    ssh -i "$PEM_PATH" "$REMOTE_USER@$REMOTE_HOST" "python3 -c \"
import sqlite3, pathlib
db = sqlite3.connect('$REMOTE_DB')
j = pathlib.Path('/tmp/ig_cache_upload.json').read_text()
db.execute(
    'INSERT INTO instagram_cache(instagram_handle, fetched_at, json) VALUES (?, datetime(\\\"now\\\"), ?) '
    'ON CONFLICT(instagram_handle) DO UPDATE SET fetched_at = datetime(\\\"now\\\"), json = excluded.json',
    ('$HANDLE', j),
)
db.commit()
db.close()
\""
    echo "    Cached on server"
  fi

  sleep 2
done

echo "==> Done refreshing Instagram cache"
