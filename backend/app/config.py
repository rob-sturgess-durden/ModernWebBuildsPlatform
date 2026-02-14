import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

DATABASE_PATH = os.getenv("DATABASE_PATH", str(Path(__file__).resolve().parent.parent / "data" / "orders.db"))

# Twilio
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_WHATSAPP_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "+14155238886")
WHATSAPP_ENABLED = os.getenv("WHATSAPP_ENABLED", "true").lower() == "true"
TWILIO_VALIDATE_SIGNATURE = os.getenv("TWILIO_VALIDATE_SIGNATURE", "false").lower() == "true"
TWILIO_OPTIN_CONTENT_SID = os.getenv("TWILIO_OPTIN_CONTENT_SID", "")
TWILIO_OPTIN_ENABLED = os.getenv("TWILIO_OPTIN_ENABLED", "true").lower() == "true"
TWILIO_OWNER_NEW_ORDER_CONTENT_SID = os.getenv("TWILIO_OWNER_NEW_ORDER_CONTENT_SID", "")

# Email (SMTP)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.sendgrid.net")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "orders@modernwebbuilds.com")

# Email (SendGrid API)
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
SENDGRID_FROM = os.getenv("SENDGRID_FROM", SMTP_FROM)
SENDGRID_DATA_RESIDENCY = os.getenv("SENDGRID_DATA_RESIDENCY", "")  # set "eu" for EU regional subuser
SENDGRID_INBOUND_TOKEN = os.getenv("SENDGRID_INBOUND_TOKEN", "")

# App
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5174")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", FRONTEND_URL).rstrip("/")

# Uploads / media
UPLOAD_DIR = os.getenv(
    "UPLOAD_DIR",
    str(Path(__file__).resolve().parent.parent / "data" / "uploads"),
)
UPLOAD_MAX_BYTES = int(os.getenv("UPLOAD_MAX_BYTES", str(6 * 1024 * 1024)))  # 6MB
UPLOAD_BASE_PATH = os.getenv("UPLOAD_BASE_PATH", "/api/media")

# Super admin - set this in .env to secure it
SUPER_ADMIN_TOKEN = os.getenv("SUPER_ADMIN_TOKEN", "superadmin-change-me")

# Google Places (server-side only)
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY", "")
