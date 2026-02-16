import { useState, useEffect } from "react";
import { marketingSignup, checkVerified, sendVerificationCode, verifyCode } from "../../api/client";

function stripPhonePrefix(phone) {
  let s = String(phone || "");
  if (s.startsWith("+44")) s = s.slice(3);
  else if (s.startsWith("44") && s.length > 10) s = s.slice(2);
  if (s.startsWith("0")) s = s.slice(1);
  return s;
}

function normalizePhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("44") && digits.length > 10) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+44${digits.slice(1)}`;
  return `+44${digits}`;
}

export default function DealsSignup({ restaurant }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Registration / verification state
  const [registered, setRegistered] = useState(false);
  const [savedCustomer, setSavedCustomer] = useState(null);
  const [editing, setEditing] = useState(false);

  // Verification flow
  const [needsVerify, setNeedsVerify] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  // Load saved customer on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("forkit_customer");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.verified) {
        setSavedCustomer(parsed);
        setRegistered(true);
        setName(parsed.name || "");
        setEmail(parsed.email || "");
        setPhone(stripPhonePrefix(parsed.phone));
      }
    } catch { /* ignore */ }
  }, []);

  const fullPhone = normalizePhone(phone);
  const cleanEmail = email.trim();
  const verifyTarget = cleanEmail || fullPhone;
  const verifyChannelLabel = cleanEmail ? "email" : "SMS";

  const saveToLocalStorage = (isVerified) => {
    const data = {
      name: name.trim(),
      phone: fullPhone,
      email: cleanEmail,
      verified: isVerified,
      deals_optin: true,
    };
    try { localStorage.setItem("forkit_customer", JSON.stringify(data)); } catch { /* ignore */ }
    setSavedCustomer(data);
  };

  const handleSendCode = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      await sendVerificationCode(fullPhone, cleanEmail);
      setCodeSent(true);
    } catch (err) {
      setVerifyError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyCode = async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await verifyCode(fullPhone, cleanEmail, codeInput);
      if (result.verified) {
        saveToLocalStorage(true);
        setRegistered(true);
        setNeedsVerify(false);
        setEditing(false);
      } else {
        setVerifyError("Incorrect code. Please try again.");
      }
    } catch (err) {
      setVerifyError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!cleanEmail && !phone.trim()) {
      setError("Enter at least an email or mobile number.");
      return;
    }

    if (phone.trim() && fullPhone.length < 12) {
      setError("Please enter a valid UK mobile number.");
      return;
    }

    setLoading(true);
    try {
      await marketingSignup({
        restaurant_id: restaurant?.id || null,
        name: name.trim(),
        email: cleanEmail,
        phone: fullPhone,
      });

      // Check if already verified
      const result = await checkVerified(fullPhone, cleanEmail);
      if (result.verified) {
        saveToLocalStorage(true);
        setRegistered(true);
        setEditing(false);
      } else {
        saveToLocalStorage(false);
        setNeedsVerify(true);
      }
    } catch (err) {
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditing(true);
    setRegistered(false);
    setNeedsVerify(false);
    setCodeSent(false);
    setCodeInput("");
    setVerifyError(null);
  };

  // Registered state
  if (registered && !editing) {
    return (
      <section className="section" style={{ padding: "24px 6vw 0" }}>
        <div className="container">
          <div className="card signup-card">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <i className="fas fa-check-circle" style={{ color: "#38a169", fontSize: "1.1rem" }} />
                  <span style={{ fontWeight: 700, fontSize: "1.05rem" }}>Registered for ForkIt</span>
                </div>
                <p style={{ margin: 0, color: "var(--text-light)", fontSize: "0.9rem" }}>
                  {savedCustomer?.name && <span>{savedCustomer.name}</span>}
                  {savedCustomer?.email && <span> &middot; {savedCustomer.email}</span>}
                  {savedCustomer?.phone && <span> &middot; {savedCustomer.phone}</span>}
                </p>
              </div>
              <button
                type="button"
                onClick={handleEdit}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "0.85rem" }}
              >
                Edit details
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Verification step (after signup, before registered)
  if (needsVerify) {
    return (
      <section className="section" style={{ padding: "24px 6vw 0" }}>
        <div className="container">
          <div className="card signup-card">
            <div className="signup-card__text">
              <p className="eyebrow">Almost there</p>
              <h3 style={{ fontFamily: '"Fraunces", serif', margin: "8px 0 6px" }}>
                Verify your details
              </h3>
            </div>
            <div className="signup-card__form">
              {verifyError && (
                <p style={{ color: "#e53e3e", fontSize: "0.85rem", marginBottom: "0.75rem" }}>{verifyError}</p>
              )}

              {!codeSent ? (
                <>
                  <p style={{ color: "var(--text-light)", fontSize: "0.9rem", marginBottom: "0.75rem" }}>
                    We'll send a 4-digit code to <strong>{verifyTarget}</strong> via {verifyChannelLabel}.
                  </p>
                  <button
                    type="button"
                    className="btn btn-burnt btn-pill"
                    onClick={handleSendCode}
                    disabled={verifying}
                  >
                    {verifying ? "Sending..." : `Send code via ${verifyChannelLabel}`}
                  </button>
                </>
              ) : (
                <>
                  <p style={{ color: "var(--text-light)", fontSize: "0.9rem", marginBottom: "0.75rem" }}>
                    We sent a code to <strong>{verifyTarget}</strong>. Enter it below.
                  </p>
                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="1234"
                      autoFocus
                      style={{
                        textAlign: "center",
                        fontSize: "1.3rem",
                        letterSpacing: "0.3em",
                        fontWeight: 700,
                        width: 140,
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-burnt btn-pill"
                      onClick={handleVerifyCode}
                      disabled={verifying || codeInput.length < 4}
                    >
                      {verifying ? "Checking..." : "Verify"}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setCodeSent(false); setCodeInput(""); setVerifyError(null); }}
                    style={{
                      background: "none", border: "none", color: "var(--accent)",
                      cursor: "pointer", fontSize: "0.85rem", marginTop: "0.75rem",
                      textDecoration: "underline", padding: 0,
                    }}
                  >
                    Resend code
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Default: signup form
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
              Get occasional discounts and updates. Enter at least one of email or mobile.
            </p>
          </div>

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
                <label>Mobile</label>
                <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                  <span
                    style={{
                      padding: "0.6rem 0.7rem",
                      background: "var(--bg-soft, #f5f5f5)",
                      border: "1px solid var(--border, #ddd)",
                      borderRight: "none",
                      borderRadius: "8px 0 0 8px",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: "var(--text-light)",
                      whiteSpace: "nowrap",
                      lineHeight: 1.4,
                    }}
                  >
                    +44
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
                    placeholder="7700 900000"
                    style={{ borderRadius: "0 8px 8px 0", borderLeft: "none" }}
                  />
                </div>
              </div>
            </div>

            {error && <p style={{ margin: "10px 0 0", color: "#b91c1c", fontSize: "0.9rem" }}>{error}</p>}

            <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn btn-burnt btn-pill" type="submit" disabled={loading}>
                {loading ? "Signing up..." : "Sign up"}
              </button>
              <p style={{ margin: 0, color: "var(--text-light)", fontSize: "0.85rem" }}>
                No spam. Unsubscribe anytime.
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
