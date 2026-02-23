import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getSuperadminStats,
  getSuperadminRestaurants,
  getSuperadminMessages,
  superadminReplyEmail,
  superPlacesSearch,
  superPlacesImport,
  superPlacesPhoto,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  regenerateToken,
  superadminScrapeDeliveroo,
  uploadImage,
} from "../api/client";

const THEMES = ["modern", "classic", "dark"];

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem("superadmin_token");

  const [view, setView] = useState("restaurants"); // restaurants | messages | discover
  const [stats, setStats] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [msgTab, setMsgTab] = useState("email"); // "email" | "sms"
  const [expandedMsg, setExpandedMsg] = useState(null); // message id
  const [msgSort, setMsgSort] = useState({ col: "id", dir: "desc" });
  const [replyState, setReplyState] = useState({}); // { [id]: { body, subject, sending, ok, err } }
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverQuery, setDiscoverQuery] = useState("restaurants near me");
  const [discoverLat, setDiscoverLat] = useState("");
  const [discoverLng, setDiscoverLng] = useState("");
  const [discoverRadius, setDiscoverRadius] = useState("2500");
  const [discoverResults, setDiscoverResults] = useState([]);
  const [placePhotos, setPlacePhotos] = useState({}); // photo_name -> photoUri
  const [ordersOnly, setOrdersOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // restaurant id being edited, or "new"
  const [form, setForm] = useState(emptyForm());
  const [showTokenFor, setShowTokenFor] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [deliverooScrapeLoading, setDeliverooScrapeLoading] = useState(false);
  const [deliverooScrapeMessage, setDeliverooScrapeMessage] = useState(null);

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

  const loadMessages = useCallback(async () => {
    setMessagesLoading(true);
    setError(null);
    try {
      const data = await getSuperadminMessages(token, { ordersOnly, q: search, limit: 200 });
      setMessages(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setMessagesLoading(false);
    }
  }, [ordersOnly, search, token]);

  useEffect(() => {
    if (view === "messages") loadMessages();
  }, [view, loadMessages]);

  const runDiscover = useCallback(async () => {
    setDiscoverLoading(true);
    setError(null);
    try {
      const payload = await superPlacesSearch(token, {
        q: discoverQuery,
        lat: discoverLat ? parseFloat(discoverLat) : null,
        lng: discoverLng ? parseFloat(discoverLng) : null,
        radius_m: discoverRadius ? parseInt(discoverRadius, 10) : null,
        limit: 20,
      });
      setDiscoverResults(payload.results || []);
      setPlacePhotos({});
    } catch (e) {
      setError(e.message);
    } finally {
      setDiscoverLoading(false);
    }
  }, [token, discoverQuery, discoverLat, discoverLng, discoverRadius]);

  useEffect(() => {
    // Lazy-load a few thumbnails to avoid hammering the API.
    const names = (discoverResults || [])
      .map((r) => r.photo_name)
      .filter(Boolean)
      .slice(0, 8);

    let cancelled = false;
    (async () => {
      for (const name of names) {
        if (cancelled) break;
        if (placePhotos[name]) continue;
        try {
          const res = await superPlacesPhoto(token, name, 700);
          if (!cancelled && res?.photoUri) {
            setPlacePhotos((prev) => ({ ...prev, [name]: res.photoUri }));
          }
        } catch {
          // ignore per-photo errors
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [discoverResults, token, placePhotos]);

  const importPlace = async (placeId) => {
    try {
      await superPlacesImport(token, placeId);
      await loadData();
      alert("Imported. It’s now in your Restaurants list.");
    } catch (e) {
      alert(e.message);
    }
  };

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
    setLogoFile(null);
    setBannerFile(null);
    setForm({
      name: restaurant.name,
      address: restaurant.address,
      cuisine_type: restaurant.cuisine_type,
      about_text: restaurant.about_text || "",
      latitude: restaurant.latitude || "",
      longitude: restaurant.longitude || "",
      logo_url: restaurant.logo_url || "",
      banner_url: restaurant.banner_url || "",
      instagram_handle: restaurant.instagram_handle || "",
      facebook_handle: restaurant.facebook_handle || "",
      phone: restaurant.phone || "",
      whatsapp_number: restaurant.whatsapp_number || "",
      owner_email: restaurant.owner_email || "",
      theme: restaurant.theme || "modern",
      deliveroo_url: restaurant.deliveroo_url || "",
      is_active: restaurant.is_active,
      status: restaurant.status || "live",
      preview_password: restaurant.preview_password || "",
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("superadmin_token");
    navigate("/superadmin");
  };

  const handleCopyFromDeliveroo = async () => {
    if (editing === "new" || !editing) return;
    const url = (form.deliveroo_url || "").trim();
    if (!url) {
      alert("Enter a Deliveroo URL (you can save after copying the menu).");
      return;
    }
    setDeliverooScrapeLoading(true);
    setDeliverooScrapeMessage(null);
    try {
      const result = await superadminScrapeDeliveroo(token, editing, true, url);
      setDeliverooScrapeMessage(
        `Imported ${result.imported ?? 0} new, updated ${result.updated ?? 0}. Refresh the list to see menu counts.`
      );
      loadData();
    } catch (e) {
      setDeliverooScrapeMessage(`Failed: ${e.message}`);
    } finally {
      setDeliverooScrapeLoading(false);
    }
  };

  const handleUploadRestaurantMedia = async (kind) => {
    if (editing === "new") {
      alert("Create the restaurant first, then upload media.");
      return;
    }
    const file = kind === "logo" ? logoFile : bannerFile;
    if (!file) return;
    setMediaUploading(true);
    try {
      const result = await uploadImage(token, file, { kind, restaurantId: editing });
      setForm((prev) => ({ ...prev, [`${kind}_url`]: result.url }));
      if (kind === "logo") setLogoFile(null);
      if (kind === "banner") setBannerFile(null);
    } catch (e) {
      alert(e.message);
    } finally {
      setMediaUploading(false);
    }
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

      {/* View switch */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <button
          className={`btn btn-sm ${view === "restaurants" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setView("restaurants")}
        >
          Restaurants
        </button>
        <button
          className={`btn btn-sm ${view === "discover" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setView("discover")}
        >
          Discover (Google)
        </button>
        <button
          className={`btn btn-sm ${view === "messages" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setView("messages")}
        >
          Messages
        </button>
      </div>

      {/* Stats */}
      {stats && view === "restaurants" && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", marginBottom: "2rem" }}>
          <StatCard label="Restaurants" value={stats.restaurants} sub={`${stats.active_restaurants} active`} />
          <StatCard label="Total Orders" value={stats.total_orders} sub={`${stats.pending_orders} pending`} />
          <StatCard label="Revenue" value={`\u00A3${stats.total_revenue.toFixed(2)}`} sub="collected orders" />
          <StatCard label="Menu Items" value={stats.total_menu_items} sub="across all restaurants" />
        </div>
      )}

      {/* Messages view */}
      {view === "messages" && (
        <div>
          {/* Toolbar */}
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", gap: "0.8rem", alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0, whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={ordersOnly}
                  onChange={(e) => setOrdersOnly(e.target.checked)}
                  style={{ width: "auto" }}
                />
                Orders only
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search from / subject / body…"
                style={{ flex: 1, minWidth: 220 }}
              />
              <button className="btn btn-outline btn-sm" onClick={loadMessages} disabled={messagesLoading}>
                {messagesLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          {/* Channel tabs */}
          {(() => {
            const emailMsgs = messages.filter((m) => m.channel === "email");
            const smsMsgs   = messages.filter((m) => m.channel !== "email");

            const sortedEmail = [...emailMsgs].sort((a, b) => {
              const { col, dir } = msgSort;
              const av = a[col] ?? "";
              const bv = b[col] ?? "";
              const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
              return dir === "asc" ? cmp : -cmp;
            });

            const toggleSort = (col) =>
              setMsgSort((s) => ({ col, dir: s.col === col && s.dir === "desc" ? "asc" : "desc" }));

            const sortArrow = (col) =>
              msgSort.col !== col ? null : msgSort.dir === "asc" ? " ▲" : " ▼";

            const fmtDate = (s) => {
              if (!s) return "-";
              try { return new Date(s).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }); }
              catch { return s; }
            };

            const handleReply = async (m) => {
              const r = replyState[m.id] || {};
              if (!r.body?.trim()) return;
              setReplyState((prev) => ({ ...prev, [m.id]: { ...r, sending: true, ok: false, err: null } }));
              try {
                await superadminReplyEmail(token, {
                  to_email: m.from_addr,
                  subject: r.subject || `Re: ${m.subject || "(no subject)"}`,
                  body: r.body,
                });
                setReplyState((prev) => ({ ...prev, [m.id]: { ...r, body: "", sending: false, ok: true, err: null } }));
              } catch (e) {
                setReplyState((prev) => ({ ...prev, [m.id]: { ...r, sending: false, ok: false, err: e.message } }));
              }
            };

            const thStyle = (col) => ({
              padding: "8px 12px",
              textAlign: "left",
              fontWeight: 600,
              fontSize: "0.78rem",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--text-light)",
              whiteSpace: "nowrap",
              cursor: "pointer",
              userSelect: "none",
              borderBottom: "2px solid var(--border, #e5e7eb)",
            });

            return (
              <>
                {/* Tab row */}
                <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem" }}>
                  {[
                    { key: "email", label: "Email", count: emailMsgs.length },
                    { key: "sms",   label: "SMS / WhatsApp", count: smsMsgs.length },
                  ].map(({ key, label, count }) => (
                    <button
                      key={key}
                      className={`btn btn-sm ${msgTab === key ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setMsgTab(key)}
                    >
                      {label} <span style={{ opacity: 0.7, marginLeft: 4 }}>({count})</span>
                    </button>
                  ))}
                </div>

                {messagesLoading ? (
                  <div className="loading">Loading messages…</div>
                ) : msgTab === "email" ? (
                  /* ── EMAIL INBOX ── */
                  sortedEmail.length === 0 ? (
                    <p style={{ color: "var(--text-light)", textAlign: "center", padding: "2rem" }}>No email messages.</p>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                        <thead>
                          <tr style={{ background: "var(--bg-soft, #f8f8f8)" }}>
                            <th style={thStyle("direction")} onClick={() => toggleSort("direction")}>Dir{sortArrow("direction")}</th>
                            <th style={thStyle("from_addr")} onClick={() => toggleSort("from_addr")}>From{sortArrow("from_addr")}</th>
                            <th style={{ ...thStyle("subject"), width: "100%" }} onClick={() => toggleSort("subject")}>Subject{sortArrow("subject")}</th>
                            <th style={thStyle("created_at")} onClick={() => toggleSort("created_at")}>Date{sortArrow("created_at")}</th>
                            <th style={thStyle("order_number")} onClick={() => toggleSort("order_number")}>Order{sortArrow("order_number")}</th>
                            <th style={thStyle("status")} onClick={() => toggleSort("status")}>Status{sortArrow("status")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedEmail.map((m) => {
                            const expanded = expandedMsg === m.id;
                            const r = replyState[m.id] || {};
                            return (
                              <>
                                <tr
                                  key={m.id}
                                  onClick={() => setExpandedMsg(expanded ? null : m.id)}
                                  style={{
                                    cursor: "pointer",
                                    borderBottom: "1px solid var(--border, #e5e7eb)",
                                    background: expanded ? "var(--bg-soft, #f8fafc)" : "var(--card-bg, #fff)",
                                    transition: "background 120ms",
                                  }}
                                >
                                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                                    <span style={{
                                      fontSize: "0.72rem", fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                                      background: m.direction === "inbound" ? "#dbeafe" : "#dcfce7",
                                      color: m.direction === "inbound" ? "#1d4ed8" : "#166534",
                                    }}>
                                      {m.direction === "inbound" ? "IN" : "OUT"}
                                    </span>
                                  </td>
                                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {m.direction === "inbound" ? (m.from_addr || "-") : (m.to_addr || "-")}
                                  </td>
                                  <td style={{ padding: "10px 12px" }}>
                                    {m.subject || <span style={{ color: "var(--text-light)" }}>(no subject)</span>}
                                  </td>
                                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "var(--text-light)", fontSize: "0.82rem" }}>
                                    {fmtDate(m.created_at)}
                                  </td>
                                  <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                                    {m.order_number
                                      ? <a href={`/order/${m.order_number}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{m.order_number}</a>
                                      : <span style={{ color: "var(--text-light)" }}>—</span>}
                                  </td>
                                  <td style={{ padding: "10px 12px" }}>
                                    {m.status && (
                                      <span className={`badge ${m.status === "ok" ? "status-ready" : "status-pending"}`}>{m.status}</span>
                                    )}
                                  </td>
                                </tr>
                                {expanded && (
                                  <tr key={`${m.id}-exp`} style={{ background: "var(--bg-soft, #f8fafc)" }}>
                                    <td colSpan={6} style={{ padding: "0 16px 16px 40px" }}>
                                      {/* Message body */}
                                      <div style={{
                                        marginTop: 12,
                                        padding: "12px 16px",
                                        background: "var(--card-bg, #fff)",
                                        border: "1px solid var(--border, #e5e7eb)",
                                        borderRadius: 10,
                                        fontSize: "0.88rem",
                                        whiteSpace: "pre-wrap",
                                        maxHeight: 280,
                                        overflowY: "auto",
                                        color: "var(--ink)",
                                      }}>
                                        {m.body_text || <em style={{ color: "var(--text-light)" }}>No body</em>}
                                      </div>

                                      {/* Reply box — only for inbound */}
                                      {m.direction === "inbound" && m.from_addr && (
                                        <div style={{ marginTop: 12, borderLeft: "3px solid var(--primary, #2563eb)", paddingLeft: 14 }}>
                                          <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                                            <span style={{ fontSize: "0.82rem", color: "var(--text-light)", paddingTop: 6 }}>
                                              To: <strong style={{ color: "var(--ink)" }}>{m.from_addr}</strong>
                                            </span>
                                            <input
                                              value={r.subject ?? `Re: ${m.subject || "(no subject)"}`}
                                              onChange={(e) =>
                                                setReplyState((prev) => ({ ...prev, [m.id]: { ...r, subject: e.target.value } }))
                                              }
                                              placeholder="Subject"
                                              style={{ flex: 1, minWidth: 200, fontSize: "0.85rem", padding: "4px 8px" }}
                                            />
                                          </div>
                                          <textarea
                                            rows={4}
                                            value={r.body ?? ""}
                                            onChange={(e) =>
                                              setReplyState((prev) => ({ ...prev, [m.id]: { ...r, body: e.target.value } }))
                                            }
                                            placeholder="Type your reply…"
                                            style={{ width: "100%", fontSize: "0.88rem", padding: "8px 10px", resize: "vertical", boxSizing: "border-box" }}
                                          />
                                          <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                                            <button
                                              className="btn btn-primary btn-sm"
                                              disabled={r.sending || !r.body?.trim()}
                                              onClick={() => handleReply(m)}
                                            >
                                              {r.sending ? "Sending…" : "Send Reply"}
                                            </button>
                                            {r.ok && <span style={{ color: "#16a34a", fontSize: "0.85rem" }}>✓ Sent</span>}
                                            {r.err && <span style={{ color: "#dc2626", fontSize: "0.85rem" }}>✗ {r.err}</span>}
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  /* ── SMS / WHATSAPP ── */
                  smsMsgs.length === 0 ? (
                    <p style={{ color: "var(--text-light)", textAlign: "center", padding: "2rem" }}>No SMS / WhatsApp messages.</p>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                        <thead>
                          <tr style={{ background: "var(--bg-soft, #f8f8f8)" }}>
                            <th style={thStyle("channel")}>Channel</th>
                            <th style={thStyle("direction")}>Dir</th>
                            <th style={thStyle("from_addr")}>From</th>
                            <th style={thStyle("to_addr")}>To</th>
                            <th style={{ ...thStyle("body_text"), width: "100%" }}>Message</th>
                            <th style={thStyle("created_at")}>Date</th>
                            <th style={thStyle("order_number")}>Order</th>
                          </tr>
                        </thead>
                        <tbody>
                          {smsMsgs.map((m) => (
                            <tr
                              key={m.id}
                              style={{ borderBottom: "1px solid var(--border, #e5e7eb)", verticalAlign: "top" }}
                            >
                              <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                                <span style={{
                                  fontSize: "0.72rem", fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                                  background: m.channel === "whatsapp" ? "#dcfce7" : "#f0f9ff",
                                  color: m.channel === "whatsapp" ? "#15803d" : "#0369a1",
                                }}>
                                  {m.channel === "whatsapp" ? "WhatsApp" : "SMS"}
                                </span>
                              </td>
                              <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                                <span style={{
                                  fontSize: "0.72rem", fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                                  background: m.direction === "inbound" ? "#dbeafe" : "#dcfce7",
                                  color: m.direction === "inbound" ? "#1d4ed8" : "#166534",
                                }}>
                                  {m.direction === "inbound" ? "IN" : "OUT"}
                                </span>
                              </td>
                              <td style={{ padding: "9px 12px", whiteSpace: "nowrap", fontSize: "0.83rem" }}>{m.from_addr || "—"}</td>
                              <td style={{ padding: "9px 12px", whiteSpace: "nowrap", fontSize: "0.83rem" }}>{m.to_addr || "—"}</td>
                              <td style={{ padding: "9px 12px", fontSize: "0.85rem", color: "var(--ink)" }}>
                                {(m.body_text || "").slice(0, 180)}{(m.body_text || "").length > 180 ? "…" : ""}
                              </td>
                              <td style={{ padding: "9px 12px", whiteSpace: "nowrap", color: "var(--text-light)", fontSize: "0.82rem" }}>
                                {fmtDate(m.created_at)}
                              </td>
                              <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                                {m.order_number
                                  ? <a href={`/order/${m.order_number}`} target="_blank" rel="noreferrer">{m.order_number}</a>
                                  : <span style={{ color: "var(--text-light)" }}>—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Discover view */}
      {view === "discover" && (
        <div>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 160px 160px 160px", gap: "0.8rem", alignItems: "end" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Query</label>
                <input value={discoverQuery} onChange={(e) => setDiscoverQuery(e.target.value)} placeholder="pizza in hackney" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Lat (optional)</label>
                <input value={discoverLat} onChange={(e) => setDiscoverLat(e.target.value)} placeholder="51.5454" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Lng (optional)</label>
                <input value={discoverLng} onChange={(e) => setDiscoverLng(e.target.value)} placeholder="-0.0556" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Radius (m)</label>
                <input value={discoverRadius} onChange={(e) => setDiscoverRadius(e.target.value)} placeholder="2500" />
              </div>
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn btn-primary btn-sm" onClick={runDiscover} disabled={discoverLoading}>
                {discoverLoading ? "Searching..." : "Search"}
              </button>
              <span style={{ color: "var(--text-light)", fontSize: "0.9rem" }}>
                Uses server-side `GOOGLE_PLACES_API_KEY`. If results are empty, check the key + Places API is enabled in Google Cloud.
              </span>
            </div>
          </div>

          {discoverLoading ? (
            <div className="loading">Searching…</div>
          ) : discoverResults.length === 0 ? (
            <p style={{ color: "var(--text-light)", textAlign: "center", padding: "2rem" }}>
              No results yet. Try a query like “restaurants in Hackney” and optionally add lat/lng.
            </p>
          ) : (
            <div className="grid grid-2">
              {discoverResults.map((p) => (
                <div key={p.place_id} className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.8rem", alignItems: "flex-start" }}>
                    <div>
                      {p.photo_name && placePhotos[p.photo_name] && (
                        <div style={{ marginBottom: 10 }}>
                          <img
                            src={placePhotos[p.photo_name]}
                            alt={`${p.name} photo`}
                            style={{
                              width: "100%",
                              maxHeight: 160,
                              objectFit: "cover",
                              borderRadius: 14,
                              border: "1px solid rgba(0,0,0,0.06)",
                            }}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      )}
                      <div style={{ fontWeight: 800 }}>{p.name}</div>
                      <div style={{ color: "var(--text-light)", fontSize: "0.9rem", marginTop: 6 }}>
                        {p.address || "-"}
                      </div>
                      <div style={{ color: "var(--text-light)", fontSize: "0.85rem", marginTop: 6 }}>
                        {p.primary_type_label || p.primary_type || "Restaurant"}
                      </div>
                    </div>
                    <button className="btn btn-outline btn-sm" onClick={() => importPlace(p.place_id)}>
                      Import
                    </button>
                  </div>
                  <p style={{ marginTop: 10, color: "var(--text-light)", fontSize: "0.85rem" }}>
                    Note: Google photos are short-lived URLs. Use them for preview, then upload a real banner/logo in the restaurant settings.
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add button */}
      {view === "restaurants" && editing === null && (
        <div style={{ marginBottom: "1.5rem" }}>
          <button className="btn btn-primary" onClick={() => { setEditing("new"); setForm(emptyForm()); }}>
            + Add Restaurant
          </button>
        </div>
      )}

      {/* Add/Edit form */}
      {view === "restaurants" && editing !== null && (
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
              <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                <label>About (shown on restaurant page)</label>
                <textarea
                  rows={5}
                  value={form.about_text}
                  onChange={(e) => setForm({ ...form, about_text: e.target.value })}
                  placeholder="A short intro about the restaurant, what you serve, and what to try."
                />
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
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                  <input
                    value={form.deliveroo_url}
                    onChange={(e) => setForm({ ...form, deliveroo_url: e.target.value })}
                    placeholder="https://deliveroo.co.uk/menu/..."
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCopyFromDeliveroo}
                    disabled={deliverooScrapeLoading || editing === "new" || !(form.deliveroo_url || "").trim()}
                    title="Scrape menu from Deliveroo and import into this restaurant"
                  >
                    {deliverooScrapeLoading ? "Copying…" : "Copy menu from Deliveroo"}
                  </button>
                </div>
                {deliverooScrapeMessage && (
                  <p style={{ marginTop: 8, fontSize: "0.9rem", color: "var(--text-light)" }}>{deliverooScrapeMessage}</p>
                )}
              </div>
              <div className="form-group">
                <label>Logo URL</label>
                <input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://.../logo.png" />
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    style={{ flex: 1, minWidth: 220 }}
                    disabled={editing === "new"}
                  />
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleUploadRestaurantMedia("logo")}
                    disabled={editing === "new" || !logoFile || mediaUploading}
                  >
                    {mediaUploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Banner URL</label>
                <input value={form.banner_url} onChange={(e) => setForm({ ...form, banner_url: e.target.value })} placeholder="https://.../banner.jpg" />
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                    style={{ flex: 1, minWidth: 220 }}
                    disabled={editing === "new"}
                  />
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => handleUploadRestaurantMedia("banner")}
                    disabled={editing === "new" || !bannerFile || mediaUploading}
                  >
                    {mediaUploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="pending">Pending (testing, password protected)</option>
                  <option value="live">Live (public)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Preview password</label>
                <input
                  value={form.preview_password}
                  onChange={(e) => setForm({ ...form, preview_password: e.target.value })}
                  placeholder="Password for pending sites"
                />
                <p style={{ fontSize: "0.8rem", color: "var(--text-light)", marginTop: 4 }}>
                  Required when status is Pending. Testers need this to access the site.
                </p>
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
      {view === "restaurants" && (
      <div className="grid grid-2">
        {restaurants.map((r) => (
          <div key={r.id} className="card" style={{ opacity: r.is_active ? 1 : 0.6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.8rem" }}>
              <div>
                <h4 style={{ fontWeight: 700, fontSize: "1.1rem" }}>{r.name}</h4>
                <p style={{ color: "var(--text-light)", fontSize: "0.85rem" }}>{r.address}</p>
              </div>
              <div style={{ display: "flex", gap: "0.3rem", flexShrink: 0 }}>
                <span className={`badge ${(r.status || "live") === "live" ? "status-confirmed" : "status-pending"}`}>
                  {(r.status || "live") === "live" ? "Live" : "Pending"}
                </span>
                {!r.is_active && (
                  <span className="badge status-cancelled">inactive</span>
                )}
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
              <a
                href={`/admin?token=${encodeURIComponent(r.admin_token)}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm"
                title="Open restaurant admin dashboard directly"
              >
                Quick Login
              </a>
              <button
                className="btn btn-outline btn-sm"
                title="Copy direct admin login link to clipboard"
                onClick={() => {
                  const link = `${window.location.origin}/admin?token=${encodeURIComponent(r.admin_token)}`;
                  navigator.clipboard.writeText(link);
                }}
              >
                Copy Link
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id, r.name)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      )}
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
    about_text: "",
    latitude: "",
    longitude: "",
    logo_url: "",
    banner_url: "",
    instagram_handle: "",
    facebook_handle: "",
    phone: "",
    whatsapp_number: "",
    owner_email: "",
    theme: "modern",
    deliveroo_url: "",
    is_active: true,
    status: "pending",
    preview_password: "",
  };
}
