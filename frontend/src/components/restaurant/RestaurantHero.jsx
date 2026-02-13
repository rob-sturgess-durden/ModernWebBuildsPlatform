export default function RestaurantHero({ restaurant }) {
  const cuisineShort = restaurant.cuisine_type.split("(")[0].trim();
  const heroStyle = restaurant.banner_url
    ? {
        backgroundImage: `linear-gradient(120deg, rgba(27,27,27,0.88), rgba(27,27,27,0.55)), url(${restaurant.banner_url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  return (
    <header className="hero restaurant-hero" style={heroStyle}>
      <div className="container">
        <div className="hero-content">
          <div className="hero-text">
            <p className="eyebrow">{cuisineShort}</p>
            <div className="restaurant-identity">
              {restaurant.logo_url && (
                <img
                  className="restaurant-logo restaurant-logo--hero"
                  src={restaurant.logo_url}
                  alt={`${restaurant.name} logo`}
                  loading="eager"
                  referrerPolicy="no-referrer"
                />
              )}
              <h1 style={{ fontFamily: '"Fraunces", serif', fontSize: "clamp(32px, 4vw, 48px)", margin: "12px 0 16px" }}>
                {restaurant.name}
              </h1>
            </div>
            <p className="lede">{restaurant.cuisine_type}</p>
            <div className="hero-meta">
              <div>
                <p className="meta-title">Find us</p>
                <p>{restaurant.address}</p>
              </div>
            </div>
          </div>
          <div className="hero-card">
            <div className="card-header">
              <p className="eyebrow">Ready to order?</p>
              <h3 style={{ fontFamily: '"Fraunces", serif', margin: "8px 0 12px" }}>
                Click &amp; collect
              </h3>
            </div>
            <p style={{ color: "var(--text-light)", lineHeight: 1.5, marginBottom: 16 }}>
              Add items to your basket, choose a pickup time, and pay when you collect. No delivery fees.
            </p>
            <a href="#menu" className="btn btn-olive btn-pill" style={{ display: "inline-block" }}>
              View Menu
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
