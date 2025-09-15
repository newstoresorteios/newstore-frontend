// src/NonAdminRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./authContext";

const ADMIN_EMAIL = "admin@newstore.com.br";

export default function NonAdminRoute({ children }) {
  const { user, loading } = useAuth() || {};

  // fallback do /me salvo no login / RequireAdmin
  const stored = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem("me") || "null"); }
    catch { return null; }
  }, []);

  const email = (user?.email || stored?.email || "").toLowerCase();
  const isAdmin = Boolean(user?.is_admin || stored?.is_admin || email === ADMIN_EMAIL);

  // IMPORTANTE: não bloqueie a UI enquanto carrega; renderize os filhos.
  if (loading && !isAdmin) return children;

  // Se for admin, manda para /admin; senão exibe normalmente
  return isAdmin ? <Navigate to="/admin" replace /> : children;
}
