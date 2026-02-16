import json
import logging
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class DeliverooScraper:
    """Scrape menu items from Deliveroo restaurant pages using Playwright (headless browser)."""

    def scrape_menu(self, url: str) -> list[dict]:
        url = self._normalize_menu_url(url)
        logger.info(f"Scraping Deliveroo with Playwright: {url}")

        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            raise RuntimeError(
                "Playwright is not installed. Run: pip install playwright && playwright install chromium"
            )

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled", "--no-sandbox"],
            )
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                           "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={"width": 1920, "height": 1080},
                locale="en-GB",
            )
            page = context.new_page()
            # Hide webdriver flag to avoid bot detection
            page.add_init_script(
                'Object.defineProperty(navigator, "webdriver", { get: () => undefined });'
            )

            try:
                page.goto(url, wait_until="load", timeout=60000)
                # Wait for any Cloudflare challenge to pass
                for _ in range(15):
                    if "Just a moment" not in page.title():
                        break
                    page.wait_for_timeout(2000)
                page.wait_for_timeout(2000)
            except Exception as e:
                browser.close()
                raise RuntimeError(f"Failed to load page: {e}")

            html = page.content()

            # Grab __NEXT_DATA__ directly from the DOM
            next_data = None
            try:
                nd_el = page.query_selector("script#__NEXT_DATA__")
                if nd_el:
                    next_data = nd_el.inner_text()
            except Exception:
                pass

            browser.close()

        soup = BeautifulSoup(html, "html.parser")

        # Strategy 1: __NEXT_DATA__ (Deliveroo is a Next.js app)
        if next_data:
            try:
                items = self._extract_from_next_data(json.loads(next_data))
                if items:
                    logger.info(f"Found {len(items)} items via __NEXT_DATA__")
                    return items
            except (json.JSONDecodeError, TypeError):
                pass

        # Strategy 2: JSON-LD structured data
        items = self._extract_jsonld(soup)
        if items:
            logger.info(f"Found {len(items)} items via JSON-LD")
            return [{**i, "source": "deliveroo"} for i in items]

        # Strategy 3: Embedded script data
        items = self._extract_from_scripts(soup)
        if items:
            logger.info(f"Found {len(items)} items via script data")
            return items

        # Strategy 4: HTML parsing
        items = self._extract_from_html(soup)
        if items:
            logger.info(f"Found {len(items)} items via HTML parsing")
            return items

        logger.warning("No menu items found on Deliveroo page")
        return []

    def _normalize_menu_url(self, url: str) -> str:
        """
        Deliveroo sometimes returns a Cloudflare "Just a moment..." page for bare menu URLs.
        Adding basic query params improves success rate.
        """
        try:
            p = urlparse(url)
            q = dict(parse_qsl(p.query, keep_blank_values=True))
            q.setdefault("day", "today")
            q.setdefault("time", "ASAP")
            # DELIVERY tends to have the most complete menu data; admin can still choose pickup times separately.
            q.setdefault("fulfillment_method", "DELIVERY")
            new_query = urlencode(q, doseq=True)
            return urlunparse((p.scheme, p.netloc, p.path, p.params, new_query, ""))  # drop fragment
        except Exception:
            return url

    def _extract_from_next_data(self, data: dict) -> list[dict]:
        """Extract menu items from Next.js __NEXT_DATA__ payload.

        Deliveroo menu data shape varies by page/version. Prefer:
          props.initialState.menuPage.menu.metas.root.{items,categories}
        Fallback to a deep search for a dict containing both list fields
        `{items: [...], categories: [...]}` under `menuPage.menu`.
        """
        try:
            menu = data["props"]["initialState"]["menuPage"]["menu"]
        except (KeyError, TypeError):
            items: list[dict] = []
            self._walk_next_data(data, items)
            return items

        meta_root = None
        if isinstance(menu, dict):
            meta_root = (menu.get("metas") or {}).get("root") if isinstance(menu.get("metas"), dict) else None

        root = None
        if isinstance(meta_root, dict) and isinstance(meta_root.get("items"), list) and isinstance(meta_root.get("categories"), list):
            root = meta_root
        else:
            root = self._deep_find_menu_root(menu)

        if not isinstance(root, dict):
            items: list[dict] = []
            self._walk_next_data(data, items)
            return items

        # Build category id -> name map
        cat_map = {}
        for cat in root.get("categories", []):
            if isinstance(cat, dict) and "id" in cat and "name" in cat:
                cat_map[str(cat["id"])] = cat["name"]

        raw_items = root.get("items", [])
        results = []
        for obj in raw_items:
            if not isinstance(obj, dict):
                continue
            # Skip modifier/addon items (no categoryId, usually £0.00 sub-options)
            if not obj.get("categoryId"):
                continue
            item = self._parse_next_data_item(obj, cat_map)
            if item:
                results.append(item)
        return results

    def _deep_find_menu_root(self, obj, depth: int = 0) -> dict | None:
        """Find a dict containing both list fields `items` and `categories`."""
        if depth > 12:
            return None
        if isinstance(obj, dict):
            if (
                isinstance(obj.get("items"), list)
                and isinstance(obj.get("categories"), list)
                and obj.get("items")
                and obj.get("categories")
            ):
                return obj
            for v in obj.values():
                r = self._deep_find_menu_root(v, depth + 1)
                if r:
                    return r
        elif isinstance(obj, list):
            for v in obj[:40]:
                r = self._deep_find_menu_root(v, depth + 1)
                if r:
                    return r
        return None

    def _walk_next_data(self, obj, items: list, depth=0):
        """Fallback: recursively walk __NEXT_DATA__ looking for menu item structures."""
        if depth > 15:
            return
        if isinstance(obj, dict):
            if "name" in obj and ("price" in obj or "priceDiscovery" in obj or "rawPrice" in obj):
                item = self._parse_next_data_item(obj, {})
                if item:
                    items.append(item)
                    return
            for v in obj.values():
                self._walk_next_data(v, items, depth + 1)
        elif isinstance(obj, list):
            for v in obj:
                self._walk_next_data(v, items, depth + 1)

    def _parse_next_data_item(self, obj: dict, cat_map: dict) -> dict | None:
        """Parse a single menu item from __NEXT_DATA__."""
        name = obj.get("name")
        if not name or not isinstance(name, str):
            return None

        # Extract price
        price = 0.0
        if "price" in obj:
            p = obj["price"]
            if isinstance(p, dict):
                price = float(p.get("fractional", 0)) / 100
            elif isinstance(p, (int, float)):
                price = float(p)
            elif isinstance(p, str):
                price = float(p.replace("\u00a3", "").replace("£", "").strip() or 0)
        elif "rawPrice" in obj:
            price = float(obj["rawPrice"]) / 100

        # Extract image
        image_url = None
        img = obj.get("image") or obj.get("imageUrl") or obj.get("image_url")
        if isinstance(img, str):
            image_url = img
        elif isinstance(img, dict):
            image_url = img.get("url") or img.get("src")
        # Resolve Deliveroo image URL template
        if image_url and "{w}" in image_url:
            image_url = image_url.replace("{w}", "600").replace("{h}", "400")

        # Resolve category via categoryId -> cat_map
        category = "Other"
        cat_id = obj.get("categoryId")
        if cat_id and str(cat_id) in cat_map:
            category = cat_map[str(cat_id)]

        return {
            "name": name.strip(),
            "description": (obj.get("description") or "").strip(),
            "price": round(price, 2),
            "category": category,
            "image_url": image_url,
            "source": "deliveroo",
        }

    def _extract_jsonld(self, soup: BeautifulSoup) -> list[dict]:
        """Extract menu items from JSON-LD structured data."""
        scripts = soup.find_all("script", type="application/ld+json")
        for script in scripts:
            try:
                data = json.loads(script.string)
                items_list = data if isinstance(data, list) else [data]
                for item in items_list:
                    if item.get("@type") in ("Restaurant", "FoodEstablishment"):
                        return self._parse_jsonld_menu(item)
            except (json.JSONDecodeError, TypeError):
                continue
        return []

    def _parse_jsonld_menu(self, data: dict) -> list[dict]:
        """Parse menu from JSON-LD Restaurant schema."""
        menu = data.get("hasMenu", {})
        if isinstance(menu, list):
            menu = menu[0] if menu else {}
        sections = menu.get("hasMenuSection", [])
        items = []
        for section in sections:
            category_name = section.get("name", "Other")
            for mi in section.get("hasMenuItem", []):
                price = 0.0
                offers = mi.get("offers", {})
                if isinstance(offers, dict):
                    price = float(offers.get("price", 0))
                elif isinstance(offers, list) and offers:
                    price = float(offers[0].get("price", 0))
                items.append({
                    "name": mi.get("name", "Unknown"),
                    "description": mi.get("description", ""),
                    "price": price,
                    "category": category_name,
                    "image_url": mi.get("image") if isinstance(mi.get("image"), str) else None,
                })
        return items

    def _extract_from_scripts(self, soup) -> list[dict]:
        """Try to find menu data in embedded script tags."""
        for script in soup.find_all("script"):
            text = script.string or ""
            if "menuItem" in text or "menu_item" in text or '"items"' in text:
                try:
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
            if "name" in data and "price" in data:
                price = data["price"]
                if isinstance(price, dict):
                    price = price.get("fractional", 0) / 100
                elif isinstance(price, str):
                    price = float(price.replace("£", "").strip() or 0)
                image_url = (
                    data.get("image")
                    or data.get("imageUrl")
                    or data.get("image_url")
                    or data.get("photo")
                    or data.get("photoUrl")
                )
                if isinstance(image_url, dict):
                    image_url = image_url.get("url")
                items.append({
                    "name": str(data["name"]),
                    "description": str(data.get("description", "")),
                    "price": float(price),
                    "category": str(data.get("categoryName", data.get("category", "Other"))),
                    "image_url": image_url if isinstance(image_url, str) else None,
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
        for el in soup.find_all(["h2", "h3", "div", "span"]):
            if el.name in ("h2", "h3"):
                text = el.get_text(strip=True)
                if text and len(text) < 50:
                    current_category = text
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
                    img_el = el.find("img")
                    image_url = img_el.get("src") if img_el else None
                    items.append({
                        "name": name,
                        "description": desc_el.get_text(strip=True) if desc_el and desc_el != name_el else "",
                        "price": price,
                        "category": current_category,
                        "image_url": image_url,
                        "source": "deliveroo",
                    })
        return items
