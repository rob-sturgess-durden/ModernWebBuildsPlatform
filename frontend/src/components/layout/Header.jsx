import { Link } from "react-router-dom";
import { useBasket } from "../../context/BasketContext";

export default function Header() {
  const { totalItems, basket } = useBasket();

  return (
    <header className="site-header">
      <div className="container">
        <Link to="/restaurants" className="brand">
          <img src="/forkit-logo.svg" alt="ForkItt" className="brand-logo" />
          <div>
            <p className="brand-name">ForkItt</p>
            <p className="brand-tag">Local Restaurants • Click &amp; Collect</p>
          </div>
        </Link>
        {totalItems > 0 && basket.restaurantSlug && (
          <Link to={`/${basket.restaurantSlug}`} className="cta">
            Basket ({totalItems})
          </Link>
        )}
      </div>
    </header>
  );
}
