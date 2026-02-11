import json
import logging
from .scraper_base import BaseScraper

logger = logging.getLogger(__name__)


class DeliverooScraper(BaseScraper):
    """Scrape menu items from Deliveroo restaurant pages."""

    def scrape_menu(self, url: str) -> list[dict]:
        logger.info(f"Scraping Deliveroo: {url}")
        soup = self.fetch_page(url)

        # Strategy 1: JSON-LD structured data
        items = self.extract_jsonld(soup)
        if items:
            logger.info(f"Found {len(items)} items via JSON-LD")
            return [{"source": "deliveroo", **i} for i in items]

        # Strategy 2: Embedded script data (Deliveroo embeds menu in __NEXT_DATA__ or similar)
        items = self._extract_from_scripts(soup)
        if items:
            logger.info(f"Found {len(items)} items via script data")
            return items

        # Strategy 3: HTML parsing
        items = self._extract_from_html(soup)
        if items:
            logger.info(f"Found {len(items)} items via HTML parsing")
            return items

        logger.warning("No menu items found on Deliveroo page")
        return []

    def _extract_from_scripts(self, soup) -> list[dict]:
        """Try to find menu data in embedded script tags."""
        for script in soup.find_all("script"):
            text = script.string or ""
            # Deliveroo sometimes embeds data as JSON in script tags
            if "menuItem" in text or "menu_item" in text or '"items"' in text:
                try:
                    # Try to find JSON object boundaries
                    start = text.find("{")
                    end = text.rfind("}") + 1
                    if start >= 0 and end > start:
                        data = json.loads(text[start:end])
                        return self._extract_items_from_data(data)
                except (json.JSONDecodeError, TypeError):
                    continue
        return []

    def _extract_items_from_data(self, data: dict, depth=0) -> list[dict]:
        """Recursively search for menu item patterns in nested data."""
        if depth > 10:
            return []
        items = []

        if isinstance(data, dict):
            # Check if this looks like a menu item
            if "name" in data and "price" in data:
                price = data["price"]
                if isinstance(price, dict):
                    price = price.get("fractional", 0) / 100
                elif isinstance(price, str):
                    price = float(price.replace("£", "").strip() or 0)
                items.append({
                    "name": str(data["name"]),
                    "description": str(data.get("description", "")),
                    "price": float(price),
                    "category": str(data.get("categoryName", data.get("category", "Other"))),
                    "source": "deliveroo",
                })
            else:
                for v in data.values():
                    items.extend(self._extract_items_from_data(v, depth + 1))
        elif isinstance(data, list):
            for item in data:
                items.extend(self._extract_items_from_data(item, depth + 1))

        return items

    def _extract_from_html(self, soup) -> list[dict]:
        """Fallback: parse menu from HTML structure."""
        items = []
        current_category = "Other"

        # Look for category headings and item cards
        for el in soup.find_all(["h2", "h3", "div", "span"]):
            # Category headers
            if el.name in ("h2", "h3"):
                text = el.get_text(strip=True)
                if text and len(text) < 50:
                    current_category = text

            # Item cards - look for elements with price-like text nearby
            if el.name in ("div", "span") and el.get("data-testid"):
                name_el = el.find(["h3", "h4", "span", "p"])
                price_el = el.find(string=lambda t: t and "£" in t)

                if name_el and price_el:
                    name = name_el.get_text(strip=True)
                    price_text = price_el.strip()
                    try:
                        price = float(price_text.replace("£", "").strip())
                    except ValueError:
                        continue
                    desc_el = el.find("p")
                    items.append({
                        "name": name,
                        "description": desc_el.get_text(strip=True) if desc_el and desc_el != name_el else "",
                        "price": price,
                        "category": current_category,
                        "source": "deliveroo",
                    })

        return items
