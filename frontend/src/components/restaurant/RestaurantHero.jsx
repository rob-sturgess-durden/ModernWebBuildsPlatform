const HERO_IMAGES = {
  coffee: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&q=80",
  caribbean: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80",
  jamaican: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80",
  english: "https://images.unsplash.com/photo-1533920379810-6bedac961a46?w=1200&q=80",
  breakfast: "https://images.unsplash.com/photo-1533920379810-6bedac961a46?w=1200&q=80",
  default: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&q=80",
};

export default function RestaurantHero({ restaurant }) {
  const bg = getHeroImage(restaurant.cuisine_type);

  return (
    <section
      style={{
        background: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url('${bg}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        padding: "6rem 1.5rem 4rem",
        textAlign: "center",
        color: "#fff",
      }}
    >
      <h1 style={{ fontSize: "2.8rem", fontWeight: 700, marginBottom: "0.8rem", textShadow: "2px 2px 4px rgba(0,0,0,0.5)" }}>
        {restaurant.name}
      </h1>
      <p style={{ fontSize: "1.1rem", maxWidth: 600, margin: "0 auto 1rem", opacity: 0.9 }}>
        {restaurant.cuisine_type}
      </p>
      <p style={{ fontSize: "0.95rem", opacity: 0.8 }}>
        {restaurant.address}
      </p>
    </section>
  );
}

function getHeroImage(cuisine) {
  const lower = cuisine.toLowerCase();
  for (const [key, url] of Object.entries(HERO_IMAGES)) {
    if (key !== "default" && lower.includes(key)) return url;
  }
  return HERO_IMAGES.default;
}
