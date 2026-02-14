export default function RestaurantHero({ restaurant }) {
  const heroStyle = restaurant.banner_url
    ? {
        backgroundImage: `linear-gradient(120deg, rgba(27,27,27,0.82), rgba(27,27,27,0.45)), url(${restaurant.banner_url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  return (
    <header className="restaurant-banner" style={heroStyle}>
      <div className="container">
        <div className="restaurant-banner-inner">
          <div className="restaurant-identity">
            {restaurant.logo_url ? (
              <img
                className="restaurant-logo restaurant-logo--hero"
                src={restaurant.logo_url}
                alt={`${restaurant.name} logo`}
                loading="eager"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="restaurant-logo restaurant-logo--hero restaurant-logo--fallback">
                {restaurant.name?.slice(0, 1)?.toUpperCase()}
              </div>
            )}
            <div className="restaurant-banner-text">
              <h1>{restaurant.name}</h1>
              <p className="restaurant-banner-sub">{restaurant.cuisine_type}</p>
            </div>
          </div>

          <a className="powered-by" href="https://modernwebbuilds.co.uk/" target="_blank" rel="noreferrer">
            Powered by <strong>ForkIt</strong>
          </a>
        </div>
      </div>
    </header>
  );
}
