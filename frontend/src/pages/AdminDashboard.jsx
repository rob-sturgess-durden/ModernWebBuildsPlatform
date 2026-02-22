import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAdminOrders,
  updateOrderStatus,
  getAdminMenu,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getAdminCategories,
  addCategory,
  uploadImage,
  getAdminRestaurant,
  updateAdminRestaurant,
  getAdminCustomers,
  sendCustomerMessage,
  getAdminStats,
  getAdminGallery,
  addGalleryImage,
  deleteGalleryImage,
  createTopupSession,
} from "../api/client";

const STATUS_TABS = ["all", "pending", "confirmed", "ready", "collected", "cancelled"];

const OPENING_HOURS_DAYS = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function _pad2(n) {
  const s = String(n ?? "");
  return s.length === 1 ? `0${s}` : s;
}

function _coerceTime(v) {
  // Accept "9", "09", "9:30", "09:30", "9.5" (-> 09:30), "09:30:00" (-> 09:30)
  if (v == null) return "";
  const raw = String(v).trim();
  if (!raw) return "";

  const m = raw.match(/^(\d{1,2})(?::(\d{1,2}))?(?::\d{1,2})?$/);
  if (m) {
    const hh = Math.max(0, Math.min(23, parseInt(m[1], 10)));
    const mm = m[2] != null ? Math.max(0, Math.min(59, parseInt(m[2], 10))) : 0;
    return `${_pad2(hh)}:${_pad2(mm)}`;
  }

  // "9.5" -> 09:30
  const f = Number(raw);
  if (Number.isFinite(f)) {
    const hh = Math.max(0, Math.min(23, Math.floor(f)));
    const mm = Math.max(0, Math.min(59, Math.round((f - Math.floor(f)) * 60)));
    return `${_pad2(hh)}:${_pad2(mm)}`;
  }

  return "";
}

