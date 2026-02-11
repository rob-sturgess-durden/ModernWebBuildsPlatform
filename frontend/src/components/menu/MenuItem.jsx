const TAG_CLASSES = {
  vegetarian: "badge-vegetarian",
  vegan: "badge-vegan",
  halal: "badge-halal",
  "gluten-free": "badge-gluten-free",
};

export default function MenuItem({ item, onAdd }) {
  return (
    <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
      <div style={{ flex: 1 }}>
        <h4 style={{ fontSize: "1.05rem", fontWeight: 600, marginBottom: "0.3rem" }}>{item.name}</h4>
        {item.description && (
          <p style={{ color: "var(--text-light)", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
            {item.description}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
          {item.dietary_tags.map((tag) => (
            <span key={tag} className={`badge ${TAG_CLASSES[tag] || ""}`}>
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: "1.1rem", marginBottom: "0.5rem" }}>
          £{item.price.toFixed(2)}
        </div>
        <button className="btn btn-primary btn-sm" onClick={onAdd}>
          Add
        </button>
      </div>
    </div>
  );
}
