import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRestaurant, getMenu, getInstagram } from "../api/client";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkout, setCheckout] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getRestaurant(slug), getMenu(slug), getInstagram(slug, 8).catch(() => [])])
      .then(([r, m, ig]) => {
        setRestaurant(r);
        setMenu(m);
        setInstagram(Array.isArray(ig) ? ig : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="loading">Loading...</div>;
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

      <InstagramFeed posts={instagram} handle={restaurant.instagram_handle} />
    </div>
  );
}
