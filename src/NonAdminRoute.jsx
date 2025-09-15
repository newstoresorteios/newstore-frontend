// src/NonAdminRoute.jsx
import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./authContext";

const ADMIN_EMAIL = "admin@newstore.com.br";

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("access_token") ||
  sessionStorage.getItem("token") ||
  "";

function decodeJWT(tk) {
  try {
    const [, payload] = tk.split(".");
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isAdmin(u) {
  if (!u) return false;
  if (u.is_admin === true) return true;
  const email = (u.email || u.user?.email || "").toLowerCase();
  return email === ADMIN_EMAIL;
}

export default function NonAdminRoute({ children }) {
  const { user } = useAuth?.() || {};
  const location = useLocation();

  // semente: contexto -> localStorage("me") -> payload do JWT
  let candidate = user || null;
  if (!candidate) {
    try { candidate = JSON.parse(localStorage.getItem("me") || "null"); } catch {}
  }
  if (!candidate) {
    const p = decodeJWT(getToken());
    if (p?.email || p?.user?.email) {
      candidate = { email: p.email || p.user?.email, is_admin: !!p.is_admin };
    }
  }

  // Admin não deve ficar aqui -> manda pro painel
  if (isAdmin(candidate)) {
    return <Navigate to="/admin" state={{ from: location }} replace />;
  }

  return children;
}
