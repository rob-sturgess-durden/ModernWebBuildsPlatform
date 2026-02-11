import { useBasket } from "../../context/BasketContext";

export default function Basket({ onCheckout }) {
  const { basket, removeItem, updateQuantity, clearBasket, subtotal } = useBasket();

  if (basket.items.length === 0) return null;

  return (
    <div className="card" style={{ position: "sticky", top: 80 }}>
      <h3 style={{ fontSize: "1.2rem", fontWeight: 600, marginBottom: "1rem" }}>Your Basket</h3>

      {basket.items.map((item) => (
        <div
          key={item.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.6rem 0",
            borderBottom: "1px solid #eee",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: "0.9rem" }}>{item.name}</div>
            <div style={{ color: "var(--text-light)", fontSize: "0.8rem" }}>
              £{item.price.toFixed(2)} each
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              className="btn btn-outline btn-sm"
              style={{ padding: "0.2rem 0.5rem", minWidth: 28 }}
              onClick={() => removeItem(item.id)}
            >
              -
            </button>
            <span style={{ fontWeight: 600, minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
            <button
              className="btn btn-outline btn-sm"
              style={{ padding: "0.2rem 0.5rem", minWidth: 28 }}
              onClick={() => updateQuantity(item.id, item.quantity + 1)}
            >
              +
            </button>
          </div>
          <div style={{ fontWeight: 600, minWidth: 60, textAlign: "right" }}>
            £{(item.price * item.quantity).toFixed(2)}
          </div>
        </div>
      ))}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "1rem 0 0.5rem",
          fontWeight: 700,
          fontSize: "1.1rem",
        }}
      >
        <span>Total</span>
        <span>£{subtotal.toFixed(2)}</span>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={onCheckout}>
          Checkout
        </button>
        <button className="btn btn-outline btn-sm" onClick={clearBasket}>
          Clear
        </button>
      </div>
    </div>
  );
}
