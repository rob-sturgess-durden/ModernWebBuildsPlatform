import { Link } from "react-router-dom";
import { useBasket } from "../../context/BasketContext";

export default function Header() {
  const { totalItems } = useBasket();

  return (
    <header className="site-header">
      <div className="container">
        <Link to="/" className="logo">Hackney Eats</Link>
        <nav>
          <Link to="/restaurants">Restaurants</Link>
          <Link to="/admin">Admin</Link>
          <Link to="/superadmin">Super Admin</Link>
          {totalItems > 0 && (
            <span style={{ background: "var(--accent)", padding: "0.3rem 0.8rem", borderRadius: 20, fontSize: "0.85rem" }}>
              Basket ({totalItems})
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
