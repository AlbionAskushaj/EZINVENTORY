import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type RestaurantInfo = { id: string; name: string } | null;

type AuthContextValue = {
  token: string | null;
  restaurant: RestaurantInfo;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    restaurantName: string
  ) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "ezinv.auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantInfo>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      console.groupCollapsed("[Auth] init from storage");
      console.log("raw:", raw);
      if (raw) {
        const parsed = JSON.parse(raw);
        setToken(parsed.token || null);
        setRestaurant(parsed.restaurant || null);
        console.log(
          "loaded token:",
          parsed.token ? `len=${String(parsed.token).length}` : null
        );
        console.log("loaded restaurant:", parsed.restaurant || null);
      }
      console.groupEnd();
    } catch (e) {
      console.warn("[Auth] failed to init from storage", e);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token, restaurant })
      );
      console.log("[Auth] state persisted", {
        tokenLen: token ? String(token).length : 0,
        restaurant,
      });
    } catch (e) {
      console.warn("[Auth] failed to persist", e);
    }
  }, [token, restaurant, hydrated]);

  async function login(email: string, _password: string) {
    console.groupCollapsed("[Auth] login request");
    console.log("email:", email);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Do not log password
          body: JSON.stringify({ email, password: _password }),
        }
      );
      const text = await res.text();
      console.log("status:", res.status);
      console.log("raw body:", text);
      let body: any = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = { _parseError: true, text };
      }
      if (!res.ok)
        throw new Error(
          body.error
            ? JSON.stringify(body.error)
            : `Login failed: ${res.status}`
        );
      setToken(body.token);
      setRestaurant(body.restaurant || null);
      console.log(
        "success, token len:",
        body.token ? String(body.token).length : 0
      );
      console.groupEnd();
    } catch (e: any) {
      console.groupEnd();
      console.error("[Auth] login failed", e);
      throw e;
    }
  }

  async function signup(
    email: string,
    _password: string,
    restaurantName: string
  ) {
    console.groupCollapsed("[Auth] signup request");
    console.log("email:", email, "restaurant:", restaurantName);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/auth/signup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Do not log password
          body: JSON.stringify({ email, password: _password, restaurantName }),
        }
      );
      const text = await res.text();
      console.log("status:", res.status);
      console.log("raw body:", text);
      let body: any = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        body = { _parseError: true, text };
      }
      if (!res.ok)
        throw new Error(
          body.error
            ? JSON.stringify(body.error)
            : `Signup failed: ${res.status}`
        );
      setToken(body.token);
      setRestaurant(body.restaurant || null);
      console.log(
        "success, token len:",
        body.token ? String(body.token).length : 0
      );
      console.groupEnd();
    } catch (e: any) {
      console.groupEnd();
      console.error("[Auth] signup failed", e);
      throw e;
    }
  }

  function logout() {
    console.log("[Auth] logout");
    setToken(null);
    setRestaurant(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  const value = useMemo(
    () => ({ token, restaurant, hydrated, login, signup, logout }),
    [token, restaurant, hydrated]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
