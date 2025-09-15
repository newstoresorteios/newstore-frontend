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

// --- helpers de auth/token ---------------------------------------------------
function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    ""
  );
}
function hasToken() {
  return !!getToken();
}
function authHeaders() {
  const tk = getToken();
  return tk ? { Authorization: `Bearer ${tk}` } : {};
}
function safeParseJSON(s) {
  try { return JSON.parse(s); } catch { return null; }
}
function safeDecodeJWT(token) {
  // decodifica payload do JWT (sem validar assinatura) só para ler email/role
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
function isAdminUser(u) {
  if (!u) return false;
  if (u.is_admin === true) return true;
  const email = (u.email || u.user?.email || "").toLowerCase();
  return email === ADMIN_EMAIL;
}
// -----------------------------------------------------------------------------

export default function RequireAdmin({ children }) {
  const { user, isAuthenticated, setUser } = useAuth?.() || {};
  const location = useLocation();

  const [me, setMe] = React.useState(user || null);
  const [loading, setLoading] = React.useState(false);

  // 1) Semente de usuário: contexto -> localStorage("me") -> payload do JWT
  const seededUser = React.useMemo(() => {
    if (user) return user;

    const stored = safeParseJSON(localStorage.getItem("me") || "null");
    if (stored) return stored;

    const payload = safeDecodeJWT(getToken());
    if (payload?.email || payload?.user?.email) {
      return { email: payload.email || payload.user?.email, is_admin: !!payload.is_admin };
    }
    return null;
  }, [user]);

  // propaga semente para estado/ctx
  React.useEffect(() => {
    if (seededUser && !me) {
      setMe(seededUser);
      if (setUser) setUser(seededUser);
    }
  }, [seededUser, me, setUser]);

  // 2) Busca /api/me apenas se ainda não conseguimos decidir com a semente
  React.useEffect(() => {
    let alive = true;

    async function fetchMe() {
      if (!hasToken()) return;                 // sem token -> login
      if (isAdminUser(me || seededUser)) return; // já sabemos que é admin
      if (loading) return;                     // evita chamadas repetidas

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
          if (alive && u) {
            setMe(u);
            if (setUser) setUser(u);
            try { localStorage.setItem("me", JSON.stringify(u)); } catch {}
          }
        }
      } catch {
        // silencioso — deixamos a decisão cair nos fallbacks abaixo
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchMe();
    return () => { alive = false; };
  }, [me, seededUser, setUser, loading]);

  // --- decisões de render ----------------------------------------------------
  if (!hasToken()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se qualquer fonte já comprova admin, libera imediatamente
  if (isAdminUser(me || seededUser)) {
    return children;
  }

  // Temos token, não conseguimos afirmar admin ainda -> aguarda /me
  if (isAuthenticated || loading) {
    return (
      <Box sx={{ minHeight: "50vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  // Não é admin → manda para a área do cliente
  return <Navigate to="/conta" replace />;
}
