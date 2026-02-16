# ForkIt System Overview

## Purpose
This project is a multi-restaurant click-and-collect platform:
- Customer-facing restaurant sites (menu, basket, checkout)
- Restaurant admin (orders/menu)
- Super admin (multi-restaurant management)
- WhatsApp + email notifications

## Repository Structure
- `backend/`: FastAPI backend + SQLite data access
- `frontend/`: Vite + React frontend
- `scripts/`: helper/generator/deploy scripts
- `demo-pages/`: legacy generated demo pages
- `.env`: runtime secrets/config (not committed)
- `.env.example`: template env keys

## Backend (FastAPI)
- Entry point: `backend/app/main.py`
- Routers:
  - `backend/app/routers/restaurants.py`: public restaurant endpoints
  - `backend/app/routers/menu.py`: public menu endpoints
  - `backend/app/routers/orders.py`: create/check orders + owner action links
  - `backend/app/routers/admin.py`: restaurant admin APIs
  - `backend/app/routers/superadmin.py`: super admin APIs
  - `backend/app/routers/webhooks.py`: inbound Twilio webhook endpoint
- Services:
  - `backend/app/services/order_service.py`: order creation/state transitions
  - `backend/app/services/notification.py`: Twilio WhatsApp + SendGrid/SMTP email
  - `backend/app/services/scraper_deliveroo.py`, `scraper_justeat.py`: menu scraping

## Frontend (React)
- App shell/routes: `frontend/src/App.jsx`
- Public pages:
  - `/` landing page
  - `/restaurants`
  - `/:slug` restaurant menu/checkout
  - `/order/:orderNumber` order tracking
- Admin pages:
  - `/admin`, `/admin/dashboard`
  - `/superadmin`, `/superadmin/dashboard`
- API client: `frontend/src/api/client.js`

## Data Layer
- DB file: `backend/data/orders.db`
- Key tables:
  - `restaurants`
  - `menu_categories`
  - `menu_items`
  - `orders`
  - `order_items`

## Production Deployment Topology
- Host: `ubuntu@35.176.77.68`
- Domain: `https://forkitt.com`
- Nginx:
  - Static frontend root (legacy path on disk): `/var/www/modernwebbuilds.co.uk`
  - Reverse proxy `/api/*` -> backend localhost port
- Backend:
  - App path: `/opt/modernwebdevelopment/backend`
  - Service: `modernwebdevelopment-backend` (systemd)
  - Python venv: `/opt/modernwebdevelopment/backend/.venv`

## Runtime Integrations
- Twilio WhatsApp:
  - Outbound order/customer messages
  - Inbound webhook endpoint: `/api/webhooks/twilio/whatsapp`
- SendGrid:
  - Primary email send path via API key (`SENDGRID_API_KEY`)
  - SMTP fallback when API key is absent/fails
- Scrapers:
  - Deliveroo/Just Eat menu extraction with admin import workflow

## Deploy Script
- Script: `scripts/deploy_remote.sh`
- Default PEM path:
  - `/Users/robsturgess/python-local/ai-python-bot/tradingbot.pem`
- What it does:
  - Builds frontend
  - Syncs backend app + requirements
  - Installs backend requirements in venv
  - Restarts systemd backend
  - Syncs frontend dist to Nginx web root
  - Runs health check

Run:
```bash
bash scripts/deploy_remote.sh
```

Optional overrides:
```bash
bash scripts/deploy_remote.sh \
  --pem /path/to/key.pem \
  --host 35.176.77.68 \
  --user ubuntu
```
