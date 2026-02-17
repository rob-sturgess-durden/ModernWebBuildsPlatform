import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p>&copy; {new Date().getFullYear()} Hackney Eats. Powered by ForkItt.</p>
        <p className="footer-links">
          <Link to="/restaurants">Restaurants</Link>
          <span className="footer-sep">|</span>
          <Link to="/admin">Admin</Link>
          <span className="footer-sep">|</span>
          <Link to="/superadmin">Super Admin</Link>
        </p>
      </div>
    </footer>
  );
}
