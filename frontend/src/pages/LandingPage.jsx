import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getRestaurants } from "../api/client";
import "../themes/landing.css";

export default function LandingPage() {
  const [restaurants, setRestaurants] = useState([]);

  useEffect(() => {
    getRestaurants().then(setRestaurants).catch(() => {});
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="forkit-navbar">
        <div className="forkit-nav-container">
          <div className="forkit-nav-logo">
            <img src="/forkit-logo.svg" alt="ForkItt" style={{ width: 32, height: 32 }} />
            <h2>ForkItt</h2>
          </div>
          <ul className="forkit-nav-menu">
            <li><a href="#home" onClick={(e) => { e.preventDefault(); scrollTo("home"); }}>Home</a></li>
            <li><a href="#benefits" onClick={(e) => { e.preventDefault(); scrollTo("benefits"); }}>Why ForkItt</a></li>
            <li><a href="#restaurants" onClick={(e) => { e.preventDefault(); scrollTo("restaurants"); }}>Restaurants</a></li>
            <li><a href="#contact" onClick={(e) => { e.preventDefault(); scrollTo("contact"); }}>Get Started</a></li>
          </ul>
        </div>
      </nav>

      {/* Hero */}
      <section id="home" className="forkit-hero">
        <div className="forkit-hero-container">
          <div className="forkit-hero-content">
            <span className="forkit-hero-badge">Your restaurant, your rules</span>
            <h1>Break free from Deliveroo & Just Eat</h1>
            <p className="forkit-hero-lead">
              ForkItt gives restaurants the freedom they deserve. Lower fees, no upfront costs, and full control over your customers. Easy, convenient, and built for you.
            </p>
            <div className="forkit-hero-buttons">
              <a href="#contact" className="forkit-btn forkit-btn-primary" onClick={(e) => { e.preventDefault(); scrollTo("contact"); }}>Get Started Free</a>
              <a href="#benefits" className="forkit-btn forkit-btn-secondary" onClick={(e) => { e.preventDefault(); scrollTo("benefits"); }}>See How It Works</a>
            </div>
          </div>
          <div className="forkit-hero-visual">
            <div className="forkit-hero-card" style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  background: "rgba(255, 255, 255, 0.95)",
                  color: "var(--accent, #c4501a)",
                  padding: "4px 10px",
                  borderRadius: "12px",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                }}
              >
                Coming Soon
              </div>
              <div className="forkit-hero-card-row">
                <span className="forkit-hero-stat">Lower fees</span>
                <span className="forkit-hero-check">{"\u2713"}</span>
              </div>
              <div className="forkit-hero-card-row">
                <span className="forkit-hero-stat">No upfront costs</span>
                <span className="forkit-hero-check">{"\u2713"}</span>
              </div>
              <div className="forkit-hero-card-row">
                <span className="forkit-hero-stat">Own your customer data</span>
                <span className="forkit-hero-check">{"\u2713"}</span>
              </div>
              <div className="forkit-hero-card-row">
                <span className="forkit-hero-stat">Run promotions direct</span>
                <span className="forkit-hero-check">{"\u2713"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="forkit-section forkit-section-dark">
        <div className="forkit-container">
          <h2>Why restaurants choose ForkItt</h2>
          <div className="forkit-benefits-grid">
            {BENEFITS.map((b, i) => (
              <div key={i} className="forkit-benefit-card" style={{ position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    background: "rgba(255, 255, 255, 0.95)",
                    color: "var(--accent, #c4501a)",
                    padding: "4px 10px",
                    borderRadius: "12px",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  }}
                >
                  Coming Soon
                </div>
                <div className="forkit-benefit-icon">{b.icon}</div>
                <h3>{b.title}</h3>
                <p>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Restaurants using ForkItt */}
      <section id="restaurants" className="forkit-section forkit-section-darker">
        <div className="forkit-container">
          <h2>Restaurants on ForkItt</h2>
          <p className="forkit-section-sub">See how easy it is to take orders and keep more of what you earn.</p>
          <div className="forkit-restaurants-grid">
            {restaurants.slice(0, 6).map((r) => (
              <Link key={r.id} to={`/${r.slug}`} className="forkit-restaurant-item">
                <div
                  className="forkit-restaurant-image"
                  style={{
                    position: "relative",
                    background: r.banner_url
                      ? `linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,0,0,0.5)), url(${r.banner_url}) center/cover no-repeat`
                      : getGradient(r.cuisine_type),
                  }}
                >
                  {/* Coming Soon label */}
                  <div
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      background: "rgba(255, 255, 255, 0.95)",
                      color: "var(--accent, #c4501a)",
                      padding: "4px 10px",
                      borderRadius: "12px",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                    }}
                  >
                    Coming Soon
                  </div>
                  {r.logo_url ? (
                    <img
                      src={r.logo_url}
                      alt={`${r.name} logo`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      style={{
                        width: 48,
                        height: 48,
                        objectFit: "contain",
                        borderRadius: 10,
                        background: "white",
                        padding: 3,
                        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                        position: "absolute",
                        bottom: 12,
                        left: 12,
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: "2rem" }}>{getCuisineEmoji(r.cuisine_type)}</span>
                  )}
                </div>
                <div className="forkit-restaurant-content">
                  <h3>{r.name}</h3>
                  <p>{r.cuisine_type.split("(")[0].trim()}</p>
                </div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <Link to="/restaurants" className="forkit-btn forkit-btn-primary">
              Browse All Restaurants
            </Link>
          </div>
        </div>
      </section>

      {/* Contact / Get Started */}
      <section id="contact" className="forkit-section forkit-section-dark">
        <div className="forkit-container">
          <h2>Get started with ForkItt</h2>
          <div className="forkit-contact-content">
            <div className="forkit-contact-info">
              <h3>Ready to take back control?</h3>
              <p>No upfront fees. No long-term contracts. Just lower fees and the freedom to run your restaurant your way. Join the restaurants already using ForkItt.</p>
              <div className="forkit-contact-details">
                <div className="forkit-contact-item">
                  <i className="fas fa-phone"></i>
                  <div>
                    <h4>Call Sam</h4>
                    <a href="tel:07939533137">Call Sam on 07939 533137</a>
                  </div>
                </div>
                <div className="forkit-contact-item">
                  <i className="fab fa-instagram"></i>
                  <div>
                    <h4>Instagram</h4>
                    <a href="https://instagram.com/forkitt" target="_blank" rel="noreferrer">@forkitt</a>
                  </div>
                </div>
                <div className="forkit-contact-item">
                  <i className="fas fa-envelope"></i>
                  <div>
                    <h4>Email</h4>
                    <a href="mailto:hello@forkitt.com">hello@forkitt.com</a>
                  </div>
                </div>
              </div>
            </div>
            <div className="forkit-contact-form">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="forkit-footer">
        <div className="forkit-container">
          <div className="forkit-footer-content">
            <div className="forkit-footer-section">
              <h3><img src="/forkit-logo.svg" alt="" style={{ width: 24, height: 24, verticalAlign: "middle", marginRight: 8 }} />ForkItt</h3>
              <p>Online ordering for restaurants. Lower fees. Full control. No upfront costs.</p>
            </div>
            <div className="forkit-footer-section">
              <h4>For Restaurants</h4>
              <ul>
                <li>Lower service fees</li>
                <li>Own your customers</li>
                <li>Run promotions</li>
                <li>Click & collect</li>
              </ul>
            </div>
            <div className="forkit-footer-section">
              <h4>Contact</h4>
              <ul>
                <li><a href="tel:07939533137">Call Sam on 07939 533137</a></li>
                <li><a href="https://instagram.com/forkitt">@forkitt</a></li>
                <li><a href="mailto:hello@forkitt.com">hello@forkitt.com</a></li>
              </ul>
            </div>
          </div>
          <div className="forkit-footer-bottom">
            <p>&copy; {new Date().getFullYear()} ForkItt. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ContactForm() {
  const [status, setStatus] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button");
    btn.textContent = "Sending...";
    btn.disabled = true;
    setTimeout(() => {
      setStatus("Thanks! We'll be in touch soon to help you get started with ForkItt.");
      e.target.reset();
      btn.textContent = "Get in Touch";
      btn.disabled = false;
    }, 1500);
  };

  return (
    <form onSubmit={handleSubmit}>
      {status && <div className="forkit-form-success">{status}</div>}
      <div className="forkit-form-group"><input type="text" placeholder="Restaurant name" required /></div>
      <div className="forkit-form-group"><input type="text" placeholder="Your name" required /></div>
      <div className="forkit-form-group"><input type="email" placeholder="Email address" required /></div>
      <div className="forkit-form-group"><input type="tel" placeholder="Phone number" /></div>
      <div className="forkit-form-group"><textarea placeholder="Tell us about your restaurant and when you'd like to get started..." rows={5} required></textarea></div>
      <button type="submit" className="forkit-btn forkit-btn-primary forkit-btn-full">Get in Touch</button>
    </form>
  );
}

const BENEFITS = [
  { icon: "\uD83D\uDCB0", title: "Lower service fees", desc: "Keep more of what you earn. ForkItt charges a fraction of what the big platforms take, so your margins stay healthy." },
  { icon: "\uD83D\uDE80", title: "No upfront fees", desc: "Get started with zero upfront cost. No setup fees, no monthly minimums. You only pay when you earn." },
  { icon: "\uD83D\uDC65", title: "Own your customers", desc: "Build your own customer base. Full control over contact details, order history, and the relationship you have with diners." },
  { icon: "\uD83D\uDCE2", title: "Run promotions direct", desc: "Send offers and updates straight to your customers. No algorithm deciding who sees your deals\u2014you're in control." },
  { icon: "\u26A1", title: "Easy & convenient", desc: "Simple setup, intuitive admin, and orders that flow straight to you. Click & collect made straightforward." },
  { icon: "\uD83D\uDD13", title: "Freedom from big platforms", desc: "Break away from Deliveroo and Just Eat. No more competing with their own brands or bending to their terms." },
];

function getCuisineEmoji(cuisine) {
  const lower = cuisine.toLowerCase();
  if (lower.includes("coffee")) return "\u2615";
  if (lower.includes("caribbean") || lower.includes("jamaican") || lower.includes("jerk")) return "\uD83D\uDD25";
  if (lower.includes("english") || lower.includes("breakfast")) return "\uD83C\uDF73";
  if (lower.includes("halal") || lower.includes("mediterranean")) return "\uD83E\uDD5A";
  return "\uD83C\uDF7D\uFE0F";
}

function getGradient(cuisine) {
  const lower = cuisine.toLowerCase();
  if (lower.includes("coffee")) return "linear-gradient(135deg, #78350f, #d97706)";
  if (lower.includes("caribbean") || lower.includes("jamaican")) return "linear-gradient(135deg, #065f46, #fbbf24)";
  if (lower.includes("english") || lower.includes("breakfast")) return "linear-gradient(135deg, #1e3a5f, #3b82f6)";
  if (lower.includes("halal") || lower.includes("mediterranean")) return "linear-gradient(135deg, #7c2d12, #ea580c)";
  return "linear-gradient(135deg, #4c1d95, #7c3aed)";
}
