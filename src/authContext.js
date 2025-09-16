// src/authContext.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiJoin } from "./lib/api";

const TOKEN_KEY = "ns_auth_token";
const LEGACY = ["token", "access_token"];

function readToken() {
  const raw =
    localStorage.getItem(TOKEN_KEY) ||
    sessionStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem(LEGACY[0]) ||
    localStorage.getItem(LEGACY[1]) ||
    sessionStorage.getItem(LEGACY[0]) ||
    sessionStorage.getItem(LEGACY[1]) ||
    "";
  return String(raw).replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "");
}
function saveToken(tk, persist = true) {
  const clean = String(tk).replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "");
  try {
    if (persist) {
      localStorage.setItem(TOKEN_KEY, clean);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, clean);
      localStorage.removeItem(TOKEN_KEY);
    }
    LEGACY.forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
  } catch {}
}
function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    LEGACY.forEach((k) => { localStorage.removeItem(k); sessionStorage.removeItem(k); });
  } catch {}
}

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(readToken());
  const [loading, setLoading] = useState(true);

  async function loadUser() {
    const tk = readToken();
    setTokenState(tk || "");
    if (!tk) { setUser(null); setLoading(false); return; }
    try {
      const r = await fetch(apiJoin("/me"), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
      });
      if (!r.ok) {
        if (r.status === 401) { clearToken(); setUser(null); setTokenState(""); }
        setLoading(false);
        return;
      }
      const data = await r.json();
      setUser(data?.user || null);
    } catch (e) {
      console.warn("[auth] /me failed:", e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadUser(); }, []);

  async function login({ email, password, remember = true }) {
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

  function logout() { clearToken(); setUser(null); setTokenState(""); }

  const value = useMemo(() => ({
    user, token, loading, login, logout,
  }), [user, token, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
