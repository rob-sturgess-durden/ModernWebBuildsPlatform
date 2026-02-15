import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRestaurant, getMenu, getInstagram, getGallery } from "../api/client";
import { useBasket } from "../context/BasketContext";
import RestaurantHero from "../components/restaurant/RestaurantHero";
import MapWidget from "../components/restaurant/MapWidget";
import InstagramFeed from "../components/restaurant/InstagramFeed";
import MenuSection from "../components/menu/MenuSection";
import Basket from "../components/order/Basket";
import CheckoutForm from "../components/order/CheckoutForm";

export default function RestaurantPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem } = useBasket();

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
    addItem(item, restaurant.id, restaurant.slug);
  };

  const handleOrderSuccess = (order) => {
    navigate(`/order/${order.order_number}`);
  };

  if (checkout) {
    return (
      <section className="section" style={{ padding: "72px 6vw" }}>
        <div className="container">
          <CheckoutForm
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

      <section id="menu" className="menu" style={{ padding: "72px 6vw" }}>
        <div className="container">
          <div className="restaurant-layout">
            <div>
              <div className="section-title" style={{ marginBottom: 32, textAlign: "left" }}>
                <p className="eyebrow">Menu</p>
                <h2 style={{ fontFamily: '"Fraunces", serif', margin: "12px 0 0" }}>
                  Order ahead
                </h2>
              </div>
              {menu.length === 0 ? (
                <p style={{ color: "var(--text-light)" }}>No menu items available yet.</p>
              ) : (
                menu.map((cat) => (
                  <MenuSection key={cat.id} category={cat} onAddItem={handleAddItem} />
                ))
              )}
            </div>

            <div>
              <Basket onCheckout={() => setCheckout(true)} />

              <div className="contact-card" style={{ marginTop: "2rem" }}>
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
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
