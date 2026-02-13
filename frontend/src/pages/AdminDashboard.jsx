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
} from "../api/client";

const STATUS_TABS = ["all", "pending", "confirmed", "ready", "collected", "cancelled"];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("admin_token");
  const restaurantInfo = JSON.parse(localStorage.getItem("admin_restaurant") || "{}");

  const [tab, setTab] = useState("orders");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [orders, setOrders] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    if (!token) {
      navigate("/admin");
      return;
    }
    loadOrders();
  }, [statusFilter]);

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

  return (
    <div className="container section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 700 }}>{restaurantInfo.name || "Dashboard"}</h1>
          <p style={{ color: "var(--text-light)" }}>Restaurant Admin Dashboard</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleLogout}>Logout</button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
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
      </div>

      {error && <div className="error">{error}</div>}

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
