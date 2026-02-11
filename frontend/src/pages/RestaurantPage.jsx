import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRestaurant, getMenu } from "../api/client";
import { useBasket } from "../context/BasketContext";
import RestaurantHero from "../components/restaurant/RestaurantHero";
import MapWidget from "../components/restaurant/MapWidget";
import MenuSection from "../components/menu/MenuSection";
import Basket from "../components/order/Basket";
import CheckoutForm from "../components/order/CheckoutForm";

export default function RestaurantPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { addItem, basket } = useBasket();

  const [restaurant, setRestaurant] = useState(null);
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [checkout, setCheckout] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getRestaurant(slug), getMenu(slug)])
      .then(([r, m]) => {
        setRestaurant(r);
        setMenu(m);
        document.documentElement.setAttribute("data-theme", r.theme || "modern");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    return () => document.documentElement.removeAttribute("data-theme");
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
      <div className="container section">
        <CheckoutForm
          onSuccess={handleOrderSuccess}
          onCancel={() => setCheckout(false)}
        />
      </div>
    );
  }

  return (
    <div>
      <RestaurantHero restaurant={restaurant} />

      <div className="container section">
        <div className="restaurant-layout">
          <div>
            <h2 className="section-title" style={{ textAlign: "left" }}>Menu</h2>
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

            <div style={{ marginTop: "2rem" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>Find Us</h3>
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
    </div>
  );
}
