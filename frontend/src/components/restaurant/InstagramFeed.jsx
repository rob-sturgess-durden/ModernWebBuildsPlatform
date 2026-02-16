export default function InstagramFeed({ posts = [], handle = null }) {
  const cleanHandle = handle ? String(handle).trim().replace(/^@+/, "") : "";
  const profileUrl = cleanHandle ? `https://www.instagram.com/${cleanHandle}/` : null;

  if ((!posts || posts.length === 0) && !profileUrl) return null;

  return (
    <section className="section" style={{ padding: "48px 6vw 72px" }}>
      <div className="container">
        <div className="section-title" style={{ marginBottom: 18, textAlign: "left" }}>
          <p className="eyebrow">Instagram</p>
          <h2 style={{ fontFamily: '"Fraunces", serif', margin: "10px 0 0" }}>
            Latest posts
          </h2>
        </div>

        {posts && posts.length > 0 ? (
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
        ) : (
          <div className="card" style={{ padding: "18px 20px" }}>
            <p style={{ margin: 0, color: "var(--text-light)" }}>
              Instagram photos are temporarily unavailable (Instagram is rate-limiting the server).
              {profileUrl ? " You can still view the profile below." : null}
            </p>
          </div>
        )}

        {profileUrl && (
          <p style={{ marginTop: 14, color: "var(--text-light)", fontSize: "0.95rem" }}>
            More on{" "}
            <a href={profileUrl} target="_blank" rel="noreferrer">
              @{cleanHandle}
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
