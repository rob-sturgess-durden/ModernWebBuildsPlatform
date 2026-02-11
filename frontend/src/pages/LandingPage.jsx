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
      <nav className="mwb-navbar">
        <div className="mwb-nav-container">
          <div className="mwb-nav-logo">
            <h2>Modern Web Builds</h2>
          </div>
          <ul className="mwb-nav-menu">
            <li><a href="#home" onClick={(e) => { e.preventDefault(); scrollTo("home"); }}>Home</a></li>
            <li><a href="#services" onClick={(e) => { e.preventDefault(); scrollTo("services"); }}>Services</a></li>
            <li><a href="#portfolio" onClick={(e) => { e.preventDefault(); scrollTo("portfolio"); }}>Portfolio</a></li>
            <li><a href="#contact" onClick={(e) => { e.preventDefault(); scrollTo("contact"); }}>Contact</a></li>
          </ul>
        </div>
      </nav>

      {/* Hero */}
      <section id="home" className="mwb-hero">
        <div className="mwb-hero-container">
          <div className="mwb-hero-content">
            <h1>Modern Web Development Solutions</h1>
            <p>Creating stunning, responsive websites that drive results for your business</p>
            <div className="mwb-hero-buttons">
              <a href="#contact" className="mwb-btn mwb-btn-primary" onClick={(e) => { e.preventDefault(); scrollTo("contact"); }}>Get Started</a>
              <a href="#portfolio" className="mwb-btn mwb-btn-secondary" onClick={(e) => { e.preventDefault(); scrollTo("portfolio"); }}>View Portfolio</a>
            </div>
          </div>
          <div>
            <div className="mwb-code-animation">
              <div className="mwb-code-line">{"const website = {"}</div>
              <div className="mwb-code-line">{'  design: "modern",'}</div>
              <div className="mwb-code-line">{"  responsive: true,"}</div>
              <div className="mwb-code-line">{'  performance: "optimized"'}</div>
              <div className="mwb-code-line">{"};"}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mwb-section mwb-section-dark">
        <div className="mwb-container">
          <h2>Our Services</h2>
          <div className="mwb-services-grid">
            {SERVICES.map((s, i) => (
              <div key={i} className="mwb-service-card">
                <div className="mwb-service-icon">
                  <i className={s.icon}></i>
                </div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio - show real restaurant sites */}
      <section id="portfolio" className="mwb-section mwb-section-darker">
        <div className="mwb-container">
          <h2>Live Restaurant Sites</h2>
          <div className="mwb-portfolio-grid">
            {restaurants.slice(0, 6).map((r) => (
              <Link key={r.id} to={`/${r.slug}`} className="mwb-portfolio-item">
                <div className="mwb-portfolio-image" style={{ background: getGradient(r.cuisine_type) }}>
                  {getCuisineEmoji(r.cuisine_type)}
                </div>
                <div className="mwb-portfolio-content">
                  <h3>{r.name}</h3>
                  <p>{r.cuisine_type.split("(")[0].trim()}</p>
                  <div className="mwb-portfolio-tags">
                    <span>React</span>
                    <span>Online Ordering</span>
                    <span>Click &amp; Collect</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <Link to="/restaurants" className="mwb-btn mwb-btn-primary">
              View All Restaurants
            </Link>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="mwb-section mwb-section-dark">
        <div className="mwb-container">
          <h2>Get In Touch</h2>
          <div className="mwb-contact-content">
            <div className="mwb-contact-info">
              <h3>Ready to start your project?</h3>
              <p>Let's discuss how we can help bring your vision to life with a stunning, professional website.</p>
              <div className="mwb-contact-details">
                <div className="mwb-contact-item">
                  <i className="fas fa-phone"></i>
                  <div>
                    <h4>Phone</h4>
                    <a href="tel:07939533137">07939 533 137</a>
                  </div>
                </div>
                <div className="mwb-contact-item">
                  <i className="fab fa-instagram"></i>
                  <div>
                    <h4>Instagram</h4>
                    <a href="https://instagram.com/modernwebbuilds" target="_blank" rel="noreferrer">@modernwebbuilds</a>
                  </div>
                </div>
                <div className="mwb-contact-item">
                  <i className="fas fa-envelope"></i>
                  <div>
                    <h4>Email</h4>
                    <a href="mailto:hello@modernwebbuilds.com">hello@modernwebbuilds.com</a>
                  </div>
                </div>
              </div>
            </div>
            <div className="mwb-contact-form">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mwb-footer">
        <div className="mwb-container">
          <div className="mwb-footer-content">
            <div className="mwb-footer-section">
              <h3>Modern Web Builds</h3>
              <p>Creating exceptional web experiences that drive business growth.</p>
            </div>
            <div className="mwb-footer-section">
              <h4>Services</h4>
              <ul>
                <li>Custom Website Development</li>
                <li>Responsive Design</li>
                <li>SEO Optimization</li>
                <li>Website Maintenance</li>
              </ul>
            </div>
            <div className="mwb-footer-section">
              <h4>Contact</h4>
              <ul>
                <li><a href="tel:07939533137">07939 533 137</a></li>
                <li><a href="https://instagram.com/modernwebbuilds">@modernwebbuilds</a></li>
                <li><a href="mailto:hello@modernwebbuilds.com">hello@modernwebbuilds.com</a></li>
              </ul>
            </div>
          </div>
          <div className="mwb-footer-bottom">
            <p>&copy; {new Date().getFullYear()} Modern Web Builds. All rights reserved.</p>
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
      setStatus("Thank you! Your message has been sent. We'll get back to you soon.");
      e.target.reset();
      btn.textContent = "Send Message";
      btn.disabled = false;
    }, 1500);
  };

  return (
    <form onSubmit={handleSubmit}>
      {status && <div style={{ background: "#10b981", color: "#18181b", padding: "0.8rem 1rem", borderRadius: 8, marginBottom: "1rem", fontWeight: 500 }}>{status}</div>}
      <div className="mwb-form-group"><input type="text" placeholder="Your Name" required /></div>
      <div className="mwb-form-group"><input type="email" placeholder="Your Email" required /></div>
      <div className="mwb-form-group"><input type="tel" placeholder="Your Phone Number" /></div>
      <div className="mwb-form-group"><textarea placeholder="Tell us about your project..." rows={5} required></textarea></div>
      <button type="submit" className="mwb-btn mwb-btn-primary" style={{ width: "100%" }}>Send Message</button>
    </form>
  );
}

const SERVICES = [
  { icon: "fas fa-laptop-code", title: "Custom Website Development", desc: "Tailored websites built from scratch to match your brand and business needs perfectly." },
  { icon: "fas fa-mobile-alt", title: "Responsive Design", desc: "Websites that look and work perfectly on all devices - desktop, tablet, and mobile." },
  { icon: "fas fa-search", title: "SEO Optimization", desc: "Built-in search engine optimization to help your website rank higher in search results." },
  { icon: "fas fa-tachometer-alt", title: "Performance Optimization", desc: "Fast-loading websites that provide excellent user experience and better conversion rates." },
  { icon: "fas fa-shopping-cart", title: "Restaurant Ordering Systems", desc: "Click & collect ordering with WhatsApp notifications, menu management, and admin dashboards." },
  { icon: "fas fa-chart-line", title: "Analytics & Tracking", desc: "Comprehensive analytics setup to track your website's performance and visitor behavior." },
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
