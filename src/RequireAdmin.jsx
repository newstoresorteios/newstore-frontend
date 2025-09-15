// src/RequireAdmin.jsx
import * as React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Box, CircularProgress } from "@mui/material";
import { useAuth } from "./authContext";

const ADMIN_EMAIL = "admin@newstore.com.br";

// Garante que tenha /api no final mesmo se REACT_APP_API_BASE_URL vier sem /api
const RAW_API = process.env.REACT_APP_API_BASE_URL || "/api";
const API_BASE = (
  RAW_API.endsWith("/api") ? RAW_API : `${RAW_API.replace(/\/+$/, "")}/api`
).replace(/\/+$/, "");

// Header Authorization (opcional — se existir token salvo, enviamos também)
const authHeaders = () => {
  const tk =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token");
  return tk ? { Authorization: `Bearer ${tk}` } : {};
};

export default function RequireAdmin({ children }) {
  const { user, setUser } = useAuth?.() || {};
  const location = useLocation();

  // me === undefined => ainda não verificamos
  // me === null      => verificado e NÃO logado
  // me === objeto    => verificado e logado
  const [me, setMe] = React.useState(user ?? undefined);

  // Se já tem user no contexto, usa imediatamente
  React.useEffect(() => {
    if (user && me === undefined) setMe(user);
  }, [user, me]);

  // Sempre tenta descobrir o "me" via backend (cookie ou token)
  React.useEffect(() => {
    if (me !== undefined) return; // já sabemos algo (null ou objeto)
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API_BASE}/me`, {
          method: "GET",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          credentials: "include", // importantíssimo: envia cookie httpOnly
        });
        if (r.ok) {
          const body = await r.json();
          const u = body?.user || body || null;
          if (!alive) return;
          setMe(u);
          if (u && setUser) setUser(u); // propaga para o contexto
          try { localStorage.setItem("me", JSON.stringify(u)); } catch {}
        } else {
          if (!alive) return;
          setMe(null); // não autenticado
        }
      } catch {
        if (!alive) return;
        setMe(null); // erro na chamada => trata como não autenticado
      }
    })();
    return () => { alive = false; };
  }, [me, setUser]);

  // Enquanto não sabemos (carregando), mostra spinner e evita piscada/redirect errado
  if (me === undefined) {
    return (
      <Box sx={{ minHeight: "50vh", display: "grid", placeItems: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  // Não logado => manda para login
  if (!me) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Checagem de admin
  const isAdmin = !!me.is_admin || me.email?.toLowerCase() === ADMIN_EMAIL;

  return isAdmin ? children : <Navigate to="/conta" replace />;
}
