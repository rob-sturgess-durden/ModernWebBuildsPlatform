import { useEffect, useState } from "react";
import { useBasket } from "../../context/BasketContext";
import { marketingSignup, placeOrder, checkVerified, sendVerificationCode, verifyCode } from "../../api/client";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function _pad2(n) {
  const s = String(n ?? "");
  return s.length === 1 ? `0${s}` : s;
}

function _ceilTo15(date) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  const next = Math.ceil(m / 15) * 15;
  d.setMinutes(next, 0, 0);
  return d;
}

function _parseHHMM(s) {
  const raw = String(s || "").trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  return { hh, mm };
}

function _setTime(baseDate, hhmm) {
  const d = new Date(baseDate);
  d.setHours(hhmm.hh, hhmm.mm, 0, 0);
  return d;
}

function _normalizeOpeningHours(openingHours) {
  if (!openingHours || typeof openingHours !== "object") return null;
  const out = {};
  for (const k of Object.keys(openingHours)) out[String(k).toLowerCase()] = openingHours[k];
  return out;
}

function generateTimeSlots({ openingHours = null, bufferMinutes = 30, daysAhead = 3, limit = 60 } = {}) {
  const slots = [];
  const now = new Date();
  const earliest = new Date(now.getTime() + bufferMinutes * 60000);
  const oh = _normalizeOpeningHours(openingHours);

  // If no opening hours configured, fall back to "next 20 slots" from earliest.
  if (!oh) {
    let start = _ceilTo15(earliest);
    for (let i = 0; i < 20; i++) {
      slots.push(new Date(start.getTime() + i * 15 * 60000));
    }
    return slots;
  }

  for (let dayOffset = 0; dayOffset <= daysAhead; dayOffset++) {
    const day = new Date(now);
    day.setDate(now.getDate() + dayOffset);
    day.setHours(0, 0, 0, 0);

    const key = DAY_KEYS[day.getDay()];
    const intervals = Array.isArray(oh[key]) ? oh[key] : [];

    for (const it of intervals) {
      const openHHMM = _parseHHMM(it?.open);
      const closeHHMM = _parseHHMM(it?.close);
      if (!openHHMM || !closeHHMM) continue;

      let openAt = _setTime(day, openHHMM);
      let closeAt = _setTime(day, closeHHMM);
      // Support overnight intervals (e.g. 18:00–02:00)
      if (closeAt <= openAt) closeAt = new Date(closeAt.getTime() + 24 * 60 * 60000);

      // Start from the later of (open time) or (earliest pickup time).
      let start = openAt;
      if (start < earliest) start = new Date(earliest);
      start = _ceilTo15(start);

      // Generate 15-min slots within [start, closeAt]
      for (let t = start; t <= closeAt; t = new Date(t.getTime() + 15 * 60000)) {
        if (t < openAt) continue;
        if (t > closeAt) break;
        slots.push(new Date(t));
        if (slots.length >= limit) return slots;
      }
    }
  }

  return slots;
}

function formatTime(date) {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatSlotLabel(slot) {
  const now = new Date();
  const a = new Date(now); a.setHours(0, 0, 0, 0);
  const b = new Date(slot); b.setHours(0, 0, 0, 0);
  const diffDays = Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60000));

  if (diffDays === 0) return `Today ${formatTime(slot)}`;
  if (diffDays === 1) return `Tomorrow ${formatTime(slot)}`;
  const day = slot.toLocaleDateString("en-GB", { weekday: "short" });
  return `${day} ${formatTime(slot)}`;
}

