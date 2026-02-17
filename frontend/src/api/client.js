const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function formatApiError(payload, fallback = "Request failed") {
  if (!payload) return fallback;

  if (typeof payload.detail === "string") return payload.detail;

  if (Array.isArray(payload.detail)) {
    const parts = payload.detail.map((item) => {
      if (typeof item === "string") return item;
      if (item?.msg && Array.isArray(item?.loc)) return `${item.loc.join(".")}: ${item.msg}`;
      if (item?.msg) return item.msg;
      return JSON.stringify(item);
    });
    return parts.join("; ");
  }

  if (payload.detail && typeof payload.detail === "object") {
    if (payload.detail.msg) return payload.detail.msg;
    return JSON.stringify(payload.detail);
  }

  if (typeof payload.message === "string") return payload.message;

  return fallback;
}

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const { headers: extraHeaders, ...rest } = options;
  const res = await fetch(url, {
    ...rest,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(formatApiError(err, `Request failed (${res.status})`));
  }
  if (res.status === 204) return null;
  return res.json();
}

async function upload(path, formData, headers = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(formatApiError(err, `Upload failed (${res.status})`));
  }
  return res.json();
}

export function getRestaurants() {
  return request("/restaurants");
}

export function getRestaurant(slug, password = null) {
  const q = password ? `?password=${encodeURIComponent(password)}` : "";
  return request(`/restaurants/${slug}${q}`);
}

export function getMenu(slug, password = null) {
  const q = password ? `?password=${encodeURIComponent(password)}` : "";
  return request(`/restaurants/${slug}/menu${q}`);
}

export function getInstagram(slug, limit = 8, password = null) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (password) params.set("password", password);
  return request(`/restaurants/${slug}/instagram?${params.toString()}`);
}

export function getGallery(slug, password = null) {
  const q = password ? `?password=${encodeURIComponent(password)}` : "";
  return request(`/restaurants/${slug}/gallery${q}`);
}

export function placeOrder(order) {
  return request("/orders", {
    method: "POST",
    body: JSON.stringify(order),
  });
}

export function getOrderStatus(orderNumber) {
  return request(`/orders/${orderNumber}`);
}

export function checkVerified(phone, email) {
  const params = new URLSearchParams();
  if (phone) params.set("phone", phone);
  if (email) params.set("email", email);
  return request(`/orders/check-verified?${params}`);
}

export function sendVerificationCode(phone, email) {
  return request("/orders/send-code", {
    method: "POST",
    body: JSON.stringify({ phone, email }),
  });
}

export function verifyCode(phone, email, code) {
  return request("/orders/verify-code", {
    method: "POST",
    body: JSON.stringify({ phone, email, code }),
  });
}

export function collectOrder(orderNumber) {
  return request(`/orders/${orderNumber}/collect`, { method: "POST" });
}

export function submitReview(orderNumber, rating, comment = "") {
  return request(`/orders/${orderNumber}/review`, {
    method: "POST",
    body: JSON.stringify({ rating, comment }),
  });
}

export function getReview(orderNumber) {
  return request(`/orders/${orderNumber}/review`);
}

export function marketingSignup({ restaurant_id = null, name = "", email = "", phone = "" } = {}) {
  return request("/marketing/signup", {
    method: "POST",
    body: JSON.stringify({ restaurant_id, name, email, phone }),
  });
}

