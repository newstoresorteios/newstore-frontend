import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./authContext";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return null; // pode renderizar um spinner aqui
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}
