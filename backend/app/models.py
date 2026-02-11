from pydantic import BaseModel
from typing import Optional
import json


# --- Restaurant ---

class RestaurantSummary(BaseModel):
    id: int
    name: str
    slug: str
    address: str
    cuisine_type: str
    theme: str

class RestaurantDetail(RestaurantSummary):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    instagram_handle: Optional[str] = None
    facebook_handle: Optional[str] = None
    phone: Optional[str] = None
    opening_hours: Optional[dict] = None

    @classmethod
    def from_row(cls, row):
        hours = None
        if row["opening_hours"]:
            try:
                hours = json.loads(row["opening_hours"])
            except (json.JSONDecodeError, TypeError):
                pass
        return cls(
            id=row["id"],
            name=row["name"],
            slug=row["slug"],
            address=row["address"],
            cuisine_type=row["cuisine_type"],
            latitude=row["latitude"],
            longitude=row["longitude"],
            instagram_handle=row["instagram_handle"],
            facebook_handle=row["facebook_handle"],
            phone=row["phone"],
            opening_hours=hours,
            theme=row["theme"],
        )


# --- Menu ---

class MenuCategory(BaseModel):
    id: int
    name: str
    display_order: int
    items: list["MenuItem"] = []

class MenuItem(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    is_available: bool = True
    dietary_tags: list[str] = []
    category_id: Optional[int] = None

    @classmethod
    def from_row(cls, row):
        tags = []
        if row["dietary_tags"]:
            try:
                tags = json.loads(row["dietary_tags"])
            except (json.JSONDecodeError, TypeError):
                pass
        return cls(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            price=row["price"],
            image_url=row["image_url"],
            is_available=bool(row["is_available"]),
            dietary_tags=tags,
            category_id=row["category_id"],
        )

class MenuItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    image_url: Optional[str] = None
    dietary_tags: list[str] = []
    category_id: Optional[int] = None

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    image_url: Optional[str] = None
    is_available: Optional[bool] = None
    dietary_tags: Optional[list[str]] = None
    category_id: Optional[int] = None

class CategoryCreate(BaseModel):
    name: str
    display_order: int = 0


# --- Orders ---

class OrderItemCreate(BaseModel):
    menu_item_id: int
    quantity: int = 1
    notes: Optional[str] = None

class OrderCreate(BaseModel):
    restaurant_id: int
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    pickup_time: str
    special_instructions: Optional[str] = None
    items: list[OrderItemCreate]

class OrderItemResponse(BaseModel):
    id: int
    item_name: str
    quantity: int
    unit_price: float
    notes: Optional[str] = None

class OrderResponse(BaseModel):
    id: int
    order_number: str
    restaurant_id: int
    restaurant_name: str
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    pickup_time: str
    special_instructions: Optional[str] = None
    subtotal: float
    status: str
    items: list[OrderItemResponse] = []
    created_at: str

class OrderStatusUpdate(BaseModel):
    status: str


# --- Admin ---

class AdminLogin(BaseModel):
    token: str

class ScrapeRequest(BaseModel):
    source: str  # "deliveroo" or "justeat"
    url: Optional[str] = None


# --- Super Admin ---

class RestaurantCreate(BaseModel):
    name: str
    address: str
    cuisine_type: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    instagram_handle: Optional[str] = None
    facebook_handle: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    owner_email: Optional[str] = None
    theme: str = "modern"
    deliveroo_url: Optional[str] = None
    justeat_url: Optional[str] = None
    opening_hours: Optional[dict] = None
    is_active: bool = True

class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    cuisine_type: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    instagram_handle: Optional[str] = None
    facebook_handle: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    owner_email: Optional[str] = None
    theme: Optional[str] = None
    deliveroo_url: Optional[str] = None
    justeat_url: Optional[str] = None
    opening_hours: Optional[dict] = None
    is_active: Optional[bool] = None

class RestaurantAdmin(BaseModel):
    """Full restaurant detail including admin-only fields."""
    id: int
    name: str
    slug: str
    address: str
    cuisine_type: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    instagram_handle: Optional[str] = None
    facebook_handle: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    owner_email: Optional[str] = None
    admin_token: str
    theme: str
    deliveroo_url: Optional[str] = None
    justeat_url: Optional[str] = None
    is_active: bool
    opening_hours: Optional[dict] = None
    created_at: Optional[str] = None
    order_count: int = 0
    menu_item_count: int = 0
