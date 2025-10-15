import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function SignupPage() {
  const { signup, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    logout(); // clear existing token
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await signup(email, password, restaurantName);
      window.location.href = "/";
    } catch (e: any) {
      setError(e.message || "Signup failed");
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Create your restaurant</h2>
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
        <input
          placeholder="Restaurant name"
          value={restaurantName}
          onChange={(e) => setRestaurantName(e.target.value)}
          required
        />
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
        />
        <input
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />
        <button type="submit">Create account</button>
      </form>
      {error && <div style={{ color: "#ff7b9c", marginTop: 12 }}>{error}</div>}
    </div>
  );
}
