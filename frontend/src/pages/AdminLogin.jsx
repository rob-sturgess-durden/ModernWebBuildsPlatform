import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { adminLogin, requestMagicLink, verifyMagicLink } from "../api/client";

export default function AdminLogin() {
  const [token, setToken] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState("token"); // "token" | "magic" | "magic-sent" | "verifying"
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-login via ?token=ADMIN_TOKEN query param (quick link from superadmin)
  useEffect(() => {
    const directToken = searchParams.get("token");
    if (!directToken) return;
    setMode("verifying");
    setError(null);
    adminLogin(directToken)
      .then((result) => {
        localStorage.setItem("admin_token", directToken);
        localStorage.setItem("admin_restaurant", JSON.stringify(result));
        setSearchParams({}, { replace: true });
        navigate("/admin/dashboard");
      })
      .catch((_err) => {
        setError("Invalid or expired token in the login link.");
        setMode("token");
        setSearchParams({}, { replace: true });
      });
  }, []);

  // Auto-verify magic link on page load
  useEffect(() => {
    const magicToken = searchParams.get("magic");
    if (!magicToken) return;
    setMode("verifying");
    setError(null);
    verifyMagicLink(magicToken)
      .then((result) => {
        localStorage.setItem("admin_token", result.admin_token);
        localStorage.setItem("admin_restaurant", JSON.stringify(result));
        // Clean the URL
        setSearchParams({}, { replace: true });
        navigate("/admin/dashboard");
      })
      .catch((err) => {
        setError("This login link has expired or already been used. Please request a new one.");
        setMode("magic");
        setSearchParams({}, { replace: true });
      });
  }, []);

  const handleTokenSubmit = async (e) => {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await adminLogin(token.trim());
      localStorage.setItem("admin_token", token.trim());
      localStorage.setItem("admin_restaurant", JSON.stringify(result));
      navigate("/admin/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await requestMagicLink(email.trim());
      setMode("magic-sent");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (mode === "verifying") {
    return (
      <div className="container section">
        <div className="card" style={{ maxWidth: 450, margin: "3rem auto", textAlign: "center" }}>
          <div className="loading">Verifying your login link...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container section">
      <div className="card" style={{ maxWidth: 450, margin: "3rem auto" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1.5rem", textAlign: "center" }}>
          Restaurant Admin
        </h2>

        {error && <div className="error" style={{ marginBottom: "1rem" }}>{error}</div>}

        {mode === "token" && (
          <>
            <p style={{ color: "var(--text-light)", textAlign: "center", marginBottom: "1.5rem" }}>
              Enter your restaurant admin token to manage orders and menu.
            </p>
            <form onSubmit={handleTokenSubmit}>
              <div className="form-group">
                <label>Admin Token</label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Paste your admin token here"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </button>
            </form>
            <p style={{ textAlign: "center", marginTop: "1.25rem" }}>
              <button
                type="button"
                onClick={() => { setMode("magic"); setError(null); }}
                style={{
                  background: "none", border: "none", color: "var(--accent)",
                  cursor: "pointer", fontSize: "0.9rem", textDecoration: "underline",
                }}
              >
                Forgot your token? Send a login link
              </button>
            </p>
          </>
        )}

        {mode === "magic" && (
          <>
            <p style={{ color: "var(--text-light)", textAlign: "center", marginBottom: "1.5rem" }}>
              Enter the email address registered with your restaurant and we'll send you a login link.
            </p>
            <form onSubmit={handleMagicSubmit}>
              <div className="form-group">
                <label>Owner Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoFocus
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
                {loading ? "Sending..." : "Send Login Link"}
              </button>
            </form>
            <p style={{ textAlign: "center", marginTop: "1.25rem" }}>
              <button
                type="button"
                onClick={() => { setMode("token"); setError(null); }}
                style={{
                  background: "none", border: "none", color: "var(--accent)",
                  cursor: "pointer", fontSize: "0.9rem", textDecoration: "underline",
                }}
              >
                Back to token login
              </button>
            </p>
          </>
        )}

        {mode === "magic-sent" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>
              <i className="fas fa-envelope-open-text" />
            </div>
            <p style={{ color: "var(--text-light)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
              If that email is registered with a restaurant, we've sent a login link.
              Check your inbox and click the link to log in.
            </p>
            <p style={{ color: "var(--text-light)", fontSize: "0.85rem" }}>
              The link expires in 30 minutes.
            </p>
            <button
              type="button"
              onClick={() => { setMode("magic"); setError(null); }}
              className="btn btn-primary"
              style={{ marginTop: "1.5rem" }}
            >
              Send another link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
