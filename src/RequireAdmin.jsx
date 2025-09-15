// src/RequireAdmin.jsx
import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./authContext";

const ADMIN_EMAIL = "admin@newstore.com.br";

// garante base SEMPRE válida (nunca string vazia)
function getApiBase() {
  const raw = process.env.REACT_APP_API_BASE_URL;
  const base = (!raw || raw === "/") ? "/api" : raw;
  return base.replace(/\/+$/, ""); // sem barra final
}
const API_BASE = getApiBase();

// Authorization a partir do storage (fallback ao cookie via credentials)
function authHeaders() {
  const tk =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token");
  return tk ? { Authorization: `Bearer ${tk}` } : {};
}

// tem token salvo?
function hasToken() {
  return Boolean(
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token")
  );
}

export default function RequireAdmin({ children }) {
  const { user, isAuthenticated, setUser } = useAuth(); // use direto
  const location = useLocation();

  const [loading, setLoading] = React.useState(false);
  const [me, setMe] = React.useState(user || null);

  const storedMe = React.useMemo(() => {
    try { return JSON.parse(localStorage.getItem("me") || "null"); }
    catch { return null; }
  }, []);

  // se já temos usuário no contexto, sincroniza
  React.useEffect(() => {
    if (user) setMe(user);
  }, [user]);

  // se não temos user ainda mas temos token, tenta buscar /api/me UMA vez
  React.useEffect(() => {
    let alive = true;
    (async () => {
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
          if (alive && u) {
            setMe(u);
            if (setUser) setUser(u);
            try { localStorage.setItem("me", JSON.stringify(u)); } catch {}
          }
        }
      } catch {}
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [me, setUser]);

  // enquanto tem token e ainda estamos confirmando /me, mostra spinner
  if (hasToken() && !me && (loading || isAuthenticated)) {
    return (
      <Box sx={{ minHeight: "50vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  // não logado → login
  if (!hasToken()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // decide admin com base em me OR storedMe OR e-mail
  const ref = me || storedMe || {};
  const isAdmin =
    !!ref?.is_admin || ref?.email?.toLowerCase() === ADMIN_EMAIL;

  return isAdmin ? children : <Navigate to="/conta" replace />;
}
