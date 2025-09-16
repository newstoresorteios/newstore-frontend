// src/AdminDashboard.jsx
import * as React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar, Box, Button, Container, CssBaseline, Divider,
  IconButton, Menu, MenuItem, Paper, Stack,
  TextField, ThemeProvider, Toolbar, Typography, createTheme
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import logoNewStore from "./Logo-branca-sem-fundo-768x132.png";
import { useAuth } from "./authContext";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#2E7D32" },
    background: { default: "#0E0E0E", paper: "#121212" },
    warning: { main: "#B58900" },
  },
  shape: { borderRadius: 16 },
  typography: { fontFamily: ["Inter","system-ui","Segoe UI","Roboto","Arial"].join(",") },
});

/* ---- helpers de API ---- */
const RAW_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_BASE ||
  "/api";
const API_BASE = String(RAW_BASE).replace(/\/+$/, "");
const apiJoin = (path) => {
  let p = path.startsWith("/") ? path : `/${path}`;
  if (API_BASE.endsWith("/api") && p.startsWith("/api/")) p = p.slice(4);
  return `${API_BASE}${p}`;
};
const authHeaders = () => {
  const tk =
    localStorage.getItem("ns_auth_token") ||
    sessionStorage.getItem("ns_auth_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token");
  return tk
    ? { Authorization: `Bearer ${String(tk).replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "")}` }
    : {};
};
async function getJSON(path) {
  const r = await fetch(apiJoin(path), {
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
async function postJSON(path, body, method = "POST") {
  const r = await fetch(apiJoin(path), {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json().catch(() => ({}));
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // resumo
  const [drawId, setDrawId] = React.useState(null);
  const [sold, setSold] = React.useState(0);
  const [remaining, setRemaining] = React.useState(0);
  const [price, setPrice] = React.useState("");       // em centavos (string para input)
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const loadSummary = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await getJSON("/admin/dashboard/summary");
      setDrawId(r.draw_id ?? null);
      setSold(r.sold ?? 0);
      setRemaining(r.remaining ?? 0);
      setPrice(
        Number.isFinite(Number(r.price_cents))
          ? String(Number(r.price_cents))
          : ""
      );
      console.log("[AdminDashboard] GET /summary", r);
    } catch (e) {
      console.error("[AdminDashboard] GET /summary failed:", e);
      setDrawId(null);
      setSold(0);
      setRemaining(0);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadSummary(); }, [loadSummary]);

  // ações
  const onSavePrice = async () => {
    try {
      setSaving(true);
      const n = Math.max(0, Math.floor(Number(price || 0)));
      await postJSON("/admin/config/ticket-price", { price_cents: n }, "PATCH");
      await loadSummary();
    } catch (e) {
      console.error("[AdminDashboard] PATCH ticket-price failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const onNewDraw = async () => {
    try {
      setCreating(true);
      await postJSON("/admin/dashboard/new", {});
      await loadSummary();
    } catch (e) {
      console.error("[AdminDashboard] POST /new failed:", e);
    } finally {
      setCreating(false);
    }
  };

  // menu
  const [menuEl, setMenuEl] = React.useState(null);
  const open = Boolean(menuEl);
  const openMenu = (e) => setMenuEl(e.currentTarget);
  const closeMenu = () => setMenuEl(null);
  const goPainel = () => { closeMenu(); navigate("/admin"); };
  const doLogout = () => { closeMenu(); logout(); navigate("/"); };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <AppBar position="sticky" elevation={0} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Toolbar sx={{ position: "relative", minHeight: 64 }}>
          <IconButton edge="start" color="inherit" onClick={() => navigate("/admin")} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>

          <Box component={RouterLink} to="/admin"
               sx={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
            <Box component="img" src={logoNewStore} alt="NEW STORE" sx={{ height: 40 }} />
          </Box>

          <IconButton color="inherit" sx={{ ml: "auto" }} onClick={openMenu}>
            <AccountCircleRoundedIcon />
          </IconButton>
          <Menu anchorEl={menuEl} open={open} onClose={closeMenu}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}>
            <MenuItem onClick={goPainel}>Painel (Admin)</MenuItem>
            <Divider />
            <MenuItem onClick={doLogout}>Sair</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
        <Stack spacing={4} alignItems="center">
          <Typography sx={{ fontWeight: 900, textAlign: "center", lineHeight: 1.1, fontSize: { xs: 28, md: 56 } }}>
            Painel de Controlo
            <br /> dos Sorteios
          </Typography>

          <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, width: "100%" }}>
            <Stack direction="row" spacing={4} alignItems="center" flexWrap="wrap">
              <Stack>
                <Typography sx={{ opacity: 0.7, fontWeight: 700 }}>Nº Sorteio Atual</Typography>
                <Typography variant="h4" sx={{ fontWeight: 900 }}>
                  {loading ? "…" : drawId ?? "-"}
                </Typography>
              </Stack>

              <Stack>
                <Typography sx={{ opacity: 0.7, fontWeight: 700 }}>Nºs Vendidos</Typography>
                <Typography variant="h4" sx={{ fontWeight: 900 }}>{loading ? "…" : sold}</Typography>
              </Stack>

              <Stack>
                <Typography sx={{ opacity: 0.7, fontWeight: 700 }}>Nºs Restantes</Typography>
                <Typography variant="h4" sx={{ fontWeight: 900 }}>{loading ? "…" : remaining}</Typography>
              </Stack>

              <Box sx={{ flex: 1 }} />

              <Button
                onClick={onNewDraw}
                disabled={creating}
                variant="outlined"
                sx={{ borderRadius: 999, px: 3 }}
              >
                {creating ? "Criando..." : "NOVO SORTEIO"}
              </Button>
            </Stack>

            <Divider sx={{ my: 3 }} />

            <Typography sx={{ opacity: 0.7, fontWeight: 700, mb: 1 }}>Valor por Ticket</Typography>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="em centavos (ex.: 100 = R$ 1,00)"
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                sx={{ maxWidth: 320 }}
              />
              <Button
                onClick={onSavePrice}
                disabled={saving}
                variant="contained"
                color="primary"
                sx={{ borderRadius: 999, px: 3 }}
              >
                {saving ? "Salvando..." : "ATUALIZAR"}
              </Button>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </ThemeProvider>
  );
}
