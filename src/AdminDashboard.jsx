// src/AdminDashboard.jsx
import * as React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar, Box, Button, ButtonBase, Container, CssBaseline, Divider, Grid,
  IconButton, Menu, MenuItem, Paper, Stack, TextField,
  ThemeProvider, Toolbar, Typography, createTheme
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
  typography: { fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(",") },
});

/* ---------- API utils ---------- */
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
    ? { Authorization: `Bearer ${String(tk).replace(/^Bearer\s+/i,"").replace(/^["']|["']$/g,"")}` }
    : {};
};
async function getJSON(path) {
  const url = /^https?:\/\//i.test(path) ? path : apiJoin(path);
  console.info("[AdminDashboard] GET", url);
  const r = await fetch(url, { headers: { "Content-Type": "application/json", ...authHeaders() }, credentials: "include" });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
async function putJSON(path, body) {
  const url = /^https?:\/\//i.test(path) ? path : apiJoin(path);
  console.info("[AdminDashboard] PUT", url, body);
  const r = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

function BigCard({ children, color, outlined = false, onClick }) {
  return (
    <ButtonBase onClick={onClick} sx={{ width: "100%" }}>
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          p: { xs: 3, md: 4 },
          borderRadius: 4,
          bgcolor: outlined ? "transparent" : color,
          border: outlined ? "1px solid rgba(255,255,255,0.16)" : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: { xs: 120, md: 140 },
          transition: "transform 120ms ease, filter 120ms ease",
          "&:hover": { transform: "translateY(-2px)", filter: "brightness(1.02)" },
          textAlign: "center",
        }}
      >
        <Typography
          sx={{
            fontWeight: 900,
            letterSpacing: 2,
            fontSize: { xs: 18, md: 28 },
            lineHeight: 1.25,
            color: outlined ? "rgba(255,255,255,0.85)" : "#fff",
            textTransform: "uppercase",
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        >
          {children}
        </Typography>
      </Paper>
    </ButtonBase>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [menuEl, setMenuEl] = React.useState(null);
  const menuOpen = Boolean(menuEl);
  const openMenu = (e) => setMenuEl(e.currentTarget);
  const closeMenu = () => setMenuEl(null);
  const goPainel = () => { closeMenu(); navigate("/admin"); };
  const doLogout = () => { closeMenu(); logout(); navigate("/"); };

  // resumo do sorteio atual / preço
  const [loading, setLoading] = React.useState(true);
  const [summary, setSummary] = React.useState({ draw_id: null, total: 0, sold: 0, remaining: 0 });
  const [priceCents, setPriceCents] = React.useState(5500);
  const [saving, setSaving] = React.useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const s = await getJSON("/api/admin/dashboard/summary");
      setSummary({ draw_id: s.draw_id, total: s.total, sold: s.sold, remaining: s.remaining });
      if (s.price_cents != null) setPriceCents(Number(s.price_cents));
    } catch (e) {
      console.error("[AdminDashboard] summary error:", e);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { refresh(); }, []);

  async function savePrice() {
    try {
      setSaving(true);
      await putJSON("/api/admin/dashboard/ticket-price", { price_cents: Number(priceCents) });
      await refresh();
    } catch (e) {
      console.error("[AdminDashboard] update price error:", e);
      alert("Falha ao atualizar o preço do ticket.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <AppBar position="sticky" elevation={0} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Toolbar sx={{ position: "relative", minHeight: 64 }}>
          <IconButton edge="start" color="inherit" onClick={() => navigate("/admin")} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>

          <Box
            component={RouterLink}
            to="/admin"
            sx={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)", display: "flex", alignItems: "center" }}
          >
            <Box component="img" src={logoNewStore} alt="NEW STORE" sx={{ height: 40, objectFit: "contain" }} />
          </Box>

          <IconButton color="inherit" sx={{ ml: "auto" }} onClick={openMenu} aria-label="Menu do usuário">
            <AccountCircleRoundedIcon />
          </IconButton>
          <Menu
            anchorEl={menuEl}
            open={menuOpen}
            onClose={closeMenu}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
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

          {/* BLOCO DE CONTROLE */}
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, width: "100%", borderRadius: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={3}>
                <Typography sx={{ fontWeight: 700 }}>Nº Sorteio Atual</Typography>
                <Typography sx={{ mt: 0.5, fontSize: 24, fontWeight: 900 }}>
                  {loading ? "—" : (summary.draw_id ?? "—")}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography sx={{ fontWeight: 700 }}>N°s Vendidos</Typography>
                <Typography sx={{ mt: 0.5, fontSize: 24, fontWeight: 900 }}>
                  {loading ? "—" : summary.sold}
                </Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <Typography sx={{ fontWeight: 700 }}>N°s Restantes</Typography>
                <Typography sx={{ mt: 0.5, fontSize: 24, fontWeight: 900 }}>
                  {loading ? "—" : summary.remaining}
                </Typography>
              </Grid>
              <Grid item xs={12} md={3} sx={{ display: "flex", justifyContent: { xs: "flex-start", md: "flex-end" } }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate("/admin/sorteios")}
                  sx={{ height: 40, fontWeight: 800 }}
                >
                  Novo Sorteio
                </Button>
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>

              <Grid item xs={12} md={3}>
                <Typography sx={{ fontWeight: 700 }}>Valor por Ticket</Typography>
              </Grid>
              <Grid item xs={6} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ min: 1 }}
                  value={priceCents}
                  onChange={(e) => setPriceCents(e.target.value)}
                  helperText="em centavos (ex.: 100 = R$ 1,00)"
                />
              </Grid>
              <Grid item xs={6} md={3}>
                <Button
                  variant="contained"
                  onClick={savePrice}
                  disabled={saving}
                  sx={{ height: 40, fontWeight: 800 }}
                >
                  {saving ? "Atualizando..." : "Atualizar"}
                </Button>
              </Grid>
            </Grid>
          </Paper>

          {/* Atalhos grandes */}
          <Stack spacing={3} sx={{ width: "100%" }}>
            <BigCard outlined onClick={() => navigate("/admin/sorteios")}>
              LISTA DE SORTEIOS
              <br /> REALIZADOS
            </BigCard>

            <BigCard color="primary.main" onClick={() => navigate("/admin/clientes")}>
              LISTA DE CLIENTES
              <br /> COM SALDO ATIVO
            </BigCard>

            <BigCard color="warning.main" onClick={() => navigate("/admin/vencedores")}>
              LISTA DE VENCEDORES
              <br /> DOS SORTEIOS
            </BigCard>
          </Stack>
        </Stack>
      </Container>
    </ThemeProvider>
  );
}
