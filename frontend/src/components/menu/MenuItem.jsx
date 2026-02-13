const TAG_CLASSES = {
  vegetarian: "badge-vegetarian",
  vegan: "badge-vegan",
  halal: "badge-halal",
  "gluten-free": "badge-gluten-free",
};

export default function MenuItem({ item, onAdd }) {
  return (
    <article className="menu-card menu-item-card">
      {item.image_url && (
        <div className="menu-item-media">
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontSize: "1.05rem", marginBottom: 8 }}>{item.name}</h3>
        {item.description && (
          <p style={{ color: "var(--text-light)", fontSize: "0.9rem", marginBottom: 8, lineHeight: 1.5 }}>
            {item.description}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
          {item.dietary_tags?.map((tag) => (
            <span key={tag} className={`badge ${TAG_CLASSES[tag] || ""}`}>
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        <span style={{ fontWeight: 700, color: "var(--burnt)", whiteSpace: "nowrap" }}>
          £{item.price.toFixed(2)}
        </span>
        <button className="btn btn-olive btn-sm btn-pill" onClick={onAdd}>
          Add
        </button>
      </div>
    </article>
  );
}