export default function CheckoutForm({ restaurant = null, onSuccess, onCancel }) {
  const { basket, subtotal, clearBasket } = useBasket();
  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    pickup_time: "",
    special_instructions: "",
    sms_optin: false,
  });
  const [rememberMe, setRememberMe] = useState(true);
  const [dealsOptIn, setDealsOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Verification state
  const [verified, setVerified] = useState(null); // null = unchecked, true/false
  const [codeSent, setCodeSent] = useState(false);
  const [codeChannel, setCodeChannel] = useState(null); // "email" | "sms"
  const [codeInput, setCodeInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  const cookieGet = (name) => {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\]^{|}]/g, "\\$&")}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : "";
  };

  const cookieSet = (name, value, days = 90) => {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
  };

  const cookieDel = (name) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  };

  const normalizePhone = (raw) => {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";
    // Strip leading 0 or 44 if user pasted a full number
    if (digits.startsWith("44") && digits.length > 10) return `+${digits}`;
    if (digits.startsWith("0") && digits.length === 11) return `+44${digits.slice(1)}`;
    return `+44${digits}`;
  };

  useEffect(() => {
    try {
      const raw = cookieGet("forkit_customer");
      if (!raw) return;
      const parsed = JSON.parse(atob(raw));
      if (!parsed || typeof parsed !== "object") return;
      // Strip +44 prefix from stored phone so input shows local part only
      let savedPhone = typeof parsed.phone === "string" ? parsed.phone : "";
      if (savedPhone.startsWith("+44")) savedPhone = savedPhone.slice(3);
      if (savedPhone.startsWith("44") && savedPhone.length > 10) savedPhone = savedPhone.slice(2);
      if (savedPhone.startsWith("0")) savedPhone = savedPhone.slice(1);
      setForm((f) => ({
        ...f,
        customer_name: typeof parsed.name === "string" ? parsed.name : f.customer_name,
        customer_phone: savedPhone || f.customer_phone,
        customer_email: typeof parsed.email === "string" ? parsed.email : f.customer_email,
      }));
      setDealsOptIn(!!parsed.deals_optin);
    } catch {
      // ignore cookie parse issues
    }
  }, []);

  const timeSlots = generateTimeSlots({
    openingHours: restaurant?.opening_hours || null,
    bufferMinutes: 30,
    daysAhead: 3,
    limit: 80,
  });

  const handleSendCode = async () => {
    const phone = normalizePhone(form.customer_phone);
    const email = (form.customer_email || "").trim();
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await sendVerificationCode(phone, email);
      setCodeSent(true);
      setCodeChannel(result.channel);
    } catch (err) {
      setVerifyError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyCode = async () => {
    const phone = normalizePhone(form.customer_phone);
    const email = (form.customer_email || "").trim();
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await verifyCode(phone, email, codeInput);
      if (result.verified) {
        setVerified(true);
      } else {
        setVerifyError("Incorrect code. Please try again.");
      }
    } catch (err) {
      setVerifyError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedPhone = normalizePhone(form.customer_phone);
    if (!form.customer_name || !normalizedPhone || !form.pickup_time) {
      setError("Please fill in name, phone, and pickup time");
      return;
    }
    if (!normalizedPhone.startsWith("+44") || normalizedPhone.length < 12) {
      setError("Please enter a valid UK mobile number.");
      return;
    }

    // Check verification status if not yet checked
    if (verified === null) {
      setError(null);
      try {
        const result = await checkVerified(normalizedPhone, (form.customer_email || "").trim());
        if (result.verified) {
          setVerified(true);
          // Continue to place order below
        } else {
          setVerified(false);
          return; // Show verification UI
        }
      } catch {
        // If check fails, allow order to proceed
        setVerified(true);
      }
    }

    if (verified === false) {
      return; // Still need verification
    }

    setSubmitting(true);
    setError(null);
    try {
      // Remember details for next time (best-effort).
      if (rememberMe) {
        try {
          const payload = {
            name: form.customer_name.trim(),
            phone: normalizedPhone,
            email: (form.customer_email || "").trim(),
            deals_optin: !!dealsOptIn,
          };
          cookieSet("forkit_customer", btoa(JSON.stringify(payload)), 120);
        } catch {
          // ignore
        }
      } else {
        cookieDel("forkit_customer");
      }

      const order = await placeOrder({
        restaurant_id: basket.restaurantId,
        customer_name: form.customer_name,
        customer_phone: normalizedPhone,
        customer_email: form.customer_email || null,
        pickup_time: form.pickup_time,
        special_instructions: form.special_instructions || null,
        sms_optin: form.sms_optin,
        items: basket.items.map((i) => ({
          menu_item_id: i.id,
          quantity: i.quantity,
        })),
      });

      // Marketing opt-in (do not block order success if it fails).
      if (dealsOptIn) {
        marketingSignup({
          restaurant_id: basket.restaurantId,
          name: form.customer_name,
          email: (form.customer_email || "").trim(),
          phone: normalizedPhone,
        }).catch(() => {});
      }

      clearBasket();
      onSuccess(order);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Determine what channel to show for verification
  const verifyTarget = (form.customer_email || "").trim()
    ? form.customer_email.trim()
    : normalizePhone(form.customer_phone);
  const verifyChannelLabel = (form.customer_email || "").trim() ? "email" : "SMS";

  return (
    <div className="contact-card" style={{ maxWidth: 560, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <p className="eyebrow">Checkout</p>
        <h2 style={{ fontFamily: '"Fraunces", serif', margin: "8px 0 0" }}>Complete your order</h2>
      </div>

      {error && <div className="error" style={{ marginBottom: "1rem", padding: "0.75rem" }}>{error}</div>}

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
          <label>Mobile *</label>
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
              value={form.customer_phone}
              onChange={(e) => {
                const val = e.target.value.replace(/[^\d\s]/g, "");
                setForm({ ...form, customer_phone: val });
                setVerified(null);
                setCodeSent(false);
              }}
              placeholder="7700 900000"
              required
              style={{ borderRadius: "0 8px 8px 0", borderLeft: "none" }}
            />
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginTop: "0.5rem",
              fontSize: "0.85rem",
              color: "var(--text-light)",
              cursor: "pointer",
              fontWeight: 400,
            }}
          >
            <input
              type="checkbox"
              checked={form.sms_optin}
              onChange={(e) => setForm({ ...form, sms_optin: e.target.checked })}
              style={{ width: "auto", margin: 0 }}
            />
            Notify me by SMS when my order is updated
          </label>
        </div>

        <div className="form-group">
          <label>Email (optional)</label>
          <input
            type="email"
            value={form.customer_email}
            onChange={(e) => { setForm({ ...form, customer_email: e.target.value }); setVerified(null); setCodeSent(false); }}
            placeholder="your@email.com"
          />
        </div>

        <div className="form-group">
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.9rem",
              color: "var(--text-light)",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ width: "auto", margin: 0 }}
            />
            Remember me on this device
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginTop: "0.5rem",
              fontSize: "0.9rem",
              color: "var(--text-light)",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            <input
              type="checkbox"
              checked={dealsOptIn}
              onChange={(e) => setDealsOptIn(e.target.checked)}
              style={{ width: "auto", margin: 0 }}
            />
            Opt in for amazing deals and offers (we never spam you!)
          </label>
        </div>

        <div className="form-group">
          <label>Pickup time *</label>
          <select
            value={form.pickup_time}
            onChange={(e) => setForm({ ...form, pickup_time: e.target.value })}
            required
          >
            <option value="">{timeSlots.length ? "Select a time" : "No pickup times available"}</option>
            {timeSlots.map((slot) => (
              <option key={slot.toISOString()} value={slot.toISOString()}>
                {formatSlotLabel(slot)}
              </option>
            ))}
          </select>
          {timeSlots.length === 0 && (
            <p style={{ marginTop: 8, color: "var(--text-light)", fontSize: "0.9rem" }}>
              No pickup times are available right now. Try again later or choose a different restaurant.
            </p>
          )}
        </div>

        <div className="form-group">
          <label>Special instructions</label>
          <textarea
            value={form.special_instructions}
            onChange={(e) => setForm({ ...form, special_instructions: e.target.value })}
            placeholder="Any allergies or special requests?"
            rows={3}
          />
        </div>

        {/* Verification step */}
        {verified === false && (
          <div
            style={{
              border: "1.5px solid var(--accent)",
              borderRadius: 12,
              padding: "1.25rem",
              marginBottom: "1rem",
              background: "var(--bg-soft, #fafafa)",
            }}
          >
            <p style={{ fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.95rem" }}>
              Verify your identity
            </p>

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
                  className="btn btn-primary"
                  onClick={handleSendCode}
                  disabled={verifying}
                  style={{ width: "100%" }}
                >
                  {verifying ? "Sending..." : `Send code via ${verifyChannelLabel}`}
                </button>
              </>
            ) : (
              <>
                <p style={{ color: "var(--text-light)", fontSize: "0.9rem", marginBottom: "0.75rem" }}>
                  We sent a code to <strong>{verifyTarget}</strong>. Enter it below.
                </p>
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
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
                    className="btn btn-primary"
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
        )}

        {verified === true && (
          <p style={{ color: "#38a169", fontSize: "0.9rem", marginBottom: "1rem", display: "flex", alignItems: "center", gap: 6 }}>
            <i className="fas fa-check-circle" /> Verified
          </p>
        )}

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", marginTop: "0.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "1.1rem", marginBottom: "1rem" }}>
            <span>Total</span>
            <span>{"\u00A3"}{subtotal.toFixed(2)}</span>
          </div>
          <p style={{ color: "var(--text-light)", fontSize: "0.9rem", marginBottom: "1rem" }}>
            Pay at the restaurant when you collect your order.
          </p>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="submit"
              className="btn btn-olive btn-pill"
              style={{ flex: 1 }}
              disabled={submitting || verified === false}
            >
              {submitting ? "Placing order\u2026" : "Place order"}
            </button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Back
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
