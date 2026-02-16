import { useState } from "react";
import { marketingSignup } from "../../api/client";

export default function DealsSignup({ restaurant }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim();
    const cleanPhone = phone.trim();
    if (!cleanEmail && !cleanPhone) {
      setError("Enter at least an email or phone number.");
      return;
    }

    setLoading(true);
    try {
      await marketingSignup({
        restaurant_id: restaurant?.id || null,
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
      });
      setOk(true);
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="section" style={{ padding: "24px 6vw 0" }}>
      <div className="container">
        <div className="card signup-card">
          <div className="signup-card__text">
            <p className="eyebrow">Deals</p>
            <h3 style={{ fontFamily: '"Fraunces", serif', margin: "8px 0 6px" }}>
              Sign up for deals and offers
            </h3>
            <p style={{ margin: 0, color: "var(--text-light)" }}>
              Get occasional discounts and updates. Enter at least one of email or phone.
            </p>
          </div>

          {ok ? (
            <div className="signup-card__form">
              <div className="badge status-ready" style={{ display: "inline-block" }}>Thanks, you’re signed up.</div>
            </div>
          ) : (
            <form className="signup-card__form" onSubmit={submit}>
              <div className="signup-grid">
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Phone</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44…" />
                </div>
              </div>

              {error && <p style={{ margin: "10px 0 0", color: "#b91c1c", fontSize: "0.9rem" }}>{error}</p>}

              <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button className="btn btn-burnt btn-pill" type="submit" disabled={loading}>
                  {loading ? "Signing up…" : "Sign up"}
                </button>
                <p style={{ margin: 0, color: "var(--text-light)", fontSize: "0.85rem" }}>
                  No spam. Unsubscribe anytime.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