// Admin endpoints
function adminHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export function adminLogin(token) {
  return request("/admin/login", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function requestMagicLink(email) {
  return request("/admin/magic-link", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function verifyMagicLink(token) {
  return request("/admin/magic-link/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export function getAdminStats(token) {
  return request("/admin/stats", { headers: adminHeaders(token) });
}

export function createTopupSession(token) {
  return request("/admin/topup", {
    method: "POST",
    headers: adminHeaders(token),
  });
}

export function getAdminCustomers(token) {
  return request("/admin/customers", { headers: adminHeaders(token) });
}

export function sendCustomerMessage(token, message, recipients) {
  return request("/admin/customers/send-message", {
    method: "POST",
    body: JSON.stringify({ message, recipients }),
    headers: adminHeaders(token),
  });
}

export function getAdminOrders(token, status = null) {
  const query = status ? `?status=${status}` : "";
  return request(`/admin/orders${query}`, { headers: adminHeaders(token) });
}

export function updateOrderStatus(token, orderId, status) {
  return request(`/admin/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
    headers: adminHeaders(token),
  });
}

export function getAdminMenu(token) {
  return request("/admin/menu", { headers: adminHeaders(token) });
}

export function addMenuItem(token, item) {
  return request("/admin/menu", {
    method: "POST",
    body: JSON.stringify(item),
    headers: adminHeaders(token),
  });
}

export function updateMenuItem(token, itemId, updates) {
  return request(`/admin/menu/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(updates),
    headers: adminHeaders(token),
  });
}

export function deleteMenuItem(token, itemId) {
  return request(`/admin/menu/${itemId}`, {
    method: "DELETE",
    headers: adminHeaders(token),
  });
}

export function getAdminCategories(token) {
  return request("/admin/categories", { headers: adminHeaders(token) });
}

export function getAdminRestaurant(token) {
  return request("/admin/restaurant", { headers: adminHeaders(token) });
}

export function updateAdminRestaurant(token, data) {
  return request("/admin/restaurant", {
    method: "PATCH",
    body: JSON.stringify(data),
    headers: adminHeaders(token),
  });
}

/** Scrape Deliveroo/Just Eat and optionally import items into menu. */
export function scrapeMenuWithImport(token, source, url = null, importToMenu = false) {
  const query = importToMenu ? "?import_to_menu=true" : "";
  return request(`/admin/menu/scrape${query}`, {
    method: "POST",
    body: JSON.stringify({ source, url }),
    headers: adminHeaders(token),
  });
}

export function addCategory(token, category) {
  return request("/admin/categories", {
    method: "POST",
    body: JSON.stringify(category),
    headers: adminHeaders(token),
  });
}

export function scrapeMenu(token, source, url = null) {
  return request("/admin/menu/scrape", {
    method: "POST",
    body: JSON.stringify({ source, url }),
    headers: adminHeaders(token),
  });
}

export function getAdminGallery(token) {
  return request("/admin/gallery", { headers: adminHeaders(token) });
}

export function addGalleryImage(token, imageUrl, caption = null) {
  return request("/admin/gallery", {
    method: "POST",
    body: JSON.stringify({ image_url: imageUrl, caption }),
    headers: adminHeaders(token),
  });
}

export function deleteGalleryImage(token, imageId) {
  return request(`/admin/gallery/${imageId}`, {
    method: "DELETE",
    headers: adminHeaders(token),
  });
}

// Super admin endpoints
function superHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export function superadminLogin(token) {
  return request("/superadmin/login", {
    method: "POST",
    body: JSON.stringify({ token }),
    headers: superHeaders(token),
  });
}

export function getSuperadminStats(token) {
  return request("/superadmin/stats", { headers: superHeaders(token) });
}

export function getSuperadminRestaurants(token) {
  return request("/superadmin/restaurants", { headers: superHeaders(token) });
}

export function getSuperadminRestaurant(token, id) {
  return request(`/superadmin/restaurants/${id}`, { headers: superHeaders(token) });
}

export function createRestaurant(token, data) {
  return request("/superadmin/restaurants", {
    method: "POST",
    body: JSON.stringify(data),
    headers: superHeaders(token),
  });
}

export function updateRestaurant(token, id, data) {
  return request(`/superadmin/restaurants/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
    headers: superHeaders(token),
  });
}

export function deleteRestaurant(token, id) {
  return request(`/superadmin/restaurants/${id}`, {
    method: "DELETE",
    headers: superHeaders(token),
  });
}

export function regenerateToken(token, id) {
  return request(`/superadmin/restaurants/${id}/regenerate-token`, {
    method: "POST",
    headers: superHeaders(token),
  });
}

export function getSuperadminMessages(token, options = {}) {
  const { ordersOnly = false, q = "", limit = 100 } = options;
  const params = new URLSearchParams();
  if (ordersOnly) params.set("orders_only", "true");
  if (q) params.set("q", q);
  if (limit) params.set("limit", String(limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/superadmin/messages${suffix}`, { headers: superHeaders(token) });
}

export function superPlacesSearch(token, { q, lat = null, lng = null, radius_m = null, limit = 12 } = {}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (lat != null) params.set("lat", String(lat));
  if (lng != null) params.set("lng", String(lng));
  if (radius_m != null) params.set("radius_m", String(radius_m));
  if (limit != null) params.set("limit", String(limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return request(`/superadmin/places/search${suffix}`, { headers: superHeaders(token) });
}

export function superPlacesImport(token, placeId) {
  return request("/superadmin/places/import", {
    method: "POST",
    body: JSON.stringify({ place_id: placeId }),
    headers: superHeaders(token),
  });
}

export function superPlacesPhoto(token, photoName, max = 800) {
  const params = new URLSearchParams();
  params.set("name", photoName || "");
  params.set("max", String(max));
  return request(`/superadmin/places/photo?${params.toString()}`, { headers: superHeaders(token) });
}

// Uploads (admin or superadmin token)
export function uploadImage(token, file, { kind = "menu", restaurantId = null } = {}) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);
  if (restaurantId != null) fd.append("restaurant_id", String(restaurantId));
  return upload("/uploads/image", fd, { Authorization: `Bearer ${token}` });
}
