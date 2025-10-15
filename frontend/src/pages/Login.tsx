import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    logout(); // clear any existing token
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      window.location.href = "/";
    } catch (e: any) {
      setError(e.message || "Login failed");
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>Login</h2>
      <form
        onSubmit={onSubmit}
        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
      >
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
        <button type="submit">Login</button>
      </form>
      {error && <div style={{ color: "#ff7b9c", marginTop: 12 }}>{error}</div>}
    </div>
  );
}
