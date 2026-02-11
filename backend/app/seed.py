"""Seed the database from the existing CSV and add sample menu items."""
import csv
import json
import re
import secrets
import sys
from pathlib import Path

# Allow running as standalone script
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.database import init_db, get_db


CSV_PATH = Path(__file__).resolve().parent.parent.parent / "scripts" / "HakcneyResturants.csv"

ADDRESS_COORDINATES = {
    "244 Morning Lane, London E9 6RQ": (51.5454, -0.0556),
    "96 Lower Clapton Road, London E5 0QR": (51.5589, -0.0567),
    "St John at Hackney Courtyard, Lower Clapton Rd, London E5 0PD": (51.5589, -0.0567),
    "38 Amhurst Road, Hackney, London E8 1JN": (51.5489, -0.0556),
    "51B Chatsworth Road, Lower Clapton, London E5 0LH": (51.5589, -0.0567),
    "354 Mare Street, Hackney, London E8 1HR": (51.5489, -0.0556),
}

SAMPLE_MENUS = {
    "beans-bites": {  # slug for "Beans & Bites"
        "Breakfast": [
            ("Shakshuka", "Eggs poached in spiced tomato sauce with sourdough", 9.50, ["vegetarian"]),
            ("Full Halal Breakfast", "Beef sausages, eggs, beans, toast, grilled tomato, mushrooms", 11.00, ["halal"]),
            ("Avocado Toast", "Smashed avocado on sourdough with poached eggs", 8.50, ["vegetarian"]),
            ("Pancake Stack", "Fluffy pancakes with maple syrup and fresh berries", 8.00, ["vegetarian"]),
        ],
        "Beverages": [
            ("Flat White", "Double-shot espresso with steamed milk", 3.50, []),
            ("Fresh Orange Juice", "Freshly squeezed orange juice", 3.00, []),
            ("Mint Tea", "Fresh mint leaves steeped in hot water", 2.80, []),
        ],
        "Lunch": [
            ("Lamb Kofta Wrap", "Spiced lamb kofta with salad and tahini in flatbread", 10.50, ["halal"]),
            ("Falafel Bowl", "Crispy falafel with hummus, tabbouleh, and pickled veg", 9.00, ["vegetarian", "vegan"]),
        ],
    },
    "the-full-english": {
        "Breakfast": [
            ("The Full English", "Two eggs, bacon, sausage, beans, toast, grilled tomato, mushrooms", 10.50, []),
            ("Veggie Full English", "Two eggs, veggie sausages, beans, toast, grilled tomato, mushrooms, avocado", 10.00, ["vegetarian"]),
            ("Eggs Benedict", "Poached eggs on english muffin with hollandaise", 9.00, []),
            ("Bacon Roll", "Smoked back bacon in a fresh bread roll", 5.50, []),
        ],
        "Beverages": [
            ("Builder's Tea", "Classic strong English breakfast tea with milk", 2.00, []),
            ("Americano", "Double-shot black coffee", 2.80, []),
            ("Hot Chocolate", "Rich hot chocolate with whipped cream", 3.20, []),
        ],
        "Lunch": [
            ("Fish Finger Sandwich", "Crispy fish fingers with tartare sauce in white bread", 7.50, []),
            ("Sausage & Mash", "Cumberland sausages with mash and onion gravy", 9.50, []),
        ],
    },
    "sons-coffee-kiosk": {
        "Coffee": [
            ("Espresso", "Single-origin espresso shot", 2.50, []),
            ("Flat White", "Double-shot with silky steamed milk", 3.50, []),
            ("Oat Latte", "Espresso with steamed oat milk", 3.80, ["vegan"]),
            ("V60 Pour Over", "Single-origin filter coffee, brewed fresh", 4.00, []),
            ("Iced Americano", "Double-shot espresso over ice", 3.20, []),
        ],
        "Food": [
            ("Sourdough Toastie", "Ham and cheese on fresh sourdough", 5.50, []),
            ("Vegan Toastie", "Roasted veg and hummus on sourdough", 5.50, ["vegan"]),
            ("Cinnamon Roll", "Fresh-baked cinnamon roll with cream cheese icing", 3.50, ["vegetarian"]),
            ("Banana Bread", "Homemade banana bread, served warm", 3.00, ["vegetarian"]),
        ],
    },
    "mess-cafe": {
        "All Day Breakfast": [
            ("Full English", "Eggs, bacon, sausage, beans, toast, tomato, mushrooms, black pudding", 9.50, []),
            ("Half English", "Egg, bacon, sausage, beans, toast", 6.50, []),
            ("Egg & Bacon Roll", "Fried egg and bacon in a soft roll", 4.50, []),
            ("Beans on Toast", "Classic baked beans on thick white toast", 4.00, ["vegetarian"]),
        ],
        "Drinks": [
            ("Tea", "Standard English tea", 1.80, []),
            ("Coffee", "Filter coffee", 2.00, []),
            ("Can of Coke", "330ml", 1.50, []),
        ],
        "Lunch": [
            ("Cheese Burger", "Beef burger with cheese in a brioche bun", 7.50, []),
            ("Chips", "Thick-cut chips", 3.00, ["vegetarian", "vegan"]),
        ],
    },
    "peoples-choice-caribbean": {
        "Mains": [
            ("Jerk Chicken", "Charcoal-grilled jerk chicken with rice & peas", 10.00, ["gluten-free"]),
            ("Curry Goat", "Slow-cooked curried goat with white rice", 11.00, ["gluten-free"]),
            ("Ackee & Saltfish", "Traditional Jamaican ackee with salted cod and dumplings", 10.50, []),
            ("Oxtail Stew", "Rich braised oxtail with butter beans and rice", 12.00, ["gluten-free"]),
        ],
        "Sides": [
            ("Plantain", "Fried sweet plantain", 3.00, ["vegan", "gluten-free"]),
            ("Rice & Peas", "Coconut rice with kidney beans", 3.00, ["vegan", "gluten-free"]),
            ("Beef Patty", "Flaky pastry filled with spiced beef", 2.50, []),
            ("Festival", "Sweet fried dumplings", 2.00, ["vegetarian"]),
        ],
        "Drinks": [
            ("Ting", "Grapefruit soda", 1.80, []),
            ("Supermalt", "Malt beverage", 2.00, []),
            ("Sorrel Punch", "Hibiscus and ginger drink", 2.50, []),
        ],
    },
    "rainbow-cookout": {
        "Grill": [
            ("Jerk Chicken Quarter", "Charcoal-grilled jerk chicken leg quarter", 7.00, ["gluten-free"]),
            ("Jerk Chicken Half", "Half jerk chicken, charcoal-grilled", 10.00, ["gluten-free"]),
            ("Jerk Pork", "Slow-cooked jerk pork shoulder", 9.00, ["gluten-free"]),
            ("BBQ Corn", "Charcoal-grilled corn on the cob with jerk butter", 3.00, ["vegetarian", "gluten-free"]),
        ],
        "Sides": [
            ("Rice & Peas", "Coconut rice with gungo peas", 3.00, ["vegan", "gluten-free"]),
            ("Coleslaw", "Homemade creamy coleslaw", 2.00, ["vegetarian"]),
            ("Hard Dough Bread", "Thick-sliced traditional bread", 1.50, ["vegan"]),
        ],
        "Drinks": [
            ("Coconut Water", "Fresh coconut water", 2.50, []),
            ("Ginger Beer", "Homemade ginger beer", 2.00, []),
        ],
    },
}


