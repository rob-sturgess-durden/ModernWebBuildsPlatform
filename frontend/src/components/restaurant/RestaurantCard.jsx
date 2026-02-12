import { Link } from "react-router-dom";

export default function RestaurantCard({ restaurant }) {
  return (
    <Link to={`/${restaurant.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
      <article className="menu-card">
        <div style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>
          {getCuisineEmoji(restaurant.cuisine_type)}
        </div>
        <h3>{restaurant.name}</h3>
        <p style={{ color: "var(--text-light)", fontSize: "0.9rem", margin: 0 }}>
          {restaurant.cuisine_type.split("(")[0].trim()}
        </p>
        <p style={{ color: "var(--meta)", fontSize: "0.85rem", margin: 0 }}>
          {restaurant.address}
        </p>
      </article>
    </Link>
  );
}

function getCuisineEmoji(cuisine) {
  const lower = cuisine.toLowerCase();
  if (lower.includes("coffee")) return "\u2615";
  if (lower.includes("caribbean") || lower.includes("jamaican") || lower.includes("jerk")) return "\uD83D\uDD25";
  if (lower.includes("english") || lower.includes("breakfast")) return "\uD83C\uDF73";
  if (lower.includes("halal") || lower.includes("mediterranean")) return "\uD83E\uDD5A";
  return "\uD83C\uDF7D\uFE0F";
}
