#!/usr/bin/env bash
set -euo pipefail

# Deploy ModernWebBuildsPlatform to production server.
#
# Usage:
#   bash scripts/deploy_remote.sh
#   bash scripts/deploy_remote.sh --pem /path/to/tradingbot.pem --host 35.176.77.68 --user ubuntu

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

PEM_PATH="/Users/robsturgess/python-local/ai-python-bot/tradingbot.pem"
REMOTE_USER="ubuntu"
REMOTE_HOST="35.176.77.68"
REMOTE_APP_DIR="/opt/modernwebdevelopment"
REMOTE_WEB_DIR="/var/www/modernwebbuilds.co.uk"
REMOTE_SERVICE="modernwebdevelopment-backend"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pem)
      PEM_PATH="$2"
      shift 2
      ;;
    --host)
      REMOTE_HOST="$2"
      shift 2
      ;;
    --user)
      REMOTE_USER="$2"
      shift 2
      ;;
    --app-dir)
      REMOTE_APP_DIR="$2"
      shift 2
      ;;
    --web-dir)
      REMOTE_WEB_DIR="$2"
      shift 2
      ;;
    --service)
      REMOTE_SERVICE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [[ ! -f "$PEM_PATH" ]]; then
  echo "PEM file not found: $PEM_PATH"
  exit 1
fi

chmod 600 "$PEM_PATH"

echo "==> Building frontend"
cd "$ROOT_DIR/frontend"
npm run build

echo "==> Sync backend code"
cd "$ROOT_DIR"
rsync -avz \
  --exclude '.DS_Store' \
  --exclude '__pycache__' \
  --exclude '*.pyc' \
  -e "ssh -i $PEM_PATH" \
  backend/app/ \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_APP_DIR/backend/app/"

rsync -avz \
  -e "ssh -i $PEM_PATH" \
  backend/requirements.txt \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_APP_DIR/backend/requirements.txt"

echo "==> Sync frontend build"
rsync -avz --delete \
  -e "ssh -i $PEM_PATH" \
  frontend/dist/ \
  "$REMOTE_USER@$REMOTE_HOST:/tmp/modernwebbuilds-dist/"

echo "==> Apply on server"
ssh -i "$PEM_PATH" "$REMOTE_USER@$REMOTE_HOST" "
  set -euo pipefail
  cd '$REMOTE_APP_DIR/backend'
  . .venv/bin/activate
  pip install -r requirements.txt >/tmp/modernwebbuilds-pip.log 2>&1 || {
    echo 'pip install failed, see /tmp/modernwebbuilds-pip.log'
    exit 1
  }

  sudo systemctl restart '$REMOTE_SERVICE'
  sudo systemctl is-active '$REMOTE_SERVICE'

  sudo mkdir -p '$REMOTE_WEB_DIR'
  sudo rsync -av --delete /tmp/modernwebbuilds-dist/ '$REMOTE_WEB_DIR/'
  sudo chown -R www-data:www-data '$REMOTE_WEB_DIR'
  rm -rf /tmp/modernwebbuilds-dist
"

echo "==> Health check"
for i in {1..15}; do
  if curl -fsS "https://modernwebbuilds.co.uk/api/health" >/tmp/modernwebbuilds-health.out; then
    break
  fi
  sleep 1
done

echo "Health: $(cat /tmp/modernwebbuilds-health.out)"
echo "Deploy complete."

