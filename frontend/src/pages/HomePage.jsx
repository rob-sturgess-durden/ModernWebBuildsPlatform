import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getRestaurants } from "../api/client";
import RestaurantCard from "../components/restaurant/RestaurantCard";

export default function HomePage() {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getRestaurants()
      .then(setRestaurants)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading restaurants...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div>
      <header className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              <p className="eyebrow">Local. Fresh. Order ahead.</p>
              <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: "clamp(32px, 4vw, 48px)", margin: "12px 0 16px" }}>
                Order from the best restaurants in Hackney
              </h1>
              <p className="lede">
                Click & collect — pay when you pick up. No delivery fees, no hassle. Pre-order from your favourite spots and grab your food when it&apos;s ready.
              </p>
              <div className="hero-actions">
                <a href="#restaurants" className="btn btn-primary">
                  Browse Restaurants
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section id="restaurants" className="menu" style={{ padding: "72px 6vw" }}>
        <div className="container">
          <div className="section-title" style={{ marginBottom: 32, textAlign: "left" }}>
            <p className="eyebrow">Restaurants</p>
            <h2 style={{ fontFamily: '"Fraunces", serif', margin: "12px 0 0" }}>
              Pick your spot
            </h2>
          </div>
          <div className="menu-grid">
            {restaurants.map((r) => (
              <RestaurantCard key={r.id} restaurant={r} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
