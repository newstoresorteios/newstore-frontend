// src/AdminVencedores.jsx
import * as React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar, Box, Container, CssBaseline, IconButton, Menu, MenuItem, Divider,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ThemeProvider, Toolbar, Typography, createTheme
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import logoNewStore from "./Logo-branca-sem-fundo-768x132.png";
import { useAuth } from "./authContext";

const theme = createTheme({
  palette: {
    mode: "dark",
    background: { default: "#0E0E0E", paper: "#121212" },
    success: { main: "#67C23A" },
    error:   { main: "#D32F2F" },
  },
});

/* ---------- API base util ---------- */
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
  return tk ? { Authorization: `Bearer ${String(tk).replace(/^Bearer\s+/i,"").replace(/^["']|["']$/g,"")}` } : {};
};
async function getJSON(pathOrUrl) {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : apiJoin(pathOrUrl);
  const r = await fetch(url, { headers: { "Content-Type": "application/json", ...authHeaders() }, credentials: "include" });
  // trata 204 (sem corpo) para não quebrar no r.json()
  if (r.status === 204) return null;
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

/* ---------- helpers ---------- */
const pad3 = (n) => (n != null ? String(n).padStart(3, "0") : "--");
const fmtDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("pt-BR");
};
const daysSince = (from) => {
  const a = new Date(from);
  if (Number.isNaN(a)) return "-";
  return Math.max(0, Math.floor((Date.now() - a.getTime()) / 86400000));
};

// monta linhas a partir do endpoint de winners
const mapWinners = (list) =>
  (list || []).map((w) => ({
    key: `${w.draw_id}-${w.realized_at || ""}`,
    nome: w.winner_name || "-",
    numero: w.draw_id,
    data: fmtDate(w.realized_at),
    status: w.status || (w.redeemed ? "RESGATADO" : "NÃO RESGATADO"),
    dias: w.days_since ?? daysSince(w.realized_at),
  }));

// fallback: monta a partir de /draws history
function mapFromDraws(payload) {
  const arr = Array.isArray(payload)
    ? payload
    : payload?.history || payload?.draws || payload?.items || [];
  return arr
    .filter((d) => d.realized_at || d.realizedAt || d.realizado_em)
    .map((d) => {
      const realized =
        d.realized_at || d.realizedAt || d.realizado_em || d.data_realizacao;
      const closed   = d.closed_at   || d.closedAt   || d.fechado_em         ;
      const winner   =
        d.winner_name ||
        d.vencedor_nome ||
        d.winner?.name ||
        "-";
      const id = d.id ?? d.draw_id ?? d.numero ?? d.n ?? null;

      return {
        key: `${id}-${realized || ""}`,
        nome: winner || "-",
        numero: id,
        data: fmtDate(realized),
        status: closed ? "RESGATADO" : "NÃO RESGATADO",
        dias: daysSince(realized),
      };
    })
    .sort((a, b) => (b.numero || 0) - (a.numero || 0));
}

export default function AdminVencedores() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 1) tenta o endpoint dedicado
        const payload = await getJSON("/admin/winners"); // { winners: [...] } ou null
        const list = Array.isArray(payload?.winners) ? payload.winners : [];
        let lines = mapWinners(list);

        // 2) fallback se veio vazio ou null
        if (!lines.length) {
          const drawsPayload =
            (await getJSON("/admin/draws/history")
              .catch(() => getJSON("/draws/history"))
            ) || null;
          lines = mapFromDraws(drawsPayload);
        }

        if (alive) setRows(lines);
      } catch (e) {
        console.error("[AdminVencedores] fetch error:", e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

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

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
        <Typography align="center" sx={{ fontWeight: 900, lineHeight: 1.1, fontSize: { xs: 26, md: 48 }, mb: 3 }}>
          Lista de Vencedores
          <br /> dos Sorteios
        </Typography>

        <Paper variant="outlined">
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table sx={{ minWidth: 800 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>NOME DO USUÁRIO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Nº SORTEIO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>DATA DO SORTEIO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>SITUAÇÃO DO PRÊMIO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>DIAS CONTEMPLADO</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={5}>Carregando…</TableCell></TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow><TableCell colSpan={5} sx={{ color: "#bbb" }}>Nenhum vencedor encontrado.</TableCell></TableRow>
                )}
                {rows.map((w) => (
                  <TableRow key={w.key} hover>
                    <TableCell>{w.nome}</TableCell>
                    <TableCell>{pad3(w.numero)}</TableCell>
                    <TableCell>{w.data}</TableCell>
                    <TableCell sx={{ color: w.status === "RESGATADO" ? "success.main" : "error.main", fontWeight: 800 }}>
                      {w.status}
                    </TableCell>
                    <TableCell>{w.dias}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>
    </ThemeProvider>
  );
}
