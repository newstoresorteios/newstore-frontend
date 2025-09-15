// src/RequireAdmin.jsx
import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./authContext";

const ADMIN_EMAIL = "admin@newstore.com.br";

// Garante que termine com /api
const RAW_API = process.env.REACT_APP_API_BASE_URL || "/api";
const API_BASE = (
  RAW_API.endsWith("/api") ? RAW_API : `${RAW_API.replace(/\/+$/, "")}/api`
).replace(/\/+$/, "");

const getToken = () =>
  localStorage.getItem("token") ||
  localStorage.getItem("access_token") ||
  sessionStorage.getItem("token");

export default function RequireAdmin({ children }) {
  const { user, setUser } = useAuth?.() || {};
  const location = useLocation();

  // tenta contexto e, se não tiver, usa o 'me' salvo localmente para evitar flicker/redirect precoce
  const [me, setMe] = React.useState(() => {
    if (user) return user;
    try { return JSON.parse(localStorage.getItem("me") || "null"); }
    catch { return null; }
  });
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (user) setMe(user);
  }, [user]);

  // Busca /api/me apenas se temos token e ainda não temos 'me'
  React.useEffect(() => {
    let alive = true;
    async function fetchMe() {
      if (!getToken() || me) return;
      setLoading(true);
      try {
        const r = await fetch(`${API_BASE}/me`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
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
      } finally {
        if (alive) setLoading(false);
      }
    }
    fetchMe();
    return () => { alive = false; };
  }, [me, setUser]);

  const token = getToken();

  // Não logado → login
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // **Correção principal**: enquanto não sabemos quem é o usuário (me null) OU estamos carregando,
  // seguramos aqui para não redirecionar errado para /conta.
  if (!me || loading) {
    return (
      <Box sx={{ minHeight: "50vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  const isAdmin = !!me.is_admin || String(me.email || "").toLowerCase() === ADMIN_EMAIL;
  return isAdmin ? children : <Navigate to="/conta" replace />;
}
