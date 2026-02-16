import { Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";
import LandingPage from "./pages/LandingPage";
import HomePage from "./pages/HomePage";
import RestaurantPage from "./pages/RestaurantPage";
import OrderStatusPage from "./pages/OrderStatusPage";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import SuperAdminLogin from "./pages/SuperAdminLogin";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import InstallPrompt from "./components/pwa/InstallPrompt";

export default function App() {
  const location = useLocation();
  const isLanding = location.pathname === "/";

  // Landing page has its own nav/footer, so hide the app shell
  if (isLanding) {
    return <LandingPage />;
  }

  // Default theme for non-restaurant pages
  useEffect(() => {
    const path = location.pathname || "/";
    const isRestaurant = /^\/[^/]+$/.test(path) && !["/restaurants", "/admin", "/superadmin"].includes(path);
    if (!isRestaurant) document.documentElement.dataset.theme = "modern";
  }, [location.pathname]);

  // Restaurant pages have their own hero banner, so hide the site header
  const isRestaurantPage = /^\/[^/]+$/.test(location.pathname)
    && !["/restaurants", "/admin", "/superadmin"].includes(location.pathname);

  return (
    <div className="eats-page" style={{ display: "flex", flexDirection: "column" }}>
      {!isRestaurantPage && <Header />}
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/restaurants" element={<HomePage />} />
          <Route path="/order/:orderNumber" element={<OrderStatusPage />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/superadmin" element={<SuperAdminLogin />} />
          <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
          <Route path="/:slug" element={<RestaurantPage />} />
        </Routes>
      </main>
      <Footer />
      <InstallPrompt />
    </div>
  );
}
