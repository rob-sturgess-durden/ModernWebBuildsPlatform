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
            <span className="forkit-logo-icon">🍴</span>
            <h2>Forkit</h2>
          </div>
          <ul className="forkit-nav-menu">
            <li><a href="#home" onClick={(e) => { e.preventDefault(); scrollTo("home"); }}>Home</a></li>
            <li><a href="#benefits" onClick={(e) => { e.preventDefault(); scrollTo("benefits"); }}>Why Forkit</a></li>
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
              Forkit gives restaurants the freedom they deserve. Lower fees, no upfront costs, and full control over your customers. Easy, convenient, and built for you.
            </p>
            <div className="forkit-hero-buttons">
              <a href="#contact" className="forkit-btn forkit-btn-primary" onClick={(e) => { e.preventDefault(); scrollTo("contact"); }}>Get Started Free</a>
              <a href="#benefits" className="forkit-btn forkit-btn-secondary" onClick={(e) => { e.preventDefault(); scrollTo("benefits"); }}>See How It Works</a>
            </div>
          </div>
          <div className="forkit-hero-visual">
            <div className="forkit-hero-card">
              <div className="forkit-hero-card-row">
                <span className="forkit-hero-stat">Lower fees</span>
                <span className="forkit-hero-check">✓</span>
              </div>
              <div className="forkit-hero-card-row">
                <span className="forkit-hero-stat">No upfront costs</span>
                <span className="forkit-hero-check">✓</span>
              </div>
              <div className="forkit-hero-card-row">
                <span className="forkit-hero-stat">Own your customer data</span>
                <span className="forkit-hero-check">✓</span>
              </div>
              <div className="forkit-hero-card-row">
                <span className="forkit-hero-stat">Run promotions direct</span>
                <span className="forkit-hero-check">✓</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section id="benefits" className="forkit-section forkit-section-dark">
        <div className="forkit-container">
          <h2>Why restaurants choose Forkit</h2>
          <div className="forkit-benefits-grid">
            {BENEFITS.map((b, i) => (
              <div key={i} className="forkit-benefit-card">
                <div className="forkit-benefit-icon">{b.icon}</div>
                <h3>{b.title}</h3>
                <p>{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Restaurants using Forkit */}
      <section id="restaurants" className="forkit-section forkit-section-darker">
        <div className="forkit-container">
          <h2>Restaurants on Forkit</h2>
          <p className="forkit-section-sub">See how easy it is to take orders and keep more of what you earn.</p>
          <div className="forkit-restaurants-grid">
            {restaurants.slice(0, 6).map((r) => (
              <Link key={r.id} to={`/${r.slug}`} className="forkit-restaurant-item">
                <div className="forkit-restaurant-image" style={{ background: getGradient(r.cuisine_type) }}>
                  {getCuisineEmoji(r.cuisine_type)}
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
          <h2>Get started with Forkit</h2>
          <div className="forkit-contact-content">
            <div className="forkit-contact-info">
              <h3>Ready to take back control?</h3>
              <p>No upfront fees. No long-term contracts. Just lower fees and the freedom to run your restaurant your way. Join the restaurants already using Forkit.</p>
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
              <h3><span className="forkit-logo-icon">🍴</span> Forkit</h3>
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
            <p>&copy; {new Date().getFullYear()} Forkit. All rights reserved.</p>
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
      setStatus("Thanks! We'll be in touch soon to help you get started with Forkit.");
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
  { icon: "💰", title: "Lower service fees", desc: "Keep more of what you earn. Forkit charges a fraction of what the big platforms take, so your margins stay healthy." },
  { icon: "🚀", title: "No upfront fees", desc: "Get started with zero upfront cost. No setup fees, no monthly minimums. You only pay when you earn." },
  { icon: "👥", title: "Own your customers", desc: "Build your own customer base. Full control over contact details, order history, and the relationship you have with diners." },
  { icon: "📢", title: "Run promotions direct", desc: "Send offers and updates straight to your customers. No algorithm deciding who sees your deals—you're in control." },
  { icon: "⚡", title: "Easy & convenient", desc: "Simple setup, intuitive admin, and orders that flow straight to you. Click & collect made straightforward." },
  { icon: "🔓", title: "Freedom from big platforms", desc: "Break away from Deliveroo and Just Eat. No more competing with their own brands or bending to their terms." },
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
