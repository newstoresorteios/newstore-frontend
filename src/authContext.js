import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const KEY_TOKEN = "ns_auth_token";
const KEY_USER  = "ns_auth_user";

const AuthContext = createContext({
  isAuthenticated: false,
  user: null,
  login: async () => {},
  logout: () => {},
  loading: true,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // carrega sessão ao montar
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem(KEY_USER) ?? sessionStorage.getItem(KEY_USER);
      if (storedUser) setUser(JSON.parse(storedUser));
    } catch {}
    setLoading(false);
  }, []);

  async function login({ email, password, remember }) {
    const API = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');
    const res = await fetch(`${API}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Falha no login");
    }
    const data = await res.json(); // { token, user }
    const token = data.token;
    const userObj = data.user || { email };

    if (!token) throw new Error("Token ausente no login");

    const store = remember ? localStorage : sessionStorage;
    store.setItem(KEY_TOKEN, token);
    store.setItem(KEY_USER, JSON.stringify(userObj));
    setUser(userObj);
  }

  function logout() {
    localStorage.removeItem(KEY_TOKEN);
    localStorage.removeItem(KEY_USER);
    sessionStorage.removeItem(KEY_TOKEN);
    sessionStorage.removeItem(KEY_USER);
    setUser(null);
  }

  const value = useMemo(
    () => ({ isAuthenticated: !!user, user, login, logout, loading }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
