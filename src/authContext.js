// src/authContext.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiJoin } from "./lib/api";

const TOKEN_KEY = "ns_auth_token";
const COMPAT_KEYS = ["token", "access_token"];

/* ---------------- token helpers ---------------- */
function readToken() {
  const raw =
    localStorage.getItem(TOKEN_KEY) ||
    sessionStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem(COMPAT_KEYS[0]) ||
    localStorage.getItem(COMPAT_KEYS[1]) ||
    sessionStorage.getItem(COMPAT_KEYS[0]) ||
    sessionStorage.getItem(COMPAT_KEYS[1]) ||
    "";
  return String(raw).replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "");
}

function saveToken(tk, persist = true) {
  const clean = String(tk).replace(/^Bearer\s+/i, "");
  try {
    if (persist) {
      localStorage.setItem(TOKEN_KEY, clean);
      COMPAT_KEYS.forEach((k) => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, clean);
      localStorage.removeItem(TOKEN_KEY);
      COMPAT_KEYS.forEach((k) => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
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

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(readToken());
  const [loading, setLoading] = useState(true);

  const getAuthHeaders = () => {
    const tk = readToken();
    return tk ? { Authorization: `Bearer ${tk}` } : {};
  };

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
        credentials: "include", // <— aceita/enviar cookie ns_auth
      });
      if (!r.ok) {
        if (r.status === 401) {
          clearToken();
          setUser(null);
          setTokenState("");
        }
        setLoading(false);
        return;
      }
      const data = await r.json();
      setUser(data?.user || data || null);
    } catch (e) {
      console.warn("[auth] /me failed:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Faz login, persiste token, BUSCA /me e devolve o user já carregado
   */
  async function login({ email, password, remember = true }) {
    const r = await fetch(apiJoin("/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // <— garante set-cookie em cross-site
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

    // Carrega o usuário imediatamente e retorna
    let me = null;
    try {
      const m = await fetch(apiJoin("/me"), {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
        credentials: "include",
      });
      if (m.ok) {
        const body = await m.json();
        me = body?.user || body || null;
      }
    } catch {}
    setUser(me);
    return me; // <— o chamador já recebe o user
  }

  function logout() {
    clearToken();
    setUser(null);
    setTokenState("");
  }

  const value = useMemo(
    () => ({ user, token, loading, login, logout, getAuthHeaders }),
    [user, token, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
