// src/NonAdminRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./authContext";

const ADMIN_EMAIL = "admin@newstore.com.br";

/**
 * Se for admin, redireciona para /admin; caso contrário, renderiza os filhos.
 * Importante: enquanto o auth ainda está carregando, NÃO bloqueie a página.
 */
export default function NonAdminRoute({ children }) {
  const { user, loading } = useAuth?.() || {};

  // Enquanto o estado de auth está carregando, não bloqueie a página.
  // Isso evita a tela branca em / e /conta.
  if (loading) return children;

  const email = (user?.email || "").toLowerCase();
  const isAdmin = !!user?.is_admin || email === ADMIN_EMAIL;

  return isAdmin ? <Navigate to="/admin" replace /> : children;
}
