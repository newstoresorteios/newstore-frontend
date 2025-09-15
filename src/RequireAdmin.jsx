// src/RequireAdmin.jsx
import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./authContext";

const ADMIN_EMAIL = "admin@newstore.com.br";

// Garante /api no fim mesmo se REACT_APP_API_BASE_URL vier sem /api
const RAW_API = process.env.REACT_APP_API_BASE_URL || "/api";
const API_BASE = (
  RAW_API.endsWith("/api") ? RAW_API : `${RAW_API.replace(/\/+$/, "")}/api`
).replace(/\/+$/, "");

// Lê token salvo pelo login (o hook já grava isso)
function hasToken() {
  return Boolean(
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token")
  );
}

// Header Authorization (além de cookies) — o backend aceita ambos
const authHeaders = () => {
  const tk =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token");
  return tk ? { Authorization: `Bearer ${tk}` } : {};
};

export default function RequireAdmin({ children }) {
  const { user, isAuthenticated, setUser } = useAuth?.() || {};
  const location = useLocation();

  const [loading, setLoading] = React.useState(false);
  const [me, setMe] = React.useState(user || null);

  // já tem user no contexto?
  React.useEffect(() => {
    if (user) setMe(user);
  }, [user]);

  // se tem token e ainda não temos "me", busca uma vez
  React.useEffect(() => {
    let alive = true;
    async function fetchMe() {
      if (me || !hasToken()) return;
      setLoading(true);
      try {
        const r = await fetch(`${API_BASE}/me`, {
          method: "GET",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          credentials: "include",
        });
        if (r.ok) {
          const body = await r.json();
          const u = body?.user || body || null;
          if (alive) {
            setMe(u);
            if (setUser) setUser(u); // propaga para o contexto
            try { localStorage.setItem("me", JSON.stringify(u)); } catch {}
          }
        }
      } catch {}
      finally {
        if (alive) setLoading(false);
      }
    }
    fetchMe();
    return () => { alive = false; };
  }, [me, setUser]);

  // Enquanto confirmado logado mas sem "me", mostra spinner (evita redirect errado)
  if (hasToken() && !me && (loading || isAuthenticated)) {
    return (
      <Box sx={{ minHeight: "50vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  // Não logado → login
  if (!hasToken()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // É admin?
  const isAdmin = !!me?.is_admin || me?.email?.toLowerCase() === ADMIN_EMAIL;

  return isAdmin ? children : <Navigate to="/conta" replace />;
}
