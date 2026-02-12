import { useBasket } from "../../context/BasketContext";

export default function Basket({ onCheckout }) {
  const { basket, removeItem, updateQuantity, clearBasket, subtotal } = useBasket();

  if (basket.items.length === 0) return null;

  return (
    <div className="hero-card" style={{ position: "sticky", top: 100 }}>
      <div className="card-header">
        <h3 style={{ fontFamily: '"Fraunces", serif', margin: "0 0 16px" }}>Your basket</h3>
      </div>

      {basket.items.map((item) => (
        <div
          key={item.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.75rem 0",
            borderBottom: "1px solid #eee",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500, fontSize: "0.95rem" }}>{item.name}</div>
            <div style={{ color: "var(--text-light)", fontSize: "0.85rem" }}>
              £{item.price.toFixed(2)} each
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ padding: "0.25rem 0.6rem", minWidth: 32 }}
              onClick={() => removeItem(item.id)}
            >
              −
            </button>
            <span style={{ fontWeight: 600, minWidth: 24, textAlign: "center" }}>{item.quantity}</span>
            <button
              className="btn btn-secondary btn-sm"
              style={{ padding: "0.25rem 0.6rem", minWidth: 32 }}
              onClick={() => updateQuantity(item.id, item.quantity + 1)}
            >
              +
            </button>
          </div>
          <div style={{ fontWeight: 700, minWidth: 60, textAlign: "right", color: "var(--burnt)" }}>
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
          borderTop: "1px solid #eee",
          marginTop: "0.5rem",
        }}
      >
        <span>Total</span>
        <span>£{subtotal.toFixed(2)}</span>
      </div>

      <div className="card-footer" style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
        <button className="btn btn-olive btn-pill" style={{ flex: 1 }} onClick={onCheckout}>
          Checkout
        </button>
        <button className="btn btn-secondary btn-sm" onClick={clearBasket}>
          Clear
        </button>
      </div>
    </div>
  );
}
