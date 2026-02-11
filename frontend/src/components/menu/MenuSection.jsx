import MenuItem from "./MenuItem";

export default function MenuSection({ category, onAddItem }) {
  return (
    <div style={{ marginBottom: "2.5rem" }}>
      <h3 style={{ fontSize: "1.4rem", fontWeight: 600, marginBottom: "1rem", color: "var(--text)" }}>
        {category.name}
      </h3>
      <div className="grid grid-2">
        {category.items.map((item) => (
          <MenuItem key={item.id} item={item} onAdd={() => onAddItem(item)} />
        ))}
      </div>
    </div>
  );
}
