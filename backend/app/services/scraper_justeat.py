import json
import logging
from .scraper_base import BaseScraper

logger = logging.getLogger(__name__)


class JustEatScraper(BaseScraper):
    """Scrape menu items from Just Eat restaurant pages."""

    def scrape_menu(self, url: str) -> list[dict]:
        logger.info(f"Scraping Just Eat: {url}")
        soup = self.fetch_page(url)

        # Strategy 1: __NEXT_DATA__ (Just Eat uses Next.js)
        items = self._extract_from_next_data(soup)
        if items:
            logger.info(f"Found {len(items)} items via __NEXT_DATA__")
            return items

        # Strategy 2: JSON-LD
        items = self.extract_jsonld(soup)
        if items:
            logger.info(f"Found {len(items)} items via JSON-LD")
            return [{"source": "justeat", **i} for i in items]

        # Strategy 3: HTML parsing
        items = self._extract_from_html(soup)
        if items:
            logger.info(f"Found {len(items)} items via HTML parsing")
            return items

        logger.warning("No menu items found on Just Eat page")
        return []

    def _extract_from_next_data(self, soup) -> list[dict]:
        """Extract menu from Next.js __NEXT_DATA__ script tag."""
        script = soup.find("script", id="__NEXT_DATA__")
        if not script or not script.string:
            return []

        try:
            data = json.loads(script.string)
        except json.JSONDecodeError:
            return []

        # Navigate through Next.js page props
        props = data.get("props", {}).get("pageProps", {})
        return self._find_menu_in_props(props)

    def _find_menu_in_props(self, props: dict) -> list[dict]:
        """Search props for menu data - structure varies by page version."""
        items = []

        # Try common paths
        menu = (
            props.get("menu", {})
            or props.get("initialMenuState", {})
            or props.get("restaurant", {}).get("menu", {})
        )

        categories = (
            menu.get("categories", [])
            or menu.get("sections", [])
            or menu.get("menuCategories", [])
        )

        if not categories and isinstance(props, dict):
            # Deep search for category-like structures
            categories = self._deep_find_categories(props)

        for cat in categories:
            cat_name = cat.get("name", cat.get("title", "Other"))
            cat_items = cat.get("items", cat.get("products", cat.get("menuItems", [])))

            for mi in cat_items:
                price = mi.get("price", 0)
                if isinstance(price, dict):
                    price = price.get("current", price.get("value", 0))
                # Just Eat prices are sometimes in pence
                if isinstance(price, (int, float)) and price > 100:
                    price = price / 100

                items.append({
                    "name": mi.get("name", mi.get("title", "Unknown")),
                    "description": mi.get("description", mi.get("subtitle", "")),
                    "price": float(price),
                    "category": cat_name,
                    "source": "justeat",
                })

        return items

    def _deep_find_categories(self, data, depth=0) -> list:
        """Recursively search for arrays that look like menu categories."""
        if depth > 8:
            return []
        if isinstance(data, dict):
            for key, val in data.items():
                if key in ("categories", "sections", "menuCategories", "menuSections"):
                    if isinstance(val, list) and val:
                        # Check if items in the list have 'name' and 'items' keys
                        if isinstance(val[0], dict) and ("items" in val[0] or "products" in val[0]):
                            return val
                result = self._deep_find_categories(val, depth + 1)
                if result:
                    return result
        elif isinstance(data, list):
            for item in data[:5]:  # limit search
                result = self._deep_find_categories(item, depth + 1)
                if result:
                    return result
        return []

    def _extract_from_html(self, soup) -> list[dict]:
        """Fallback: parse menu from HTML structure."""
        items = []
        current_category = "Other"

        # Just Eat uses specific data attributes and class names
        for section in soup.find_all(["section", "div"], attrs={"data-test-id": True}):
            test_id = section.get("data-test-id", "")
            if "category" in test_id.lower() or "menu-section" in test_id.lower():
                header = section.find(["h2", "h3"])
                if header:
                    current_category = header.get_text(strip=True)

        # Look for item cards
        for card in soup.find_all(["div", "li"], class_=lambda c: c and ("item" in c.lower() or "product" in c.lower())):
            name_el = card.find(["h3", "h4", "span"], class_=lambda c: c and "name" in c.lower()) or card.find(["h3", "h4"])
            price_el = card.find(string=lambda t: t and "£" in t)

            if name_el and price_el:
                name = name_el.get_text(strip=True)
                try:
                    price = float(price_el.strip().replace("£", "").strip())
                except ValueError:
                    continue
                desc_el = card.find("p")
                items.append({
                    "name": name,
                    "description": desc_el.get_text(strip=True) if desc_el else "",
                    "price": price,
                    "category": current_category,
                    "source": "justeat",
                })

        return items
