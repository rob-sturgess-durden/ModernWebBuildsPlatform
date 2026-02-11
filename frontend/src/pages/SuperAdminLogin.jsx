import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { superadminLogin } from "../api/client";

export default function SuperAdminLogin() {
  const [token, setToken] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await superadminLogin(token.trim());
      localStorage.setItem("superadmin_token", token.trim());
      navigate("/superadmin/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container section">
      <div className="card" style={{ maxWidth: 450, margin: "3rem auto" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1.5rem", textAlign: "center" }}>
          Super Admin
        </h2>
        <p style={{ color: "var(--text-light)", textAlign: "center", marginBottom: "1.5rem" }}>
          Enter the super admin token to manage all restaurants.
        </p>

        {error && <div className="error" style={{ marginBottom: "1rem" }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Super Admin Token</label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste super admin token"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
