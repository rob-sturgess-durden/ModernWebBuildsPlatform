import { Link } from "react-router-dom";

export default function RestaurantCard({ restaurant }) {
  const hasBanner = !!restaurant.banner_url;

  return (
    <Link to={`/${restaurant.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
      <article className="menu-card" style={{ padding: 0, overflow: "hidden" }}>
        {/* Banner background */}
        <div
          style={{
            position: "relative",
            height: 140,
            background: hasBanner
              ? `linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.45)), url(${restaurant.banner_url}) center/cover no-repeat`
              : "linear-gradient(135deg, var(--accent), var(--burnt, #c4501a))",
            display: "flex",
            alignItems: "flex-end",
            padding: "16px",
          }}
        >
          {/* Logo overlay */}
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={`${restaurant.name} logo`}
              loading="lazy"
              referrerPolicy="no-referrer"
              style={{
                width: 52,
                height: 52,
                objectFit: "contain",
                borderRadius: 10,
                background: "white",
                padding: 3,
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
            />
          ) : (
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 10,
                background: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
              aria-hidden="true"
            >
              {getCuisineEmoji(restaurant.cuisine_type)}
            </div>
          )}
        </div>

        {/* Text content */}
        <div style={{ padding: "14px 18px 18px" }}>
          <h3>{restaurant.name}</h3>
          <p style={{ color: "var(--text-light)", fontSize: "0.9rem", margin: 0 }}>
            {restaurant.cuisine_type.split("(")[0].trim()}
          </p>
          <p style={{ color: "var(--meta)", fontSize: "0.85rem", margin: "4px 0 0" }}>
            {restaurant.address}
          </p>
        </div>
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
