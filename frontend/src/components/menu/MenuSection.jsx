import MenuItem from "./MenuItem";

export default function MenuSection({ category, onAddItem }) {
  return (
    <div style={{ marginBottom: "2.5rem" }}>
      <h3
        style={{
          fontFamily: '"Fraunces", serif',
          fontSize: "1.35rem",
          fontWeight: 600,
          marginBottom: "1rem",
          color: "var(--ink)",
        }}
      >
        {category.name}
      </h3>
      <div className="menu-grid">
        {category.items.map((item) => (
          <MenuItem key={item.id} item={item} onAdd={() => onAddItem(item)} />
        ))}
      </div>
    </div>
  );
}
