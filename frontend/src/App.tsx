import {
  Link,
  Route,
  BrowserRouter as Router,
  Routes,
  Navigate,
} from "react-router-dom";
import Home from "./pages/Home";
import UnitsPage from "./pages/Units";
import HealthPage from "./pages/Health";
import IngredientsPage from "./pages/Ingredients";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import MenuPage from "./pages/Menu";
import { useAuth } from "./context/AuthContext";

function Protected({ children }: { children: JSX.Element }) {
  const { token, hydrated } = useAuth();
  if (!hydrated)
    return (
      <div className="card">
        <h2>Loading…</h2>
      </div>
    );
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { token, restaurant, logout } = useAuth();

  return (
    <Router>
      <div>
        <nav className="navbar">
          <Link to="/">Home</Link>
          <Link to="/health">Health</Link>
          <Link to="/units">Units</Link>
          <Link to="/ingredients">Ingredients</Link>
          <Link to="/menu">Menu</Link>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {token ? (
              <>
                <span style={{ opacity: 0.8 }}>{restaurant?.name}</span>
                <button type="button" onClick={logout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login">Login</Link>
                <Link to="/signup">Signup</Link>
              </>
            )}
          </div>
        </nav>

        <div className="card">
          <Routes>
            <Route
              path="/menu"
              element={
                <Protected>
                  <MenuPage />
                </Protected>
              }
            />
            <Route
              path="/"
              element={
                <Protected>
                  <Home />
                </Protected>
              }
            />
            <Route
              path="/health"
              element={
                <Protected>
                  <HealthPage />
                </Protected>
              }
            />
            <Route
              path="/units"
              element={
                <Protected>
                  <UnitsPage />
                </Protected>
              }
            />
            <Route
              path="/ingredients"
              element={
                <Protected>
                  <IngredientsPage />
                </Protected>
              }
            />

            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}