function _parseRangeString(s) {
  // "09:00-17:00", "9-17", "9:30 - 17", "09:00–17:00"
  const raw = String(s || "").trim();
  if (!raw) return null;
  const parts = raw.split(/[-–—]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const open = _coerceTime(parts[0]);
  const close = _coerceTime(parts[1]);
  if (!open || !close) return null;
  return { open, close };
}

function normalizeOpeningHours(input) {
  const out = Object.fromEntries(OPENING_HOURS_DAYS.map((d) => [d.key, []]));
  if (!input || typeof input !== "object") return out;

  const alias = {
    monday: "mon",
    tuesday: "tue",
    wednesday: "wed",
    thursday: "thu",
    friday: "fri",
    saturday: "sat",
    sunday: "sun",
  };

  for (const [kRaw, v] of Object.entries(input)) {
    const k = alias[String(kRaw).toLowerCase().trim()] || String(kRaw).toLowerCase().trim();
    if (!Object.prototype.hasOwnProperty.call(out, k)) continue;

    const addInterval = (it) => {
      const open = _coerceTime(it?.open ?? it?.start ?? it?.from);
      const close = _coerceTime(it?.close ?? it?.end ?? it?.to);
      if (open && close) out[k].push({ open, close });
    };

    if (typeof v === "string") {
      const parsed = _parseRangeString(v);
      if (parsed) out[k].push(parsed);
      continue;
    }
    if (Array.isArray(v)) {
      v.forEach((it) => {
        if (typeof it === "string") {
          const parsed = _parseRangeString(it);
          if (parsed) out[k].push(parsed);
          return;
        }
        if (it && typeof it === "object") addInterval(it);
      });
      continue;
    }
    if (v && typeof v === "object") {
      // {open, close} or {0:{open,close},1:{...}}
      if ("open" in v || "close" in v || "start" in v || "end" in v || "from" in v || "to" in v) {
        addInterval(v);
      } else {
        Object.values(v).forEach((it) => it && typeof it === "object" && addInterval(it));
      }
    }
  }

  // Sort intervals within each day for nicer display.
  for (const d of OPENING_HOURS_DAYS) {
    out[d.key] = (out[d.key] || []).slice().sort((a, b) => String(a.open).localeCompare(String(b.open)));
  }
  return out;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("admin_token");
  const restaurantInfo = JSON.parse(localStorage.getItem("admin_restaurant") || "{}");

  const [tab, setTab] = useState("dashboard");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dashboard stats
  const [stats, setStats] = useState(null);

  // New item form
  const [newItem, setNewItem] = useState({ name: "", description: "", price: "", category_id: "", image_url: "" });
  const [newItemFile, setNewItemFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [newCat, setNewCat] = useState("");

  // Edit item form
  const [editingItemId, setEditingItemId] = useState(null);
  const [editItem, setEditItem] = useState({ name: "", description: "", price: "", category_id: "", image_url: "", is_available: true });
  const [editFile, setEditFile] = useState(null);
  const [editUploading, setEditUploading] = useState(false);

  // Customers tab
  const [customers, setCustomers] = useState([]);

  // Settings tab
  const [settings, setSettings] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [openingHoursAdvanced, setOpeningHoursAdvanced] = useState(false);

  // Gallery
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryFile, setGalleryFile] = useState(null);
  const [galleryCaption, setGalleryCaption] = useState("");
  const [galleryUploading, setGalleryUploading] = useState(false);

  // Topup success message
  const [topupMsg, setTopupMsg] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("topup") === "success") {
      setTopupMsg("Payment received! Your credits have been topped up.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("topup") === "cancel") {
      setTopupMsg(null);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!token) {
      navigate("/admin");
      return;
    }
    if (!settings) loadSettings();
    if (tab === "dashboard") loadStats();
    if (tab === "orders") loadOrders();
  }, [statusFilter, tab]);

  const loadStats = useCallback(async () => {
    try {
      const data = await getAdminStats(token);
      setStats(data);
    } catch (e) {
      setError(e.message);
    }
  }, [token]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const filter = statusFilter === "all" ? null : statusFilter;
      const data = await getAdminOrders(token, filter);
      setOrders(data);
    } catch (e) {
      if (e.message.includes("401") || e.message.includes("Invalid")) {
        localStorage.removeItem("admin_token");
        navigate("/admin");
        return;
      }
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  const loadMenu = useCallback(async () => {
    setLoading(true);
    try {
      const [items, cats] = await Promise.all([
        getAdminMenu(token),
        getAdminCategories(token),
      ]);
      setMenuItems(items);
      setCategories(cats);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (tab === "menu") loadMenu();
  }, [tab]);

  const loadSettings = useCallback(async () => {
    try {
      const data = await getAdminRestaurant(token);
      // Normalize to a consistent structure so we can render a friendly editor.
      if (data && typeof data.opening_hours === "object" && data.opening_hours) {
        data.opening_hours = normalizeOpeningHours(data.opening_hours);
      } else {
        data.opening_hours = normalizeOpeningHours(null);
      }
      setSettings(data);
    } catch (e) {
      setError(e.message);
    }
  }, [token]);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminCustomers(token);
      setCustomers(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadGallery = useCallback(async () => {
    try {
      const data = await getAdminGallery(token);
      setGalleryImages(data);
    } catch (e) {
      setError(e.message);
    }
  }, [token]);

  useEffect(() => {
    if (tab === "customers") loadCustomers();
  }, [tab]);

  useEffect(() => {
    if (tab === "settings") {
      loadSettings();
      loadGallery();
    }
  }, [tab, loadSettings, loadGallery]);

  // Auto-refresh orders every 30s
  useEffect(() => {
    if (tab !== "orders") return;
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [tab, loadOrders]);

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(token, orderId, newStatus);
      loadOrders();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.name || !newItem.price) return;
    try {
      await addMenuItem(token, {
        name: newItem.name,
        description: newItem.description,
        price: parseFloat(newItem.price),
        category_id: newItem.category_id ? parseInt(newItem.category_id) : null,
        image_url: newItem.image_url || null,
      });
      setNewItem({ name: "", description: "", price: "", category_id: "", image_url: "" });
      setNewItemFile(null);
      loadMenu();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleUploadNewItemImage = async () => {
    if (!newItemFile) return;
    setUploading(true);
    try {
      const result = await uploadImage(token, newItemFile, { kind: "menu" });
      setNewItem((prev) => ({ ...prev, image_url: result.url }));
    } catch (e) {
      alert(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleToggleAvailability = async (item) => {
    try {
      await updateMenuItem(token, item.id, { is_available: !item.is_available });
      loadMenu();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!confirm("Delete this menu item?")) return;
    try {
      await deleteMenuItem(token, itemId);
      loadMenu();
    } catch (e) {
      alert(e.message);
    }
  };

  const startEdit = (item) => {
    setEditingItemId(item.id);
    setEditFile(null);
    setEditItem({
      name: item.name || "",
      description: item.description || "",
      price: String(item.price ?? ""),
      category_id: item.category_id ? String(item.category_id) : "",
      image_url: item.image_url || "",
      is_available: !!item.is_available,
    });
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setEditFile(null);
    setEditItem({ name: "", description: "", price: "", category_id: "", image_url: "", is_available: true });
  };

  const handleUploadEditImage = async () => {
    if (!editFile) return;
    setEditUploading(true);
    try {
      const result = await uploadImage(token, editFile, { kind: "menu" });
      setEditItem((prev) => ({ ...prev, image_url: result.url }));
      setEditFile(null);
    } catch (e) {
      alert(e.message);
    } finally {
      setEditUploading(false);
    }
  };

  const saveEdit = async (itemId) => {
    if (!editItem.name || !editItem.price) {
      alert("Name and price are required");
      return;
    }
    try {
      await updateMenuItem(token, itemId, {
        name: editItem.name,
        description: editItem.description || null,
        price: parseFloat(editItem.price),
        category_id: editItem.category_id ? parseInt(editItem.category_id) : null,
        image_url: editItem.image_url || null,
        is_available: !!editItem.is_available,
      });
      cancelEdit();
      loadMenu();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    try {
      await addCategory(token, { name: newCat.trim(), display_order: categories.length });
      setNewCat("");
      loadMenu();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_restaurant");
    navigate("/admin");
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!settings) return;
    setSettingsSaving(true);
    try {
      await updateAdminRestaurant(token, {
        name: settings.name,
        address: settings.address,
        cuisine_type: settings.cuisine_type,
        about_text: settings.about_text || null,
        banner_text: settings.banner_text || null,
        preview_password: settings.preview_password || "",
        phone: settings.phone || null,
        whatsapp_number: settings.whatsapp_number || null,
        owner_email: settings.owner_email || null,
        opening_hours: settings.opening_hours || null,
      });
      const updated = await getAdminRestaurant(token);
      setSettings(updated);
      if (restaurantInfo?.name !== updated.name) {
        localStorage.setItem("admin_restaurant", JSON.stringify({ ...restaurantInfo, name: updated.name, slug: updated.slug }));
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleAddGalleryImage = async () => {
    if (!galleryFile) return;
    setGalleryUploading(true);
    try {
      const result = await uploadImage(token, galleryFile, { kind: "gallery" });
      await addGalleryImage(token, result.url, galleryCaption || null);
      setGalleryFile(null);
      setGalleryCaption("");
      loadGallery();
    } catch (e) {
      alert(e.message);
    } finally {
      setGalleryUploading(false);
    }
  };

  const handleDeleteGalleryImage = async (imageId) => {
    if (!confirm("Remove this gallery image?")) return;
    try {
      await deleteGalleryImage(token, imageId);
      loadGallery();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="container section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 700 }}>{restaurantInfo.name || "Dashboard"}</h1>
            {settings && (
              <span
                className={`badge ${(settings.status || "live") === "live" ? "status-confirmed" : "status-pending"}`}
                style={{ fontSize: "0.75rem" }}
              >
                {(settings.status || "live") === "live" ? "Live" : "Pending"}
              </span>
            )}
          </div>
          <p style={{ color: "var(--text-light)" }}>Restaurant Admin Dashboard</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleLogout}>Logout</button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <button
          className={`btn ${tab === "dashboard" ? "btn-primary" : "btn-outline"} btn-sm`}
          onClick={() => setTab("dashboard")}
        >
          Dashboard
        </button>
        <button
          className={`btn ${tab === "orders" ? "btn-primary" : "btn-outline"} btn-sm`}
          onClick={() => setTab("orders")}
        >
          Orders
        </button>
        <button
          className={`btn ${tab === "menu" ? "btn-primary" : "btn-outline"} btn-sm`}
          onClick={() => setTab("menu")}
        >
          Menu
        </button>
        <button
          className={`btn ${tab === "customers" ? "btn-primary" : "btn-outline"} btn-sm`}
          onClick={() => setTab("customers")}
        >
          Customers
        </button>
        <button
          className={`btn ${tab === "settings" ? "btn-primary" : "btn-outline"} btn-sm`}
          onClick={() => setTab("settings")}
        >
          Settings
        </button>
      </div>

      {error && <div className="error">{error}</div>}
      {topupMsg && (
        <div style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: 12,
          padding: "1rem 1.5rem",
          marginBottom: "1rem",
          color: "#166534",
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span><i className="fas fa-check-circle" style={{ marginRight: 8 }} />{topupMsg}</span>
          <button onClick={() => setTopupMsg(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#166534", fontSize: "1.1rem" }}>&times;</button>
        </div>
      )}

      {/* Dashboard tab */}
      {tab === "dashboard" && (
        <div>
          {!stats ? (
            <div className="loading">Loading stats...</div>
          ) : (
            <>
              {stats.credits != null && stats.credits <= 0 && (
                <div style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 12,
                  padding: "1rem 1.5rem",
                  marginBottom: "1.5rem",
                  color: "#991b1b",
                  fontWeight: 600,
                  textAlign: "center",
                }}>
                  <i className="fas fa-exclamation-triangle" style={{ marginRight: 8 }} />
                  Your credit balance is zero. Online ordering is paused until credits are topped up.
                </div>
              )}
              <div className="stats-grid">
                <div className="stat-card">
                  <p className="stat-label">Today</p>
                  <p className="stat-value">{stats.today_orders}</p>
                  <p className="stat-sub">orders</p>
                </div>
                <div className="stat-card">
                  <p className="stat-label">Today revenue</p>
                  <p className="stat-value">&pound;{stats.today_revenue.toFixed(2)}</p>
                  <p className="stat-sub">&nbsp;</p>
                </div>
                <div className="stat-card stat-card--highlight">
                  <p className="stat-label">Pending</p>
                  <p className="stat-value">{stats.pending_orders}</p>
                  <p className="stat-sub">
                    {stats.pending_orders > 0 ? (
                      <button className="btn btn-sm btn-secondary" onClick={() => { setStatusFilter("pending"); setTab("orders"); }}>
                        View
                      </button>
                    ) : "all clear"}
                  </p>
                </div>
                <div className="stat-card" style={stats.credits != null && stats.credits <= 0 ? { borderColor: "#fecaca", background: "#fef2f2" } : {}}>
                  <p className="stat-label">Credits</p>
                  <p className="stat-value" style={stats.credits != null && stats.credits <= 0 ? { color: "#dc2626" } : { color: "#16a34a" }}>
                    &pound;{(stats.credits ?? 0).toFixed(2)}
                  </p>
                  <p className="stat-sub">
                    <button
                      className="btn btn-sm"
                      style={{ background: "#6366f1", color: "#fff", fontWeight: 600, padding: "0.25rem 0.75rem", borderRadius: 6, border: "none", cursor: "pointer", fontSize: "0.8rem" }}
                      onClick={async () => {
                        try {
                          const res = await createTopupSession(token);
                          if (res.url) window.location.href = res.url;
                        } catch (e) {
                          alert(e.message || "Failed to create top-up session");
                        }
                      }}
                    >
                      <i className="fas fa-plus" style={{ marginRight: 4 }} />
                      Top Up &pound;10
                    </button>
                  </p>
                </div>
                <div className="stat-card">
                  <p className="stat-label">Customers</p>
                  <p className="stat-value">{stats.customer_count}</p>
                  <p className="stat-sub">total</p>
                </div>
              </div>

              <h3 style={{ fontWeight: 600, margin: "2rem 0 1rem" }}>Revenue & commission</h3>
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th style={{ textAlign: "right" }}>Orders</th>
                      <th style={{ textAlign: "right" }}>Revenue</th>
                      <th style={{ textAlign: "right" }}>Commission (10%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600 }}>This week</td>
                      <td style={{ textAlign: "right" }}>{stats.week_orders}</td>
                      <td style={{ textAlign: "right" }}>&pound;{stats.week_revenue.toFixed(2)}</td>
                      <td style={{ textAlign: "right" }}>&pound;{stats.week_commission.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>All time</td>
                      <td style={{ textAlign: "right" }}>{stats.total_orders}</td>
                      <td style={{ textAlign: "right" }}>&pound;{stats.total_revenue.toFixed(2)}</td>
                      <td style={{ textAlign: "right" }}>&pound;{stats.total_commission.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Orders tab */}
      {tab === "orders" && (
        <div>
          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            {STATUS_TABS.map((s) => {
              const tabConf = {
                all: { icon: "fas fa-list", color: "#475569", bg: "#f1f5f9" },
                pending: { icon: "fas fa-clock", color: "#92400e", bg: "#fef3c7" },
                confirmed: { icon: "fas fa-check-circle", color: "#1e40af", bg: "#dbeafe" },
                ready: { icon: "fas fa-concierge-bell", color: "#166534", bg: "#dcfce7" },
                collected: { icon: "fas fa-shopping-bag", color: "#7c3aed", bg: "#ede9fe" },
                cancelled: { icon: "fas fa-ban", color: "#991b1b", bg: "#fee2e2" },
              }[s] || { icon: "fas fa-circle", color: "#666", bg: "#eee" };
              const active = statusFilter === s;
              return (
                <button
                  key={s}
                  className="btn btn-sm"
                  style={{
                    background: active ? tabConf.color : tabConf.bg,
                    color: active ? "#fff" : tabConf.color,
                    border: `1.5px solid ${tabConf.color}`,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    borderRadius: 20,
                    padding: "0.4rem 0.8rem",
                    fontSize: "0.8rem",
                  }}
                  onClick={() => setStatusFilter(s)}
                >
                  <i className={tabConf.icon} style={{ fontSize: "0.7rem" }} />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="loading">Loading orders...</div>
          ) : orders.length === 0 ? (
            <p style={{ color: "var(--text-light)", textAlign: "center", padding: "2rem" }}>
              No {statusFilter === "all" ? "" : statusFilter} orders.
            </p>
          ) : (
            <div className="grid grid-2">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings tab */}
      {tab === "settings" && (
        <div className="card" style={{ maxWidth: "36rem" }}>
          <h3 style={{ marginBottom: "1rem", fontWeight: 600 }}>Restaurant details</h3>
          {settings == null ? (
            <div className="loading">Loading...</div>
          ) : (
            <form onSubmit={handleSaveSettings}>
              <div className="form-group">
                <label>Restaurant name</label>
                <input
                  value={settings.name || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Address</label>
                <input
                  value={settings.address || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, address: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Cuisine type</label>
                <input
                  value={settings.cuisine_type || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, cuisine_type: e.target.value }))}
                  placeholder="e.g. Caribbean, Cafe"
                />
              </div>
              <div className="form-group">
                <label>Banner text</label>
                <input
                  value={settings.banner_text || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, banner_text: e.target.value }))}
                  placeholder="e.g. London's Viral Brunch Spot"
                />
                <p style={{ fontSize: "0.8rem", color: "var(--text-light)", marginTop: 4 }}>
                  Shown on the restaurant banner. Leave blank to use cuisine type.
                </p>
              </div>
              <div className="form-group">
                <label>Preview password</label>
                <input
                  value={settings.preview_password || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, preview_password: e.target.value }))}
                  placeholder="Set a password for testing access"
                />
                <p style={{ fontSize: "0.8rem", color: "var(--text-light)", marginTop: 4 }}>
                  {(settings.status || "live") === "pending"
                    ? "Your site is in Pending mode. Share this password with testers so they can preview your page."
                    : "Your site is Live. Password is only needed when status is set to Pending."}
                </p>
              </div>
              <div className="form-group">
                <label>About (optional)</label>
                <textarea
                  value={settings.about_text || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, about_text: e.target.value }))}
                  rows={3}
                  placeholder="Short description for your page"
                />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input
                  type="tel"
                  value={settings.phone || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, phone: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>WhatsApp number</label>
                <input
                  type="tel"
                  value={settings.whatsapp_number || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, whatsapp_number: e.target.value }))}
                  placeholder="Same as phone or leave blank"
                />
              </div>
              <div className="form-group">
                <label>Owner email</label>
                <input
                  type="email"
                  value={settings.owner_email || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, owner_email: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Opening hours</label>
                <div className="card" style={{ padding: "14px 16px" }}>
                  <p style={{ margin: "0 0 12px", color: "var(--text-light)", fontSize: "0.9rem" }}>
                    Set when you are open for pickup. Leave a day empty to mark it as closed.
                  </p>

                  <div style={{ display: "grid", gap: 10 }}>
                    {OPENING_HOURS_DAYS.map((d) => {
                      const dayIntervals = (settings.opening_hours && settings.opening_hours[d.key]) || [];
                      const isClosed = !dayIntervals || dayIntervals.length === 0;
                      return (
                        <div key={d.key} style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10, alignItems: "start" }}>
                          <div style={{ paddingTop: 8, fontWeight: 700 }}>{d.label}</div>
                          <div style={{ display: "grid", gap: 8 }}>
                            {isClosed ? (
                              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                <span className="badge" style={{ background: "rgba(148,163,184,0.25)", color: "var(--ink)" }}>
                                  Closed
                                </span>
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => {
                                    setSettings((s) => {
                                      const next = normalizeOpeningHours(s.opening_hours);
                                      next[d.key] = [{ open: "09:00", close: "17:00" }];
                                      return { ...s, opening_hours: next };
                                    });
                                  }}
                                >
                                  + Add hours
                                </button>
                              </div>
                            ) : (
                              <>
                                {dayIntervals.map((it, idx) => (
                                  <div key={`${d.key}-${idx}`} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                    <input
                                      type="time"
                                      value={it.open || ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setSettings((s) => {
                                          const next = normalizeOpeningHours(s.opening_hours);
                                          const list = (next[d.key] || []).slice();
                                          list[idx] = { ...(list[idx] || {}), open: val };
                                          next[d.key] = list;
                                          return { ...s, opening_hours: next };
                                        });
                                      }}
                                      style={{ width: 140 }}
                                    />
                                    <span style={{ color: "var(--text-light)" }}>to</span>
                                    <input
                                      type="time"
                                      value={it.close || ""}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setSettings((s) => {
                                          const next = normalizeOpeningHours(s.opening_hours);
                                          const list = (next[d.key] || []).slice();
                                          list[idx] = { ...(list[idx] || {}), close: val };
                                          next[d.key] = list;
                                          return { ...s, opening_hours: next };
                                        });
                                      }}
                                      style={{ width: 140 }}
                                    />
                                    <button
                                      type="button"
                                      className="btn btn-outline btn-sm"
                                      onClick={() => {
                                        setSettings((s) => {
                                          const next = normalizeOpeningHours(s.opening_hours);
                                          next[d.key] = (next[d.key] || []).filter((_, i) => i !== idx);
                                          return { ...s, opening_hours: next };
                                        });
                                      }}
                                      title="Remove"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ))}

                                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={() => {
                                      setSettings((s) => {
                                        const next = normalizeOpeningHours(s.opening_hours);
                                        next[d.key] = [...(next[d.key] || []), { open: "09:00", close: "17:00" }];
                                        return { ...s, opening_hours: next };
                                      });
                                    }}
                                  >
                                    + Add interval
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline btn-sm"
                                    onClick={() => {
                                      setSettings((s) => {
                                        const next = normalizeOpeningHours(s.opening_hours);
                                        next[d.key] = [];
                                        return { ...s, opening_hours: next };
                                      });
                                    }}
                                  >
                                    Mark closed
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        setSettings((s) => ({ ...s, opening_hours: normalizeOpeningHours(null) }));
                      }}
                    >
                      Clear all
                    </button>
                    <label style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, color: "var(--text-light)" }}>
                      <input
                        type="checkbox"
                        checked={openingHoursAdvanced}
                        onChange={(e) => setOpeningHoursAdvanced(e.target.checked)}
                        style={{ width: "auto" }}
                      />
                      Advanced (JSON)
                    </label>
                  </div>

                  {openingHoursAdvanced && (
                    <div style={{ marginTop: 10 }}>
                      <textarea
                        value={JSON.stringify(settings.opening_hours || {}, null, 2)}
                        onChange={(e) => {
                          const v = e.target.value.trim();
                          if (!v) {
                            setSettings((s) => ({ ...s, opening_hours: normalizeOpeningHours(null) }));
                            return;
                          }
                          try {
                            const parsed = JSON.parse(v);
                            setSettings((s) => ({ ...s, opening_hours: normalizeOpeningHours(parsed) }));
                          } catch {
                            // ignore invalid JSON
                          }
                        }}
                        rows={6}
                        style={{ fontFamily: "monospace", fontSize: "0.85rem" }}
                      />
                    </div>
                  )}
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={settingsSaving}>
                {settingsSaving ? "Saving…" : "Save details"}
              </button>
            </form>
          )}

          {/* Gallery section */}
          <h3 style={{ fontWeight: 600, margin: "2rem 0 1rem" }}>Image gallery</h3>
          <p style={{ fontSize: "0.85rem", color: "var(--text-light)", marginBottom: "1rem" }}>
            Upload photos to show on your restaurant page when Instagram is not connected.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setGalleryFile(e.target.files?.[0] || null)}
              style={{ flex: 1, minWidth: 180 }}
            />
            <input
              value={galleryCaption}
              onChange={(e) => setGalleryCaption(e.target.value)}
              placeholder="Caption (optional)"
              style={{ flex: 1, minWidth: 140 }}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleAddGalleryImage}
              disabled={!galleryFile || galleryUploading}
            >
              {galleryUploading ? "Uploading..." : "Add photo"}
            </button>
          </div>
          {galleryImages.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.8rem" }}>
              {galleryImages.map((img) => (
                <div key={img.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden" }}>
                  <img
                    src={img.image_url}
                    alt={img.caption || "Gallery"}
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                  />
                  <button
                    onClick={() => handleDeleteGalleryImage(img.id)}
                    style={{
                      position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", color: "#fff",
                      border: "none", borderRadius: "50%", width: 24, height: 24, cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
                    }}
                    title="Remove"
                  >
                    &times;
                  </button>
                  {img.caption && (
                    <p style={{ margin: 0, padding: "4px 6px", fontSize: "0.75rem", color: "var(--text-light)" }}>
                      {img.caption}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Promotional Flyer */}
          <div style={{ marginTop: "2rem", padding: "1.5rem", background: "var(--bg)", borderRadius: 12, border: "1px solid var(--border, #eee)" }}>
            <h3 style={{ marginBottom: "0.5rem", fontWeight: 600 }}>Promotional flyer</h3>
            <p style={{ color: "var(--text-light)", fontSize: "0.9rem", marginBottom: "1rem" }}>
              Download an A5 flyer with your restaurant details, QR code, and ForkItt branding. Print and display for customers.
            </p>
            <button
              className="btn btn-burnt btn-pill"
              onClick={() => {
                const token = localStorage.getItem("admin_token");
                fetch(`/api/admin/flyer`, { headers: { Authorization: `Bearer ${token}` } })
                  .then((res) => {
                    if (!res.ok) throw new Error("Failed to generate flyer");
                    return res.blob();
                  })
                  .then((blob) => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `ForkItt-Flyer-${restaurantInfo?.slug || "flyer"}.png`;
                    a.click();
                    URL.revokeObjectURL(url);
                  })
                  .catch(() => alert("Failed to generate flyer"));
              }}
            >
              Download Flyer
            </button>
          </div>
        </div>
      )}

      {/* Customers tab */}
      {tab === "customers" && (
        <CustomerPanel customers={customers} loading={loading} token={localStorage.getItem("admin_token")} restaurantName={restaurantInfo?.name || ""} />
      )}

      {/* Menu tab */}
      {tab === "menu" && (
        <div>
          {/* Add category */}
          <form onSubmit={handleAddCategory} style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
            <input
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              placeholder="New category name"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-secondary btn-sm">Add Category</button>
          </form>

          {/* Add item */}
          <form onSubmit={handleAddItem} className="card" style={{ marginBottom: "2rem" }}>
            <h3 style={{ marginBottom: "1rem", fontWeight: 600 }}>Add Menu Item</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
              <div className="form-group">
                <label>Name *</label>
                <input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Price (£) *</label>
                <input type="number" step="0.01" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <input value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={newItem.category_id} onChange={(e) => setNewItem({ ...newItem, category_id: e.target.value })}>
                  <option value="">No category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Image URL</label>
                <input value={newItem.image_url} onChange={(e) => setNewItem({ ...newItem, image_url: e.target.value })} placeholder="https://..." />
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setNewItemFile(e.target.files?.[0] || null)}
                    style={{ flex: 1, minWidth: 220 }}
                  />
                  <button type="button" className="btn btn-outline btn-sm" onClick={handleUploadNewItemImage} disabled={!newItemFile || uploading}>
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm">Add Item</button>
          </form>

          {/* Item list */}
          {loading ? (
            <div className="loading">Loading menu...</div>
          ) : (
            <div className="grid grid-2">
              {menuItems.map((item) => (
                <div key={item.id} className="card" style={{ opacity: item.is_available ? 1 : 0.5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h4 style={{ fontWeight: 600 }}>{item.name}</h4>
                      {item.image_url && (
                        <img
                          className="menu-item-thumb"
                          src={item.image_url}
                          alt={item.name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          style={{ marginTop: 8 }}
                        />
                      )}
                      {item.description && <p style={{ color: "var(--text-light)", fontSize: "0.85rem" }}>{item.description}</p>}
                      <p style={{ fontWeight: 700, marginTop: "0.3rem" }}>£{item.price.toFixed(2)}</p>
                    </div>
                    <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                      <button className="btn btn-outline btn-sm" onClick={() => startEdit(item)}>
                        Edit Item
                      </button>
                      <button
                        className={`btn btn-sm ${item.is_available ? "btn-warning" : "btn-success"}`}
                        onClick={() => handleToggleAvailability(item)}
                      >
                        {item.is_available ? "Hide" : "Show"}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteItem(item.id)}>
                        Del
                      </button>
                    </div>
                  </div>

                  {editingItemId === item.id && (
                    <div style={{ marginTop: 14, borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 14 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
                        <div className="form-group">
                          <label>Name *</label>
                          <input value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Price (£) *</label>
                          <input type="number" step="0.01" value={editItem.price} onChange={(e) => setEditItem({ ...editItem, price: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                          <label>Description</label>
                          <input value={editItem.description} onChange={(e) => setEditItem({ ...editItem, description: e.target.value })} />
                        </div>
                        <div className="form-group">
                          <label>Category</label>
                          <select value={editItem.category_id} onChange={(e) => setEditItem({ ...editItem, category_id: e.target.value })}>
                            <option value="">No category</option>
                            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingTop: "1.5rem" }}>
                          <input
                            type="checkbox"
                            checked={editItem.is_available}
                            onChange={(e) => setEditItem({ ...editItem, is_available: e.target.checked })}
                            style={{ width: "auto" }}
                            id={`avail_${item.id}`}
                          />
                          <label htmlFor={`avail_${item.id}`} style={{ margin: 0 }}>Available</label>
                        </div>
                        <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                          <label>Image URL</label>
                          <input value={editItem.image_url} onChange={(e) => setEditItem({ ...editItem, image_url: e.target.value })} placeholder="https://..." />
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                              style={{ flex: 1, minWidth: 220 }}
                            />
                            <button type="button" className="btn btn-outline btn-sm" onClick={handleUploadEditImage} disabled={!editFile || editUploading}>
                              {editUploading ? "Uploading..." : "Upload"}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.5rem", marginTop: 10 }}>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => saveEdit(item.id)}>
                          Save
                        </button>
                        <button type="button" className="btn btn-outline btn-sm" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, onStatusChange }) {
  const pickupTime = order.pickup_time
    ? new Date(order.pickup_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "";

  const actions = {
    pending: [
      { label: "Confirm", status: "confirmed", icon: "fas fa-check", bg: "#2563eb", color: "#fff" },
      { label: "Cancel", status: "cancelled", icon: "fas fa-times", bg: "#dc2626", color: "#fff" },
    ],
    confirmed: [
      { label: "Mark Ready", status: "ready", icon: "fas fa-concierge-bell", bg: "#16a34a", color: "#fff" },
      { label: "Cancel", status: "cancelled", icon: "fas fa-times", bg: "#dc2626", color: "#fff" },
    ],
    ready: [
      { label: "Collected", status: "collected", icon: "fas fa-shopping-bag", bg: "#7c3aed", color: "#fff" },
    ],
  };

  const statusConfig = {
    pending: { icon: "fas fa-clock", color: "#92400e", bg: "#fef3c7", text: "Pending" },
    confirmed: { icon: "fas fa-check-circle", color: "#1e40af", bg: "#dbeafe", text: "Confirmed" },
    ready: { icon: "fas fa-concierge-bell", color: "#166534", bg: "#dcfce7", text: "Ready" },
    collected: { icon: "fas fa-shopping-bag", color: "#7c3aed", bg: "#ede9fe", text: "Collected" },
    cancelled: { icon: "fas fa-ban", color: "#991b1b", bg: "#fee2e2", text: "Cancelled" },
  };

  const sc = statusConfig[order.status] || statusConfig.pending;

  return (
    <div className="card" style={{ borderLeft: `4px solid ${sc.color}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
        <h4 style={{ fontWeight: 700 }}>{order.order_number}</h4>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "0.3rem 0.7rem", borderRadius: 20,
          background: sc.bg, color: sc.color,
          fontSize: "0.8rem", fontWeight: 600,
        }}>
          <i className={sc.icon} style={{ fontSize: "0.75rem" }} />
          {sc.text}
        </span>
      </div>

      <div style={{ marginBottom: "0.8rem" }}>
        <p><strong>{order.customer_name}</strong> - {order.customer_phone}</p>
        {pickupTime && <p style={{ color: "var(--text-light)", fontSize: "0.9rem" }}>Pickup: {pickupTime}</p>}
      </div>

      <div style={{ borderTop: "1px solid #eee", paddingTop: "0.5rem", marginBottom: "0.8rem" }}>
        {order.items.map((item) => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", padding: "0.2rem 0" }}>
            <span>{item.quantity}x {item.item_name}</span>
            <span>£{(item.unit_price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, marginTop: "0.5rem" }}>
          <span>Total</span>
          <span>£{order.subtotal.toFixed(2)}</span>
        </div>
      </div>

      {order.special_instructions && (
        <p style={{ fontSize: "0.85rem", color: "var(--text-light)", fontStyle: "italic", marginBottom: "0.8rem" }}>
          Note: {order.special_instructions}
        </p>
      )}

      {actions[order.status] && (
        <div style={{ display: "flex", gap: "0.5rem" }}>
          {actions[order.status].map((a) => (
            <button
              key={a.status}
              className="btn btn-sm"
              style={{
                background: a.bg,
                color: a.color,
                border: "none",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.5rem 1rem",
                borderRadius: 8,
                flex: 1,
                justifyContent: "center",
              }}
              onClick={() => onStatusChange(order.id, a.status)}
            >
              <i className={a.icon} style={{ fontSize: "0.8rem" }} />
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


function CustomerPanel({ customers, loading, token, restaurantName }) {
  const [selected, setSelected] = useState(new Set());
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [showCompose, setShowCompose] = useState(false);

  const optedIn = customers.filter((c) => c.marketing_optin);
  const selectAll = () => setSelected(new Set(optedIn.map((c) => customers.indexOf(c))));
  const selectNone = () => setSelected(new Set());

  const toggleSelect = (i) => {
    const s = new Set(selected);
    s.has(i) ? s.delete(i) : s.add(i);
    setSelected(s);
  };

  const getChannels = (c) => {
    const ch = [];
    if (c.whatsapp_optin && c.customer_phone) ch.push("whatsapp");
    if (c.sms_optin && c.customer_phone) ch.push("sms");
    if (c.customer_email) ch.push("email");
    return ch;
  };

  // Estimate credit cost for the current selection
  const estimatedCost = [...selected].reduce((total, i) => {
    const ch = getChannels(customers[i]);
    let cost = 0;
    if (ch.includes("whatsapp")) cost += 0.1;
    if (ch.includes("sms")) cost += 0.1;
    if (ch.includes("email")) cost += 0.01;
    return total + cost;
  }, 0);

  const templates = [
    { label: "Weekend special", text: `Hi! This weekend at ${restaurantName} we have a special offer just for you. Order online and enjoy 10% off your next Click & Collect order! Visit us now.` },
    { label: "New menu items", text: `Great news from ${restaurantName}! We've added exciting new dishes to our menu. Be one of the first to try them — order online for Click & Collect today!` },
    { label: "Thank you + reorder", text: `Thanks for being a loyal customer of ${restaurantName}! We'd love to see you again. Place your next Click & Collect order online — quick, easy, and ready when you arrive.` },
    { label: "Holiday/Event", text: `${restaurantName} is ready for the weekend! Treat yourself to a delicious meal — order ahead for Click & Collect and skip the wait.` },
  ];

  const handleSend = async () => {
    if (!message.trim() || selected.size === 0) return;
    setSending(true);
    setSendResult(null);
    try {
      const recipients = [...selected].map((i) => {
        const c = customers[i];
        return { phone: c.customer_phone, email: c.customer_email, channels: getChannels(c) };
      });
      const res = await sendCustomerMessage(token, message, recipients);
      setSendResult(`Message sent to ${res.sent} channel${res.sent !== 1 ? "s" : ""}`);
      setMessage("");
      setSelected(new Set());
      setShowCompose(false);
    } catch (e) {
      setSendResult(`Error: ${e.message}`);
    }
    setSending(false);
  };

  if (loading) return <div className="loading">Loading customers...</div>;
  if (customers.length === 0)
    return (
      <p style={{ color: "var(--text-light)", textAlign: "center", padding: "2rem" }}>
        No customers yet. Customers appear here once they place an order.
      </p>
    );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <p style={{ color: "var(--text-light)", margin: 0 }}>
          {customers.length} customer{customers.length !== 1 ? "s" : ""} &middot; {optedIn.length} opted in
        </p>
        {!showCompose && optedIn.length > 0 && (
          <button className="btn btn-sm btn-burnt btn-pill" onClick={() => { setShowCompose(true); selectAll(); }}>
            <i className="fas fa-paper-plane" style={{ marginRight: 4 }} /> Message opted-in
          </button>
        )}
      </div>

      {showCompose && (
        <div className="card" style={{ marginBottom: "1.5rem", border: "2px solid var(--accent)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
            <h4 style={{ fontWeight: 700, margin: 0 }}>
              <i className="fas fa-bullhorn" style={{ color: "var(--accent)", marginRight: 6 }} />
              Send message to {selected.size} customer{selected.size !== 1 ? "s" : ""}
            </h4>
            <button className="btn btn-sm btn-secondary" onClick={() => { setShowCompose(false); selectNone(); }}>Cancel</button>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-light)", marginBottom: "0.8rem" }}>
            Each customer will be contacted via their available channels (WhatsApp, SMS, or email).
          </p>
          <div style={{ marginBottom: "0.8rem" }}>
            <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-light)", marginBottom: 6 }}>Quick templates:</p>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
              {templates.map((t, idx) => (
                <button
                  key={idx}
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem", borderRadius: 6 }}
                  onClick={() => setMessage(t.text)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            rows={3}
            style={{ width: "100%", borderRadius: 8, border: "1px solid #ddd", padding: "0.7rem", fontSize: "0.95rem", marginBottom: "0.8rem", boxSizing: "border-box", resize: "vertical" }}
          />
          {selected.size > 0 && estimatedCost > 0 && (
            <p style={{ fontSize: "0.85rem", color: "#6366f1", fontWeight: 600, marginBottom: "0.6rem" }}>
              <i className="fas fa-coins" style={{ marginRight: 4 }} />
              Estimated cost: {estimatedCost.toFixed(2)} credits ({[...selected].reduce((a, i) => {
                const ch = getChannels(customers[i]);
                return a + ch.filter(c => c === "whatsapp" || c === "sms").length;
              }, 0)} SMS/WhatsApp at 0.1 each, {[...selected].reduce((a, i) => {
                const ch = getChannels(customers[i]);
                return a + ch.filter(c => c === "email").length;
              }, 0)} emails at 0.01 each)
            </p>
          )}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              className="btn btn-sm btn-burnt btn-pill"
              onClick={handleSend}
              disabled={sending || !message.trim() || selected.size === 0}
              style={{ fontWeight: 600 }}
            >
              {sending ? "Sending..." : `Send to ${selected.size} customer${selected.size !== 1 ? "s" : ""}`}
            </button>
            <button className="btn btn-sm btn-secondary" onClick={selectAll}>Select all opted-in</button>
            <button className="btn btn-sm btn-secondary" onClick={selectNone}>Clear selection</button>
          </div>
          {sendResult && (
            <p style={{ marginTop: "0.8rem", fontWeight: 600, color: sendResult.startsWith("Error") ? "#dc2626" : "#16a34a" }}>
              {sendResult}
            </p>
          )}
        </div>
      )}

      <div style={{ overflowX: "auto" }}>
        <table className="admin-table">
          <thead>
            <tr>
              {showCompose && <th style={{ width: 36 }}></th>}
              <th>Name</th>
              <th>Mobile</th>
              <th>Email</th>
              <th style={{ textAlign: "center" }}>Opted in</th>
              <th style={{ textAlign: "center" }}>Channels</th>
              <th>Orders</th>
              <th>Last order</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c, i) => {
              const channels = getChannels(c);
              return (
                <tr key={i} style={selected.has(i) ? { background: "#fef3c7" } : {}}>
                  {showCompose && (
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(i)}
                        onChange={() => toggleSelect(i)}
                        disabled={!c.marketing_optin}
                        style={{ width: "auto", margin: 0, cursor: c.marketing_optin ? "pointer" : "default" }}
                      />
                    </td>
                  )}
                  <td style={{ fontWeight: 600 }}>{c.customer_name}</td>
                  <td style={{ color: "var(--text-light)", fontSize: "0.85rem", whiteSpace: "nowrap" }}>{c.customer_phone || "—"}</td>
                  <td style={{ color: "var(--text-light)", fontSize: "0.85rem" }}>{c.customer_email || "—"}</td>
                  <td style={{ textAlign: "center" }}>
                    {c.marketing_optin ? (
                      <i className="fas fa-check-circle" style={{ color: "#16a34a" }} title="Marketing opted in" />
                    ) : (
                      <span style={{ color: "#d1d5db" }}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                      {c.whatsapp_optin && <i className="fab fa-whatsapp" style={{ color: "#25D366", fontSize: "1rem" }} title="WhatsApp" />}
                      {c.sms_optin && <i className="fas fa-sms" style={{ color: "#2563eb", fontSize: "0.9rem" }} title="SMS" />}
                      {c.customer_email && <i className="fas fa-envelope" style={{ color: "#6b7280", fontSize: "0.85rem" }} title="Email" />}
                      {channels.length === 0 && <span style={{ color: "#d1d5db" }}>—</span>}
                    </div>
                  </td>
                  <td>{c.order_count}</td>
                  <td style={{ color: "var(--text-light)", fontSize: "0.85rem" }}>
                    {new Date(c.last_order_at).toLocaleDateString("en-GB")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
