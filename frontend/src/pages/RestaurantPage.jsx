import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRestaurant, getMenu, getInstagram, getGallery } from "../api/client";
import { useBasket } from "../context/BasketContext";
import RestaurantHero from "../components/restaurant/RestaurantHero";
import MapWidget from "../components/restaurant/MapWidget";
import InstagramFeed from "../components/restaurant/InstagramFeed";
import OpeningHours from "../components/restaurant/OpeningHours";
import DealsSignup from "../components/restaurant/DealsSignup";
import MenuSection from "../components/menu/MenuSection";
import Basket from "../components/order/Basket";
import CheckoutForm from "../components/order/CheckoutForm";

export default function RestaurantPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem, totalItems, subtotal: basketTotal } = useBasket();

  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [instagram, setInstagram] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkout, setCheckout] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);

  // Load last order for reorder feature
  useEffect(() => {
    try {
      const raw = localStorage.getItem("forkit_last_order");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.restaurant_slug === slug && parsed?.items?.length) {
        setLastOrder(parsed);
      }
    } catch { /* ignore */ }
  }, [slug]);

  const handleReorder = () => {
    if (!lastOrder?.items?.length || !restaurant) return;
    lastOrder.items.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        addItem({ id: item.id, name: item.name, price: item.price }, restaurant.id, restaurant.slug);
      }
    });
  };

  const loadRestaurant = (pw = null) => {
    setLoading(true);
    setError(null);
    const password = pw || sessionStorage.getItem(`preview_pw_${slug}`);
    Promise.all([
      getRestaurant(slug, password),
      getMenu(slug, password),
      getInstagram(slug, 8, password).catch(() => []),
      getGallery(slug, password).catch(() => []),
    ])
      .then(([r, m, ig, gal]) => {
        setRestaurant(r);
        setMenu(m);
        setInstagram(Array.isArray(ig) ? ig : []);
        setGallery(Array.isArray(gal) ? gal : []);
        setNeedsPassword(false);
        if (password) sessionStorage.setItem(`preview_pw_${slug}`, password);
      })
      .catch((e) => {
        if (e.message === "password_required") {
          setNeedsPassword(true);
          setPasswordError(!!pw);
        } else {
          setError(e.message);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadRestaurant();
  }, [slug]);

  useEffect(() => {
    if (!restaurant) return;
    const theme = (restaurant.theme || "modern").toLowerCase();
    document.documentElement.dataset.theme = theme;
    return () => {
      // Reset so non-restaurant pages don't inherit the last restaurant's theme.
      document.documentElement.dataset.theme = "modern";
    };
  }, [restaurant]);

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;
    loadRestaurant(passwordInput.trim());
  };

  if (loading) return <div className="loading">Loading...</div>;

  if (needsPassword) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div className="card" style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>
            <i className="fas fa-lock" />
          </div>
          <h2 style={{ fontWeight: 700, marginBottom: "0.5rem" }}>Preview mode</h2>
          <p style={{ color: "var(--text-light)", marginBottom: "1.5rem" }}>
            This restaurant is currently in testing. Enter the preview password to continue.
          </p>
          <form onSubmit={handlePasswordSubmit}>
            <div className="form-group">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                placeholder="Enter password"
                autoFocus
                style={passwordError ? { borderColor: "#e53e3e" } : {}}
              />
              {passwordError && (
                <p style={{ color: "#e53e3e", fontSize: "0.85rem", marginTop: 6 }}>Incorrect password</p>
              )}
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }}>
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error) return <div className="error">{error}</div>;
  if (!restaurant) return <div className="error">Restaurant not found</div>;

  const handleAddItem = (item) => {
    if (restaurant.accepting_orders === false) return;
    addItem(item, restaurant.id, restaurant.slug);
  };

  const handleOrderSuccess = (order) => {
    navigate(`/order/${order.order_number}`);
  };

  if (checkout) {
    return (
      <section className="section" style={{ padding: "48px 6vw" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            {restaurant.logo_url ? (
              <img
                src={restaurant.logo_url}
                alt={restaurant.name}
                style={{ width: 72, height: 72, objectFit: "contain", borderRadius: 12, marginBottom: 12 }}
              />
            ) : (
              <div style={{ width: 72, height: 72, borderRadius: 12, background: "var(--bg-soft, #f5f5f5)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", fontSize: "1.8rem", color: "var(--text-light)" }}>
                <i className="fas fa-utensils" />
              </div>
            )}
            <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: "1.4rem", margin: 0 }}>
              {restaurant.name}
            </h2>
          </div>
          <CheckoutForm
            restaurant={restaurant}
            onSuccess={handleOrderSuccess}
            onCancel={() => setCheckout(false)}
          />
        </div>
      </section>
    );
  }

  return (
    <div>
      <RestaurantHero restaurant={restaurant} />

      <section className="section" style={{ padding: "28px 6vw 0" }}>
        <div className="container">
          <div className="card" style={{ padding: "22px 24px" }}>
            <p className="eyebrow">About</p>
            <h2 style={{ fontFamily: '"Fraunces", serif', margin: "10px 0 10px" }}>
              {restaurant.name}
            </h2>
            <p style={{ color: "var(--text-light)", lineHeight: 1.7, margin: 0 }}>
              {restaurant.about_text?.trim()
                ? restaurant.about_text
                : "Tell customers what makes you special: what you serve, your story, and what to try first."}
            </p>
            <p style={{ marginTop: 12, color: "var(--text-light)", fontSize: "0.95rem" }}>
              <strong style={{ color: "var(--ink)" }}>Address:</strong> {restaurant.address}
            </p>
          </div>
        </div>
      </section>

      <DealsSignup restaurant={restaurant} />

      {instagram.length > 0 ? (
        <InstagramFeed posts={instagram} handle={restaurant.instagram_handle} />
      ) : gallery.length > 0 ? (
        <section className="section" style={{ padding: "48px 6vw 72px" }}>
          <div className="container">
            <div className="section-title" style={{ marginBottom: 18, textAlign: "left" }}>
              <p className="eyebrow">Gallery</p>
              <h2 style={{ fontFamily: '"Fraunces", serif', margin: "10px 0 0" }}>Photos</h2>
            </div>
            <div className="ig-grid">
              {gallery.map((img) => (
                <div key={img.id} className="ig-card" style={{ cursor: "default" }}>
                  <img loading="lazy" src={img.image_url} alt={img.caption || "Gallery photo"} />
                  {img.caption && (
                    <span className="ig-overlay">
                      <span className="ig-pill">{img.caption}</span>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {restaurant.accepting_orders === false && (
        <section className="section" style={{ padding: "0 6vw" }}>
          <div className="container">
            <div style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 12,
              padding: "1rem 1.5rem",
              textAlign: "center",
              color: "#991b1b",
              fontWeight: 600,
            }}>
              <i className="fas fa-pause-circle" style={{ marginRight: 8 }} />
              This restaurant is not currently accepting online orders.
            </div>
          </div>
        </section>
      )}

      <section id="menu" className="menu" style={{ padding: "72px 6vw" }}>
        <div className="container">
          <div className="restaurant-layout">
            <div className="restaurant-layout__menu">
              <div className="section-title" style={{ marginBottom: 32, textAlign: "left" }}>
                <p className="eyebrow">Menu</p>
                <h2 style={{ fontFamily: '"Fraunces", serif', margin: "12px 0 0" }}>
                  {restaurant.accepting_orders === false ? "Our Menu" : "Order ahead"}
                </h2>
              </div>
              {menu.length === 0 ? (
                <p style={{ color: "var(--text-light)" }}>No menu items available yet.</p>
              ) : (
                <>
                  <div className="menu-tabs">
                    <button
                      className={`menu-tab${activeCategory === null ? " menu-tab--active" : ""}`}
                      onClick={() => setActiveCategory(null)}
                    >
                      All
                    </button>
                    {menu.map((cat) => (
                      <button
                        key={cat.id}
                        className={`menu-tab${activeCategory === cat.id ? " menu-tab--active" : ""}`}
                        onClick={() => setActiveCategory(cat.id)}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                  {(activeCategory === null ? menu : menu.filter((cat) => cat.id === activeCategory)).map((cat) => (
                    <MenuSection key={cat.id} category={cat} onAddItem={handleAddItem} />
                  ))}
                </>
              )}
            </div>

            <div className="restaurant-layout__sidebar">
              <div className="restaurant-layout__sidebar-inner">
                {lastOrder && (
                  <div className="hero-card" style={{ padding: "1rem 1.25rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <i className="fas fa-redo" style={{ color: "var(--accent)", fontSize: "0.9rem" }} />
                      <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Your last order</span>
                    </div>
                    <p style={{ margin: "0 0 10px", color: "var(--text-light)", fontSize: "0.85rem" }}>
                      {lastOrder.items.reduce((s, i) => s + i.quantity, 0)} items &middot; £{lastOrder.subtotal.toFixed(2)}
                    </p>
                    <button
                      className="btn btn-olive btn-pill btn-sm"
                      style={{ width: "100%" }}
                      onClick={handleReorder}
                    >
                      Reorder
                    </button>
                  </div>
                )}
                <Basket onCheckout={() => { setCheckout(true); window.scrollTo(0, 0); }} />
                <div className="contact-card">
                  <p className="meta-title">Find us</p>
                  <MapWidget
                    lat={restaurant.latitude}
                    lng={restaurant.longitude}
                    name={restaurant.name}
                    address={restaurant.address}
                  />
                  <p style={{ marginTop: "0.8rem", color: "var(--text-light)", fontSize: "0.9rem" }}>
                    {restaurant.address}
                  </p>
                  <OpeningHours openingHours={restaurant.opening_hours} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Floating mobile basket bar */}
      {totalItems > 0 && !checkout && (
        <div
          className="mobile-basket-bar"
          onClick={() => {
            setCheckout(true);
            window.scrollTo(0, 0);
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span className="mobile-basket-bar__badge">{totalItems}</span>
            <span style={{ fontWeight: 600 }}>View Basket</span>
          </div>
          <span style={{ fontWeight: 700 }}>&pound;{basketTotal.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}
