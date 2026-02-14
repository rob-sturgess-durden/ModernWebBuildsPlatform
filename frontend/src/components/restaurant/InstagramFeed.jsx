export default function InstagramFeed({ posts = [], handle = null }) {
  if (!posts || posts.length === 0) return null;

  const profileUrl = handle ? `https://www.instagram.com/${handle.replace("@", "")}/` : null;

  return (
    <section className="section" style={{ padding: "48px 6vw 72px" }}>
      <div className="container">
        <div className="section-title" style={{ marginBottom: 18, textAlign: "left" }}>
          <p className="eyebrow">Instagram</p>
          <h2 style={{ fontFamily: '"Fraunces", serif', margin: "10px 0 0" }}>
            Latest posts
          </h2>
        </div>

        <div className="ig-grid">
          {posts.slice(0, 8).map((p) => (
            <a
              key={p.id || p.shortcode}
              className="ig-card"
              href={p.permalink}
              target="_blank"
              rel="noreferrer"
              aria-label={p.caption ? `Instagram post: ${p.caption}` : "Instagram post"}
              title={p.caption || "Instagram post"}
            >
              {p.media_url ? (
                <img loading="lazy" src={p.media_url} alt={p.caption || "Instagram post"} referrerPolicy="no-referrer" />
              ) : (
                <div className="ig-fallback">IG</div>
              )}
              <span className="ig-overlay">
                <span className="ig-pill">View</span>
              </span>
            </a>
          ))}
        </div>

        {profileUrl && (
          <p style={{ marginTop: 14, color: "var(--text-light)", fontSize: "0.95rem" }}>
            More on{" "}
            <a href={profileUrl} target="_blank" rel="noreferrer">
              {handle}
            </a>
          </p>
        )}
      </div>
    </section>
  );
}

