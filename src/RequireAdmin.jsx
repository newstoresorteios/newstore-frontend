// src/RequireAdmin.jsx
import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./authContext";

const ADMIN_EMAIL = "admin@newstore.com.br";
const API_BASE = (process.env.REACT_APP_API_BASE_URL || "/api").replace(/\/+$/, "");

// Lê token salvo pelo login (o hook já grava isso)
function hasToken() {
  return Boolean(
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token")
  );
}

export default function RequireAdmin({ children }) {
  const { user, isAuthenticated, setUser } = useAuth?.() || {};
  const location = useLocation();

  const [loading, setLoading] = React.useState(false);
  const [me, setMe] = React.useState(user || null);

  // 1) se já tem user no contexto, usa
  React.useEffect(() => {
    if (user) setMe(user);
  }, [user]);

  // 2) se não tem user ainda, mas tem token, busca /api/me UMA vez
  React.useEffect(() => {
    let alive = true;
    async function fetchMe() {
      if (me || !hasToken()) return;
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
          if (alive) {
            setMe(u);
            // opcional: propaga pro contexto se existir setter
            if (setUser) setUser(u);
            try { localStorage.setItem("me", JSON.stringify(u)); } catch {}
          }
        }
      } catch {}
      finally { if (alive) setLoading(false); }
    }
    fetchMe();
    return () => { alive = false; };
  }, [me, setUser]);

  // Enquanto confirmado logado mas sem conseguir o "me" ainda, mostra spinner (evita redirecionar errado)
  if (hasToken() && !me && (loading || isAuthenticated)) {
    return (
      <Box sx={{ minHeight: "50vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  // Não logado → volta pro login
  if (!hasToken()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admin?
  const isAdmin =
    !!me?.is_admin || me?.email?.toLowerCase() === ADMIN_EMAIL;

  return isAdmin ? children : <Navigate to="/conta" replace />;
}
