// src/RequireAdmin.jsx
import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./authContext";

const ADMIN_EMAIL = "admin@newstore.com.br";
// Base pode ser "/api" (local) ou uma URL completa (Render/Vercel)
const API_BASE = (process.env.REACT_APP_API_BASE_URL || "/api").replace(/\/+$/, "");

// Lê token salvo pelo login (o hook já grava isso)
function hasToken() {
  return Boolean(
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token")
  );
}

function authHeaders() {
  const tk =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token");
  return tk ? { Authorization: `Bearer ${tk}` } : {};
}

// Tenta uma lista de endpoints possíveis para /me
async function fetchMe() {
  const candidates = [
    `${API_BASE}/me`,
    `${API_BASE}/users/me`,   // compat legada
    `${API_BASE}/api/me`,     // caso API_BASE seja domínio sem /api
    "/api/me",                // fallback quando o frontend proxyia /api
  ];

  for (const url of candidates) {
    try {
      const r = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
      });
      if (r.ok) {
        const body = await r.json();
        return body?.user || body || null;
      }
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

export default function RequireAdmin({ children }) {
  const { user, isAuthenticated, setUser } = useAuth?.() || {};
  const location = useLocation();

  const [loading, setLoading] = React.useState(false);
  const [me, setMe] = React.useState(user || null);

  // Se já tem user no contexto, usa
  React.useEffect(() => {
    if (user) setMe(user);
  }, [user]);

  // Se não tem user ainda mas tem token, busca /me uma vez
  React.useEffect(() => {
    let alive = true;
    (async () => {
      if (me || !hasToken()) return;
      setLoading(true);
      try {
        const u = await fetchMe();
        if (alive && u) {
          setMe(u);
          if (setUser) setUser(u); // propaga pro contexto, se disponível
          try { localStorage.setItem("me", JSON.stringify(u)); } catch {}
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [me, setUser]);

  // Enquanto confirmado logado mas sem conseguir o "me" ainda → spinner
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
