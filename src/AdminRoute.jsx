// src/AdminRoute.jsx
import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./authContext";

const ADMIN_EMAIL = "admin@newstore.com.br";

export default function AdminRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null; // poderia exibir um spinner

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.email?.toLowerCase() !== ADMIN_EMAIL) {
    return <Navigate to="/" replace />;
  }

  return children;
}
