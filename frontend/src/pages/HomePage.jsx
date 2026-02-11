import { useState, useEffect } from "react";
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
      <section
        style={{
          background: "var(--header-bg)",
          color: "#fff",
          textAlign: "center",
          padding: "4rem 1.5rem 3rem",
        }}
      >
        <h1 style={{ fontSize: "2.5rem", fontWeight: 700, marginBottom: "0.8rem" }}>
          Hackney Eats
        </h1>
        <p style={{ fontSize: "1.1rem", opacity: 0.9, maxWidth: 500, margin: "0 auto" }}>
          Order from the best local restaurants in Hackney. Click &amp; collect - pay at pickup.
        </p>
      </section>

      <div className="container section">
        <h2 className="section-title">Restaurants</h2>
        <div className="grid grid-3">
          {restaurants.map((r) => (
            <RestaurantCard key={r.id} restaurant={r} />
          ))}
        </div>
      </div>
    </div>
  );
}
