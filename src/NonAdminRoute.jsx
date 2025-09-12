// src/NonAdminRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./authContext";

const ADMIN_EMAIL = "admin@newstore.com.br";

/**
 * Se for admin, redireciona para /admin; caso contrário, renderiza os filhos.
 */
export default function NonAdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null; // pode exibir um spinner se quiser

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;
  if (isAdmin) return <Navigate to="/admin" replace />;

  return children;
}
