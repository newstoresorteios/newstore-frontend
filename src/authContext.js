// src/authContext.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

/* ---------- util base API ---------- */
const RAW_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_BASE ||
  "/api";
const API_BASE = String(RAW_BASE).replace(/\/+$/, "");
const apiJoin = (path) => {
  let p = path.startsWith("/") ? path : `/${path}`;
  if (API_BASE.endsWith("/api") && p.startsWith("/api/")) p = p.slice(4);
  return `${API_BASE}${p}`;
};

/* ---------- storage helpers ---------- */
const TOKEN_KEY = "ns_auth_token";
const COMPAT_KEYS = ["token", "access_token"]; // backward-compat

function readToken() {
  const fromLocal =
    localStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem(COMPAT_KEYS[0]) ||
    localStorage.getItem(COMPAT_KEYS[1]);
  const fromSession =
    sessionStorage.getItem(TOKEN_KEY) ||
    sessionStorage.getItem(COMPAT_KEYS[0]) ||
    sessionStorage.getItem(COMPAT_KEYS[1]);
  const raw = fromLocal || fromSession || "";
  return String(raw).replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "");
}

function saveToken(tk, persist = true) {
  const clean = String(tk).replace(/^Bearer\s+/i, "");
  try {
    if (persist) {
      localStorage.setItem(TOKEN_KEY, clean);
      // limpa chaves antigas
      COMPAT_KEYS.forEach((k) => localStorage.removeItem(k));
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, clean);
      localStorage.removeItem(TOKEN_KEY);
      COMPAT_KEYS.forEach((k) => localStorage.removeItem(k));
    }
  } catch {}
}

function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    COMPAT_KEYS.forEach((k) => {
      localStorage.removeItem(k);
      sessionStorage.removeItem(k);
    });
  } catch {}
}

/* ---------- context ---------- */
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(readToken());
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = () =>
    token ? { Authorization: `Bearer ${token}` } : {};

  async function loadUser() {
    const tk = readToken();
    setTokenState(tk || "");
    if (!tk) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const r = await fetch(apiJoin("/me"), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        credentials: "include", // ok usar; não atrapalha
      });
      if (!r.ok) {
        // token inválido / expirado
        if (r.status === 401) {
          clearToken();
          setUser(null);
          setTokenState("");
        }
        setLoading(false);
        return;
      }
      const data = await r.json();
      setUser(data?.user || null);
    } catch (e) {
      console.warn("[auth] /me failed:", e);
      // não apaga token por erro de rede
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login({ email, password, remember = true }) {
    // ajuste a URL se seu endpoint de login for diferente
    const r = await fetch(apiJoin("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err?.error || "login_failed");
    }
    const data = await r.json();
    const tk = data?.token || data?.access_token || data?.jwt;
    if (!tk) throw new Error("missing_token");
    saveToken(tk, remember);
    setTokenState(readToken());
    await loadUser();
    return true;
  }

  function logout() {
    clearToken();
    setUser(null);
    setTokenState("");
  }

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      getAuthHeaders,
      apiJoin, // exporta para quem quiser usar o util
    }),
    [user, token, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
