import sqlite3
from contextlib import contextmanager
from . import config

def get_connection():
    conn = sqlite3.connect(config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS restaurants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                address TEXT NOT NULL,
                cuisine_type TEXT NOT NULL,
                latitude REAL,
                longitude REAL,
                logo_url TEXT,
                banner_url TEXT,
                instagram_handle TEXT,
                facebook_handle TEXT,
                phone TEXT,
                whatsapp_number TEXT,
                owner_email TEXT,
                admin_token TEXT NOT NULL,
                theme TEXT DEFAULT 'modern',
                deliveroo_url TEXT,
                justeat_url TEXT,
                is_active INTEGER DEFAULT 1,
                opening_hours TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS menu_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                restaurant_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                display_order INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
            );

            CREATE TABLE IF NOT EXISTS menu_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                restaurant_id INTEGER NOT NULL,
                category_id INTEGER,
                name TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                image_url TEXT,
                is_available INTEGER DEFAULT 1,
                dietary_tags TEXT,
                source TEXT DEFAULT 'manual',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
                FOREIGN KEY (category_id) REFERENCES menu_categories(id)
            );

            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                restaurant_id INTEGER NOT NULL,
                order_number TEXT NOT NULL UNIQUE,
                owner_action_token TEXT,
                customer_name TEXT NOT NULL,
                customer_phone TEXT NOT NULL,
                customer_email TEXT,
                pickup_time TEXT NOT NULL,
                special_instructions TEXT,
                subtotal REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                status_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
            );

            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                menu_item_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                unit_price REAL NOT NULL,
                item_name TEXT NOT NULL,
                notes TEXT,
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
            );

            CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
            CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
            CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status ON orders(restaurant_id, status);
            CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant ON menu_items(restaurant_id);
            CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

            CREATE TABLE IF NOT EXISTS whatsapp_optins (
                phone TEXT PRIMARY KEY,
                opted_in INTEGER NOT NULL DEFAULT 0,
                source TEXT DEFAULT 'whatsapp',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS inbound_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider TEXT NOT NULL,      -- sendgrid|twilio
                channel TEXT NOT NULL,       -- email|whatsapp
                direction TEXT NOT NULL,     -- inbound|outbound
                from_addr TEXT,
                to_addr TEXT,
                subject TEXT,
                body_text TEXT,
                body_html TEXT,
                order_number TEXT,
                action TEXT,
                status TEXT,                 -- ok|ignored|error
                meta_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_inbound_messages_created ON inbound_messages(created_at);
            CREATE INDEX IF NOT EXISTS idx_inbound_messages_order ON inbound_messages(order_number);
        """)

        # Lightweight migrations for existing SQLite files.
        order_columns = [r["name"] for r in db.execute("PRAGMA table_info(orders)").fetchall()]
        if "owner_action_token" not in order_columns:
            db.execute("ALTER TABLE orders ADD COLUMN owner_action_token TEXT")

        restaurant_columns = [r["name"] for r in db.execute("PRAGMA table_info(restaurants)").fetchall()]
        if "logo_url" not in restaurant_columns:
            db.execute("ALTER TABLE restaurants ADD COLUMN logo_url TEXT")
        if "banner_url" not in restaurant_columns:
            db.execute("ALTER TABLE restaurants ADD COLUMN banner_url TEXT")
