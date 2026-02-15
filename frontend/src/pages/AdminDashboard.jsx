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
  scrapeMenuWithImport,
  getAdminCustomers,
  getAdminStats,
  getAdminGallery,
  addGalleryImage,
  deleteGalleryImage,
} from "../api/client";

const STATUS_TABS = ["all", "pending", "confirmed", "ready", "collected", "cancelled"];

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
  const [copyFromDeliverooLoading, setCopyFromDeliverooLoading] = useState(false);
  const [copyFromDeliverooMessage, setCopyFromDeliverooMessage] = useState(null);

  // Gallery
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryFile, setGalleryFile] = useState(null);
  const [galleryCaption, setGalleryCaption] = useState("");
  const [galleryUploading, setGalleryUploading] = useState(false);

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
        deliveroo_url: settings.deliveroo_url || null,
        justeat_url: settings.justeat_url || null,
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

  const handleCopyFromDeliveroo = async () => {
    if (!settings?.deliveroo_url?.trim()) {
      alert("Please save a Deliveroo URL in Settings first.");
      return;
    }
    setCopyFromDeliverooLoading(true);
    setCopyFromDeliverooMessage(null);
    try {
      const result = await scrapeMenuWithImport(token, "deliveroo", null, true);
      setCopyFromDeliverooMessage(
        `Imported ${result.imported ?? 0} new items, updated ${result.updated ?? 0}. Check the Menu tab.`
      );
      if (tab === "menu") loadMenu();
    } catch (e) {
      setCopyFromDeliverooMessage(`Failed: ${e.message}`);
    } finally {
      setCopyFromDeliverooLoading(false);
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

      {/* Dashboard tab */}
      {tab === "dashboard" && (
        <div>
          {!stats ? (
            <div className="loading">Loading stats...</div>
          ) : (
            <>
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
          <div style={{ display: "flex", gap: "0.3rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            {STATUS_TABS.map((s) => (
              <button
                key={s}
                className={`btn btn-sm ${statusFilter === s ? "btn-secondary" : "btn-outline"}`}
                onClick={() => setStatusFilter(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
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
                <label>Deliveroo menu URL</label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    type="url"
                    value={settings.deliveroo_url || ""}
                    onChange={(e) => setSettings((s) => ({ ...s, deliveroo_url: e.target.value }))}
                    placeholder="https://deliveroo.co.uk/menu/..."
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCopyFromDeliveroo}
                    disabled={copyFromDeliverooLoading || !(settings.deliveroo_url || "").trim()}
                    title="Scrape menu items from your Deliveroo page and add them here"
                  >
                    {copyFromDeliverooLoading ? "Copying…" : "Copy menu from Deliveroo"}
                  </button>
                </div>
                {copyFromDeliverooMessage && (
                  <p style={{ marginTop: 8, fontSize: "0.9rem", color: "var(--text-light)" }}>
                    {copyFromDeliverooMessage}
                  </p>
                )}
              </div>
              <div className="form-group">
                <label>Just Eat URL (optional)</label>
                <input
                  type="url"
                  value={settings.justeat_url || ""}
                  onChange={(e) => setSettings((s) => ({ ...s, justeat_url: e.target.value }))}
                  placeholder="https://www.just-eat.co.uk/..."
                />
              </div>
              <div className="form-group">
                <label>Opening hours (optional, JSON)</label>
                <textarea
                  value={
                    typeof settings.opening_hours === "object" && settings.opening_hours
                      ? JSON.stringify(settings.opening_hours, null, 2)
                      : (settings.opening_hours || "")
                  }
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (!v) {
                      setSettings((s) => ({ ...s, opening_hours: null }));
                      return;
                    }
                    try {
                      setSettings((s) => ({ ...s, opening_hours: JSON.parse(v) }));
                    } catch {
                      /* keep previous value if invalid JSON */
                    }
                  }}
                  rows={4}
                  placeholder='{"mon": "9-17", "tue": "9-17", ...}'
                  style={{ fontFamily: "monospace", fontSize: "0.85rem" }}
                />
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
        </div>
      )}

      {/* Customers tab */}
      {tab === "customers" && (
        <div>
          {loading ? (
            <div className="loading">Loading customers...</div>
          ) : customers.length === 0 ? (
            <p style={{ color: "var(--text-light)", textAlign: "center", padding: "2rem" }}>
              No customers yet. Customers appear here once they place an order.
            </p>
          ) : (
            <>
              <p style={{ color: "var(--text-light)", marginBottom: "1.2rem" }}>
                {customers.length} registered customer{customers.length !== 1 ? "s" : ""}
              </p>
              <div style={{ overflowX: "auto" }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Orders</th>
                      <th>Last order</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{c.customer_name}</td>
                        <td style={{ color: "var(--text-light)" }}>{c.customer_email || "—"}</td>
                        <td>{c.order_count}</td>
                        <td style={{ color: "var(--text-light)" }}>
                          {new Date(c.last_order_at).toLocaleDateString("en-GB")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
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
    pending: [{ label: "Confirm", status: "confirmed", cls: "btn-success" }, { label: "Cancel", status: "cancelled", cls: "btn-danger" }],
    confirmed: [{ label: "Mark Ready", status: "ready", cls: "btn-success" }, { label: "Cancel", status: "cancelled", cls: "btn-danger" }],
    ready: [{ label: "Collected", status: "collected", cls: "btn-success" }],
  };

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.8rem" }}>
        <h4 style={{ fontWeight: 700 }}>{order.order_number}</h4>
        <span className={`badge status-${order.status}`}>{order.status}</span>
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
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {actions[order.status].map((a) => (
            <button
              key={a.status}
              className={`btn btn-sm ${a.cls}`}
              onClick={() => onStatusChange(order.id, a.status)}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