def make_slug(name: str) -> str:
    slug = re.sub(r"[^\w\s-]", "", name).strip().replace(" ", "-").lower()
    return re.sub(r"-+", "-", slug)  # collapse multiple dashes


def extract_social_media(text: str):
    instagram = facebook = None
    if text and text.lower() != "none" and "no official" not in text.lower():
        m = re.search(r"instagram\s*\(@([^)]+)\)", text, re.IGNORECASE)
        if m:
            instagram = m.group(1)
        m = re.search(r"facebook\s*\(([^)]+)\)", text, re.IGNORECASE)
        if m:
            facebook = m.group(1)
    return instagram, facebook


def seed():
    init_db()

    with get_db() as db:
        existing = db.execute("SELECT COUNT(*) as c FROM restaurants").fetchone()["c"]
        if existing > 0:
            print(f"Database already has {existing} restaurants. Skipping seed.")
            return

    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        restaurants = list(reader)

    print(f"Seeding {len(restaurants)} restaurants from CSV...")

    with get_db() as db:
        for row in restaurants:
            name = row["Restaurant"]
            address = row["Address"]
            cuisine = row["Cuisine/Type"]
            social = row["Social Media Presence"]

            slug = make_slug(name)
            lat, lng = ADDRESS_COORDINATES.get(address, (51.5454, -0.0556))
            instagram, facebook = extract_social_media(social)
            token = secrets.token_urlsafe(32)

            db.execute(
                """INSERT INTO restaurants
                   (name, slug, address, cuisine_type, latitude, longitude,
                    instagram_handle, facebook_handle, admin_token, theme)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'modern')""",
                (name, slug, address, cuisine, lat, lng, instagram, facebook, token),
            )
            print(f"  + {name} (slug: {slug}, token: {token[:12]}...)")

        # Seed menu items
        for slug, categories in SAMPLE_MENUS.items():
            restaurant = db.execute("SELECT id FROM restaurants WHERE slug = ?", (slug,)).fetchone()
            if not restaurant:
                continue
            rid = restaurant["id"]
            for order_idx, (cat_name, items) in enumerate(categories.items()):
                cursor = db.execute(
                    "INSERT INTO menu_categories (restaurant_id, name, display_order) VALUES (?, ?, ?)",
                    (rid, cat_name, order_idx),
                )
                cat_id = cursor.lastrowid
                for item_name, desc, price, tags in items:
                    db.execute(
                        """INSERT INTO menu_items
                           (restaurant_id, category_id, name, description, price, dietary_tags)
                           VALUES (?, ?, ?, ?, ?, ?)""",
                        (rid, cat_id, item_name, desc, price, json.dumps(tags) if tags else None),
                    )
            print(f"  + Menu seeded for {slug}")

    print("\nDone! Admin tokens printed above - save these for restaurant owners.")
    print("Run the API: uvicorn app.main:app --reload")


if __name__ == "__main__":
    seed()
