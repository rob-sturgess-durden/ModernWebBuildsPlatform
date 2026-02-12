import { Link } from "react-router-dom";
import { useBasket } from "../../context/BasketContext";

export default function Header() {
  const { totalItems, basket } = useBasket();

  return (
    <header className="site-header">
      <div className="container">
        <Link to="/restaurants" className="brand">
          <span className="brand-mark">HE</span>
          <div>
            <p className="brand-name">Hackney Eats</p>
            <p className="brand-tag">Local Restaurants • Click & Collect</p>
          </div>
        </Link>
        <nav>
          <Link to="/restaurants">Restaurants</Link>
          <Link to="/admin">Admin</Link>
          <Link to="/superadmin">Super Admin</Link>
          {totalItems > 0 && basket.restaurantSlug && (
            <Link to={`/${basket.restaurantSlug}`} className="cta">
              Basket ({totalItems})
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
