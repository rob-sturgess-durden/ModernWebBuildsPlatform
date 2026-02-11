const STEPS = ["pending", "confirmed", "ready", "collected"];

const STEP_LABELS = {
  pending: "Order Placed",
  confirmed: "Confirmed",
  ready: "Ready",
  collected: "Collected",
};

export default function OrderStatus({ order }) {
  const currentIndex = STEPS.indexOf(order.status);
  const isCancelled = order.status === "cancelled";

  return (
    <div>
      {isCancelled ? (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>&#10060;</div>
          <h3 style={{ color: "#ef4444" }}>Order Cancelled</h3>
          <p style={{ color: "var(--text-light)", marginTop: "0.5rem" }}>
            Please contact the restaurant for details.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "1.5rem 0" }}>
          {STEPS.map((step, i) => (
            <div key={step} style={{ textAlign: "center", flex: 1, position: "relative" }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: i <= currentIndex ? "var(--primary)" : "#e2e8f0",
                  color: i <= currentIndex ? "#fff" : "var(--text-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 0.5rem",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                }}
              >
                {i <= currentIndex ? "\u2713" : i + 1}
              </div>
              <div style={{
                fontSize: "0.8rem",
                fontWeight: i === currentIndex ? 700 : 400,
                color: i <= currentIndex ? "var(--text)" : "var(--text-light)",
              }}>
                {STEP_LABELS[step]}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    top: 18,
                    left: "calc(50% + 22px)",
                    right: "calc(-50% + 22px)",
                    height: 3,
                    background: i < currentIndex ? "var(--primary)" : "#e2e8f0",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
