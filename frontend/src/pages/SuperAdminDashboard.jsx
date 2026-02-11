import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getSuperadminStats,
  getSuperadminRestaurants,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  regenerateToken,
} from "../api/client";

const THEMES = ["modern", "classic", "dark"];

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("superadmin_token");

  const [stats, setStats] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // restaurant id being edited, or "new"
  const [form, setForm] = useState(emptyForm());
  const [showTokenFor, setShowTokenFor] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([
        getSuperadminStats(token),
        getSuperadminRestaurants(token),
      ]);
      setStats(s);
      setRestaurants(r);
    } catch (e) {
      if (e.message.includes("401") || e.message.includes("Invalid")) {
        localStorage.removeItem("superadmin_token");
        navigate("/superadmin");
        return;
      }
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [navigate, token]);

  useEffect(() => {
    if (!token) {
      navigate("/superadmin");
      return;
    }
    loadData();
  }, [loadData, navigate, token]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.address || !form.cuisine_type) {
      alert("Name, address, and cuisine type are required");
      return;
    }
    try {
      const data = {
        ...form,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
      };
      if (editing === "new") {
        await createRestaurant(token, data);
      } else {
        await updateRestaurant(token, editing, data);
      }
      setEditing(null);
      setForm(emptyForm());
      loadData();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}" and ALL its orders, menu items, and categories? This cannot be undone.`)) return;
    try {
      await deleteRestaurant(token, id);
      loadData();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleRegenToken = async (id) => {
    if (!confirm("Generate a new admin token? The old token will stop working immediately.")) return;
    try {
      const result = await regenerateToken(token, id);
      alert(`New token: ${result.admin_token}\n\nCopy this now - it won't be shown again.`);
      loadData();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleEdit = (restaurant) => {
    setEditing(restaurant.id);
    setForm({
      name: restaurant.name,
      address: restaurant.address,
      cuisine_type: restaurant.cuisine_type,
      latitude: restaurant.latitude || "",
      longitude: restaurant.longitude || "",
      instagram_handle: restaurant.instagram_handle || "",
      facebook_handle: restaurant.facebook_handle || "",
      phone: restaurant.phone || "",
      whatsapp_number: restaurant.whatsapp_number || "",
      owner_email: restaurant.owner_email || "",
      theme: restaurant.theme || "modern",
      deliveroo_url: restaurant.deliveroo_url || "",
      justeat_url: restaurant.justeat_url || "",
      is_active: restaurant.is_active,
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("superadmin_token");
    navigate("/superadmin");
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="container section">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 700 }}>Super Admin</h1>
          <p style={{ color: "var(--text-light)" }}>Manage all restaurants on the platform</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={handleLogout}>Logout</button>
      </div>

      {error && <div className="error" style={{ marginBottom: "1rem" }}>{error}</div>}

      {/* Stats */}
      {stats && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", marginBottom: "2rem" }}>
          <StatCard label="Restaurants" value={stats.restaurants} sub={`${stats.active_restaurants} active`} />
          <StatCard label="Total Orders" value={stats.total_orders} sub={`${stats.pending_orders} pending`} />
          <StatCard label="Revenue" value={`\u00A3${stats.total_revenue.toFixed(2)}`} sub="collected orders" />
          <StatCard label="Menu Items" value={stats.total_menu_items} sub="across all restaurants" />
        </div>
      )}

      {/* Add button */}
      {editing === null && (
        <div style={{ marginBottom: "1.5rem" }}>
          <button className="btn btn-primary" onClick={() => { setEditing("new"); setForm(emptyForm()); }}>
            + Add Restaurant
          </button>
        </div>
      )}

      {/* Add/Edit form */}
      {editing !== null && (
        <div className="card" style={{ marginBottom: "2rem" }}>
          <h3 style={{ fontWeight: 600, marginBottom: "1rem" }}>
            {editing === "new" ? "Add Restaurant" : "Edit Restaurant"}
          </h3>
          <form onSubmit={handleSave}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" }}>
              <div className="form-group">
                <label>Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Cuisine Type *</label>
                <input value={form.cuisine_type} onChange={(e) => setForm({ ...form, cuisine_type: e.target.value })} required />
              </div>
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>Address *</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Owner Email</label>
                <input type="email" value={form.owner_email} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Owner WhatsApp</label>
                <input value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="+447700900000" />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Theme</label>
                <select value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })}>
                  {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Instagram Handle</label>
                <input value={form.instagram_handle} onChange={(e) => setForm({ ...form, instagram_handle: e.target.value })} placeholder="beansandbiteshackney" />
              </div>
              <div className="form-group">
                <label>Facebook</label>
                <input value={form.facebook_handle} onChange={(e) => setForm({ ...form, facebook_handle: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Latitude</label>
                <input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="51.5454" />
              </div>
              <div className="form-group">
                <label>Longitude</label>
                <input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="-0.0556" />
              </div>
              <div className="form-group">
                <label>Deliveroo URL</label>
                <input value={form.deliveroo_url} onChange={(e) => setForm({ ...form, deliveroo_url: e.target.value })} placeholder="https://deliveroo.co.uk/menu/..." />
              </div>
              <div className="form-group">
                <label>Just Eat URL</label>
                <input value={form.justeat_url} onChange={(e) => setForm({ ...form, justeat_url: e.target.value })} placeholder="https://just-eat.co.uk/restaurants-..." />
              </div>
              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingTop: "1.5rem" }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  style={{ width: "auto" }}
                  id="is_active"
                />
                <label htmlFor="is_active" style={{ margin: 0 }}>Active (visible to customers)</label>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
              <button type="submit" className="btn btn-primary">
                {editing === "new" ? "Create Restaurant" : "Save Changes"}
              </button>
              <button type="button" className="btn btn-outline" onClick={() => { setEditing(null); setForm(emptyForm()); }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Restaurant list */}
      <div className="grid grid-2">
        {restaurants.map((r) => (
          <div key={r.id} className="card" style={{ opacity: r.is_active ? 1 : 0.6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.8rem" }}>
              <div>
                <h4 style={{ fontWeight: 700, fontSize: "1.1rem" }}>{r.name}</h4>
                <p style={{ color: "var(--text-light)", fontSize: "0.85rem" }}>{r.address}</p>
              </div>
              <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0 }}>
                <span className={`badge ${r.is_active ? "status-confirmed" : "status-cancelled"}`}>
                  {r.is_active ? "active" : "inactive"}
                </span>
                <span className="badge" style={{ background: "#e2e8f0", color: "#475569" }}>{r.theme}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem", fontSize: "0.85rem", color: "var(--text-light)", marginBottom: "0.8rem" }}>
              <div>Slug: <strong>/{r.slug}</strong></div>
              <div>Orders: <strong>{r.order_count}</strong></div>
              <div>Menu items: <strong>{r.menu_item_count}</strong></div>
              <div>Cuisine: {r.cuisine_type.split("(")[0].trim()}</div>
              {r.owner_email && <div>Email: {r.owner_email}</div>}
              {r.whatsapp_number && <div>WhatsApp: {r.whatsapp_number}</div>}
            </div>

            {/* Admin token */}
            <div style={{ fontSize: "0.85rem", marginBottom: "0.8rem", padding: "0.5rem", background: "var(--bg)", borderRadius: 8 }}>
              <strong>Admin token: </strong>
              {showTokenFor === r.id ? (
                <span style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{r.admin_token}</span>
              ) : (
                <span>{"*".repeat(20)}</span>
              )}
              <button
                className="btn btn-outline btn-sm"
                style={{ marginLeft: "0.5rem", padding: "0.15rem 0.5rem", fontSize: "0.75rem" }}
                onClick={() => setShowTokenFor(showTokenFor === r.id ? null : r.id)}
              >
                {showTokenFor === r.id ? "Hide" : "Show"}
              </button>
              {showTokenFor === r.id && (
                <button
                  className="btn btn-outline btn-sm"
                  style={{ marginLeft: "0.3rem", padding: "0.15rem 0.5rem", fontSize: "0.75rem" }}
                  onClick={() => { navigator.clipboard.writeText(r.admin_token); }}
                >
                  Copy
                </button>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
              <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(r)}>Edit</button>
              <button className="btn btn-warning btn-sm" onClick={() => handleRegenToken(r.id)}>New Token</button>
              <a href={`/${r.slug}`} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">View Site</a>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id, r.name)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: "1.8rem", fontWeight: 700, color: "var(--primary)" }}>{value}</div>
      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{label}</div>
      <div style={{ color: "var(--text-light)", fontSize: "0.8rem" }}>{sub}</div>
    </div>
  );
}

function emptyForm() {
  return {
    name: "",
    address: "",
    cuisine_type: "",
    latitude: "",
    longitude: "",
    instagram_handle: "",
    facebook_handle: "",
    phone: "",
    whatsapp_number: "",
    owner_email: "",
    theme: "modern",
    deliveroo_url: "",
    justeat_url: "",
    is_active: true,
  };
}
