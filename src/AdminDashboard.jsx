// src/AdminDashboard.jsx
import * as React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar, Box, ButtonBase, Button, Container, CssBaseline, Divider,
  IconButton, Menu, MenuItem, Paper, Stack, TextField, ThemeProvider,
  Toolbar, Typography, createTheme
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

/* ---- helpers http ---- */
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
async function getJSON(pathOrUrl) {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : apiJoin(pathOrUrl);
  const r = await fetch(url, { headers: { "Content-Type": "application/json", ...authHeaders() }, credentials: "include" });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}
async function postJSON(path, body) {
  const url = apiJoin(path);
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify(body || {})
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

/* ---- UI helpers ---- */
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

  // resumo
  const [drawId, setDrawId] = React.useState(0);
  const [sold, setSold] = React.useState(0);
  const [remaining, setRemaining] = React.useState(0);
  const [priceInput, setPriceInput] = React.useState(""); // sempre string p/ evitar NaN

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getJSON("/admin/dashboard/summary");
        console.log("[AdminDashboard] GET /summary ->", data);

        if (!alive) return;
        setDrawId(Number(data?.draw_id) || 0);
        setSold(Number(data?.sold) || 0);
        setRemaining(Number(data?.remaining) || 0);

        // garante string e evita NaN no <input>
        const pc =
          Number.isFinite(Number(data?.price_cents))
            ? String(Number(data.price_cents))
            : "";
        setPriceInput(pc);
      } catch (e) {
        console.error("[AdminDashboard] GET /summary failed:", e);
      }
    })();
    return () => { alive = false; };
  }, []);

  const onUpdatePrice = async () => {
    const n = Math.max(0, Math.floor(Number(priceInput)));
    try {
      const resp = await postJSON("/admin/dashboard/price", { price_cents: n });
      console.log("[AdminDashboard] POST /price ->", resp);
      // Se quiser, dá um feedback visual/toast aqui
    } catch (e) {
      console.error("[AdminDashboard] POST /price failed:", e);
    }
  };

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

          {/* bloco de resumo + preço */}
          <Paper
            variant="outlined"
            sx={{
              width: "100%",
              p: { xs: 3, md: 4 },
              borderRadius: 4,
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "auto auto auto auto 1fr" },
              gap: 3,
              alignItems: "center",
            }}
          >
            <Box>
              <Typography sx={{ opacity: 0.8 }}>Nº Sorteio Atual</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: 28 }}>{drawId || "-"}</Typography>
            </Box>

            <Box>
              <Typography sx={{ opacity: 0.8 }}>Nºs Vendidos</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: 28 }}>{sold}</Typography>
            </Box>

            <Box>
              <Typography sx={{ opacity: 0.8 }}>Nºs Restantes</Typography>
              <Typography sx={{ fontWeight: 900, fontSize: 28 }}>{remaining}</Typography>
            </Box>

            <Button
              variant="outlined"
              color="success"
              onClick={() => navigate("/admin/sorteios")}
              sx={{ height: 44, px: 3, fontWeight: 800 }}
            >
              NOVO SORTEIO
            </Button>

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 2, alignItems: "center" }}>
              <Typography sx={{ opacity: 0.8, fontWeight: 700 }}>Valor por Ticket</Typography>
              <Box />
              <TextField
                size="small"
                type="number"
                inputProps={{ min: 0, step: 1 }}
                value={priceInput}
                onChange={(e) => {
                  const v = e.target.value;
                  // aceita vazio, ou inteiro >= 0
                  if (v === "") return setPriceInput("");
                  const n = Math.max(0, Math.floor(Number(v)));
                  setPriceInput(String(n));
                }}
                placeholder="em centavos (ex.: 100 = R$ 1,00)"
                sx={{ maxWidth: 240 }}
              />
              <Button variant="contained" color="success" onClick={onUpdatePrice} sx={{ height: 40, px: 3 }}>
                ATUALIZAR
              </Button>
            </Box>
          </Paper>

          {/* cards */}
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
