// src/authContext.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const KEY_TOKEN = "ns_auth_token";
const KEY_USER  = "ns_auth_user";

// Resolve a base da API a partir das ENVs usadas no projeto
const API_BASE = (
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_API_BASE_URL ||
  "https://newstore-backend.onrender.com"
).replace(/\/+$/,"");

const AuthContext = createContext({
  isAuthenticated: false,
  user: null,
  login: async (_){},
  logout: () => {},
  loading: true,
});

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  // Tenta recuperar sessão no mount usando o cookie httpOnly (se houver)
  useEffect(() => {
    (async () => {
      try {
        // tenta storage primeiro (renderiza mais rápido)
        const stored = localStorage.getItem(KEY_USER) ?? sessionStorage.getItem(KEY_USER);
        if (stored) setUser(JSON.parse(stored));
      } catch {}

      try {
        const r = await fetch(`${API_BASE}/api/me`, {
          credentials: "include",
        });
        if (r.ok) {
          const me = await r.json();
          // persiste o user para manter após refresh
          localStorage.setItem(KEY_USER, JSON.stringify(me));
          setUser(me);
        } else if (r.status === 401) {
          // sessão inválida → limpa qualquer resto de storage
          localStorage.removeItem(KEY_TOKEN);
          localStorage.removeItem(KEY_USER);
          sessionStorage.removeItem(KEY_TOKEN);
          sessionStorage.removeItem(KEY_USER);
          setUser(null);
        }
      } catch {
        // offline / backend down: mantém o que já tinha
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login({ email, password, remember }) {
    const r = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // importante p/ cookie httpOnly
      body: JSON.stringify({ email, password }),
    });

    if (!r.ok) {
      const txt = await r.text().catch(()=>"");
      throw new Error(txt || "Falha no login");
    }

    const data = await r.json().catch(()=>({}));
    // Backend pode mandar { token, user } ou só setar cookie e retornar { user }
    const token = data?.token || "";
    const userObj = data?.user || { email };

    // Salva token se vier (o pix.js procura por 'ns_auth_token')
    const store = remember ? localStorage : sessionStorage;
    if (token) store.setItem(KEY_TOKEN, token);
    store.setItem(KEY_USER, JSON.stringify(userObj));
    setUser(userObj);

    // (opcional) confirma sessão via /api/me usando o cookie recém-setado
    try {
      const rm = await fetch(`${API_BASE}/api/me`, { credentials: "include" });
      if (rm.ok) {
        const me = await rm.json();
        store.setItem(KEY_USER, JSON.stringify(me));
        setUser(me);
      }
    } catch {}
  }

  async function logout() {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch {}
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
