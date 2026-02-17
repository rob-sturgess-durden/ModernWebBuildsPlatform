import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { getOrderStatus, collectOrder, submitReview, getReview } from "../api/client";
import OrderStatus from "../components/order/OrderStatus";

export default function OrderStatusPage() {
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Collect
  const [collecting, setCollecting] = useState(false);

  // Review
  const [review, setReview] = useState(null);
  const [reviewLoaded, setReviewLoaded] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  const fetchOrder = () => {
    getOrderStatus(orderNumber)
      .then(setOrder)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrder();
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

  // Fetch existing review
  useEffect(() => {
    if (!order) return;
    getReview(orderNumber)
      .then((res) => {
        if (res.review) {
          setReview(res.review);
          setRating(res.review.rating);
          setComment(res.review.comment || "");
        }
      })
      .catch(() => {})
      .finally(() => setReviewLoaded(true));
  }, [order?.status]);

  const handleCollect = async () => {
    setCollecting(true);
    try {
      await collectOrder(orderNumber);
      fetchOrder();
    } catch { /* ignore */ }
    setCollecting(false);
  };

  const handleSubmitReview = async () => {
    if (rating < 1) return;
    setSubmittingReview(true);
    try {
      await submitReview(orderNumber, rating, comment);
      setReviewSubmitted(true);
      setReview({ rating, comment });
    } catch { /* ignore */ }
    setSubmittingReview(false);
  };

  if (loading) return <div className="loading">Loading order...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!order) return <div className="error">Order not found</div>;

  const pickupTime = order.pickup_time
    ? new Date(order.pickup_time).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : "";

  const showCollectButton = order.status === "ready";
  const showReview = order.status === "collected" && reviewLoaded;

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

        {/* Mark as Collected button */}
        {showCollectButton && (
          <div style={{
            marginTop: "1.5rem",
            padding: "1.2rem",
            background: "#f0fdf4",
            borderRadius: 12,
            textAlign: "center",
          }}>
            <p style={{ fontWeight: 600, marginBottom: "0.6rem", color: "#166534" }}>
              Have you picked up your order?
            </p>
            <button
              className="btn"
              onClick={handleCollect}
              disabled={collecting}
              style={{
                background: "#38a169",
                color: "#fff",
                fontWeight: 600,
                padding: "0.7rem 1.5rem",
                borderRadius: 8,
                border: "none",
                cursor: collecting ? "wait" : "pointer",
                fontSize: "1rem",
              }}
            >
              {collecting ? "Updating..." : "\u2713 Mark as Collected"}
            </button>
          </div>
        )}

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

        {/* Review widget */}
        {showReview && (
          <div style={{
            marginTop: "1.5rem",
            padding: "1.2rem",
            background: review || reviewSubmitted ? "#f0fdf4" : "#fffbeb",
            borderRadius: 12,
          }}>
            {review || reviewSubmitted ? (
              <div style={{ textAlign: "center" }}>
                <p style={{ fontWeight: 600, marginBottom: "0.5rem", color: "#166534" }}>
                  Thanks for your review!
                </p>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span key={star} style={{ color: star <= rating ? "#f59e0b" : "#d1d5db" }}>
                      {"\u2605"}
                    </span>
                  ))}
                </div>
                {comment && (
                  <p style={{ color: "var(--text-light)", fontSize: "0.9rem", margin: 0 }}>
                    "{comment}"
                  </p>
                )}
              </div>
            ) : (
              <>
                <p style={{ fontWeight: 600, marginBottom: "0.6rem", textAlign: "center" }}>
                  How was your order?
                </p>
                <div style={{ textAlign: "center", marginBottom: "0.75rem" }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <span
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      style={{
                        fontSize: "2rem",
                        cursor: "pointer",
                        color: star <= (hoverRating || rating) ? "#f59e0b" : "#d1d5db",
                        transition: "color 0.15s",
                        padding: "0 2px",
                      }}
                    >
                      {"\u2605"}
                    </span>
                  ))}
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Any feedback? (optional)"
                  rows={2}
                  style={{
                    width: "100%",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    padding: "0.6rem",
                    fontSize: "0.9rem",
                    resize: "vertical",
                    marginBottom: "0.75rem",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ textAlign: "center" }}>
                  <button
                    className="btn"
                    onClick={handleSubmitReview}
                    disabled={submittingReview || rating < 1}
                    style={{
                      background: rating >= 1 ? "#f59e0b" : "#d1d5db",
                      color: "#fff",
                      fontWeight: 600,
                      padding: "0.6rem 1.5rem",
                      borderRadius: 8,
                      border: "none",
                      cursor: rating >= 1 ? "pointer" : "default",
                      fontSize: "0.95rem",
                    }}
                  >
                    {submittingReview ? "Submitting..." : "Submit Review"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

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
