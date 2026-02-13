import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p>&copy; {new Date().getFullYear()} Hackney Eats. Built in Hackney.</p>
        <p className="footer-links">
          <Link to="/admin">Admin</Link>
          <span className="footer-sep">|</span>
          <Link to="/superadmin">Super Admin</Link>
        </p>
      </div>
    </footer>
  );
}
