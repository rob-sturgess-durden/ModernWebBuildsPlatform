from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .database import init_db
from . import config
from .routers import restaurants, menu, orders, admin, superadmin, webhooks, sendgrid_inbound, uploads

# Ensure upload directory exists before StaticFiles mounts (Starlette checks at import-time).
try:
    os.makedirs(config.UPLOAD_DIR, exist_ok=True)
except Exception:
    pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Hackney Eats", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(restaurants.router, prefix="/api")
app.include_router(menu.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(superadmin.router, prefix="/api")
app.include_router(webhooks.router, prefix="/api")
app.include_router(sendgrid_inbound.router, prefix="/api")
app.include_router(uploads.router, prefix="/api")

# Serve uploaded media via backend so nginx only needs to proxy /api/*.
app.mount("/api/media", StaticFiles(directory=config.UPLOAD_DIR), name="media")


@app.get("/api/health")
def health():
    return {"status": "ok"}
