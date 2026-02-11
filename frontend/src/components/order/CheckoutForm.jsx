import { useState } from "react";
import { useBasket } from "../../context/BasketContext";
import { placeOrder } from "../../api/client";

function generateTimeSlots() {
  const slots = [];
  const now = new Date();
  // Start from 30 mins from now, rounded to next 15-min slot
  const start = new Date(now.getTime() + 30 * 60000);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);

  for (let i = 0; i < 20; i++) {
    const slot = new Date(start.getTime() + i * 15 * 60000);
    if (slot.getHours() >= 22) break; // cap at 10pm
    slots.push(slot);
  }
  return slots;
}

function formatTime(date) {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function CheckoutForm({ onSuccess, onCancel }) {
  const { basket, subtotal, clearBasket } = useBasket();
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    pickup_time: "",
    special_instructions: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const timeSlots = generateTimeSlots();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_name || !form.customer_phone || !form.pickup_time) {
      setError("Please fill in name, phone, and pickup time");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const order = await placeOrder({
        restaurant_id: basket.restaurantId,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email || null,
        pickup_time: form.pickup_time,
        special_instructions: form.special_instructions || null,
        items: basket.items.map((i) => ({
          menu_item_id: i.id,
          quantity: i.quantity,
        })),
      });
      clearBasket();
      onSuccess(order);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 500, margin: "0 auto" }}>
      <h3 style={{ fontSize: "1.3rem", fontWeight: 600, marginBottom: "1.5rem" }}>Checkout</h3>

      {error && <div className="error" style={{ marginBottom: "1rem" }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Name *</label>
          <input
            value={form.customer_name}
            onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
            placeholder="Your name"
            required
          />
        </div>

        <div className="form-group">
          <label>Phone *</label>
          <input
            type="tel"
            value={form.customer_phone}
            onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
            placeholder="+44 7700 900000"
            required
          />
        </div>

        <div className="form-group">
          <label>Email (optional)</label>
          <input
            type="email"
            value={form.customer_email}
            onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
            placeholder="your@email.com"
          />
        </div>

        <div className="form-group">
          <label>Pickup Time *</label>
          <select
            value={form.pickup_time}
            onChange={(e) => setForm({ ...form, pickup_time: e.target.value })}
            required
          >
            <option value="">Select a time</option>
            {timeSlots.map((slot) => (
              <option key={slot.toISOString()} value={slot.toISOString()}>
                {formatTime(slot)}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Special Instructions</label>
          <textarea
            value={form.special_instructions}
            onChange={(e) => setForm({ ...form, special_instructions: e.target.value })}
            placeholder="Any allergies or special requests?"
            rows={3}
          />
        </div>

        <div style={{ borderTop: "1px solid #eee", paddingTop: "1rem", marginTop: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "1.1rem", marginBottom: "1rem" }}>
            <span>Total</span>
            <span>£{subtotal.toFixed(2)}</span>
          </div>
          <p style={{ color: "var(--text-light)", fontSize: "0.85rem", marginBottom: "1rem" }}>
            Pay at the restaurant when you collect your order.
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
              {submitting ? "Placing Order..." : "Place Order"}
            </button>
            <button type="button" className="btn btn-outline" onClick={onCancel}>
              Back
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
