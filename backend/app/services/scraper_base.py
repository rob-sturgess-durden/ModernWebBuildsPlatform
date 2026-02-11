import json
import logging
import time
import random
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]


class BaseScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": random.choice(USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-GB,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        })

    def fetch_page(self, url: str) -> BeautifulSoup:
        time.sleep(random.uniform(1, 3))
        response = self.session.get(url, timeout=15)
        response.raise_for_status()
        return BeautifulSoup(response.text, "html.parser")

    def extract_jsonld(self, soup: BeautifulSoup) -> list[dict]:
        """Extract menu items from JSON-LD structured data."""
        scripts = soup.find_all("script", type="application/ld+json")
        for script in scripts:
            try:
                data = json.loads(script.string)
                # Handle single object or array
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
                })
        return items

    def scrape_menu(self, url: str) -> list[dict]:
        raise NotImplementedError
