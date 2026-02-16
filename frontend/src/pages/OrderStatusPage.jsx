import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getOrderStatus } from "../api/client";
import OrderStatus from "../components/order/OrderStatus";

export default function OrderStatusPage() {
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrder = () => {
    getOrderStatus(orderNumber)
      .then(setOrder)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrder();
    // Poll every 30 seconds for status updates
    const interval = setInterval(fetchOrder, 30000);
    return () => clearInterval(interval);
  }, [orderNumber]);

  // Save last order to localStorage for reorder feature
  useEffect(() => {
    if (!order || !order.items?.length) return;
    try {
      localStorage.setItem("forkit_last_order", JSON.stringify({
        restaurant_id: order.restaurant_id,
        restaurant_slug: order.restaurant_slug || "",
        restaurant_name: order.restaurant_name || "",
        items: order.items.map((i) => ({ id: i.menu_item_id, name: i.item_name, price: i.unit_price, quantity: i.quantity })),
        subtotal: order.subtotal,
        order_number: order.order_number,
        created_at: order.created_at,
      }));
    } catch { /* ignore */ }
  }, [order]);

  if (loading) return <div className="loading">Loading order...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!order) return <div className="error">Order not found</div>;

  const pickupTime = order.pickup_time
    ? new Date(order.pickup_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className="container section">
      <div className="contact-card" style={{ maxWidth: 600, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>
            {order.status === "collected" ? "\u2705" : order.status === "cancelled" ? "\u274C" : "\uD83D\uDCE6"}
          </div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Order {order.order_number}</h2>
          <p style={{ color: "var(--text-light)" }}>{order.restaurant_name}</p>
        </div>

        <OrderStatus order={order} />

        <div style={{ borderTop: "1px solid #eee", paddingTop: "1.5rem", marginTop: "1rem" }}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "1rem" }}>Order Details</h3>

          {order.items.map((item) => (
            <div
              key={item.id}
              style={{ display: "flex", justifyContent: "space-between", padding: "0.4rem 0" }}
            >
              <span>
                {item.quantity}x {item.item_name}
              </span>
              <span style={{ fontWeight: 500 }}>£{(item.unit_price * item.quantity).toFixed(2)}</span>
            </div>
          ))}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 700,
              fontSize: "1.1rem",
              borderTop: "1px solid #eee",
              paddingTop: "0.8rem",
              marginTop: "0.8rem",
            }}
          >
            <span>Total</span>
            <span>£{order.subtotal.toFixed(2)}</span>
          </div>
        </div>

        {pickupTime && (
          <div style={{ marginTop: "1.5rem", padding: "1rem", background: "var(--bg)", borderRadius: 10 }}>
            <strong>Pickup Time:</strong> {pickupTime}
          </div>
        )}

        {order.special_instructions && (
          <div style={{ marginTop: "0.8rem", padding: "1rem", background: "var(--bg)", borderRadius: 10 }}>
            <strong>Notes:</strong> {order.special_instructions}
          </div>
        )}

        <p style={{ color: "var(--text-light)", fontSize: "0.85rem", marginTop: "1rem", textAlign: "center" }}>
          Pay at the restaurant when you collect your order.
        </p>

        {order.notification_whatsapp && order.status !== "collected" && order.status !== "cancelled" && (
          <div style={{
            marginTop: "1.5rem",
            padding: "1rem 1.2rem",
            background: "#dcfce7",
            borderRadius: 12,
            textAlign: "center",
          }}>
            <p style={{ fontWeight: 600, marginBottom: "0.6rem", color: "#166534" }}>
              Get order updates on WhatsApp
            </p>
            <p style={{ fontSize: "0.85rem", color: "#15803d", marginBottom: "0.8rem" }}>
              Tap below to receive live updates when your order is confirmed and ready to collect.
            </p>
            <a
              href={`https://wa.me/${order.notification_whatsapp.replace("+", "")}?text=${encodeURIComponent(
                `Hi! Please send me WhatsApp updates for my order ${order.order_number}. Thanks!`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-sm"
              style={{
                background: "#25D366",
                color: "#fff",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.6rem 1.2rem",
                borderRadius: 8,
              }}
            >
              <i className="fab fa-whatsapp" style={{ fontSize: "1.2rem" }} />
              Receive updates on WhatsApp
            </a>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <Link to="/restaurants" className="btn btn-secondary">
            Back to Restaurants
          </Link>
        </div>
      </div>
    </div>
  );
}
