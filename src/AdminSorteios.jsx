// src/AdminSorteios.jsx
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
  palette: { mode: "dark", background: { default: "#0E0E0E", paper: "#121212" } },
});

/* ---------- API base normalizada (mesma lógica do AccountPage) ---------- */
const RAW_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_BASE ||
  "/api";

function normalizeApiBase(b) {
  if (!b) return "/api";
  let base = String(b).replace(/\/+$/, "");
  // se for http(s) e não terminar com /api, acrescenta /api
  if (/^https?:\/\//i.test(base) && !/\/api$/i.test(base)) base += "/api";
  return base;
}
const API_BASE = normalizeApiBase(RAW_BASE);

const apiJoin = (path) => {
  let p = path;
  if (!p.startsWith("/")) p = `/${p}`;
  // evita .../api + /api/...
  if (API_BASE.endsWith("/api") && p.startsWith("/api/")) p = p.slice(4);
  return `${API_BASE}${p}`;
};

/* ---------- helpers ---------- */
const pad3 = (n) => (n != null ? String(n).padStart(3, "0") : "--");
const fmtDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
};
const daysBetween = (start, end) => {
  const a = new Date(start), b = new Date(end || Date.now());
  if (Number.isNaN(a) || Number.isNaN(b)) return "-";
  const ms = Math.max(0, b - a);
  return Math.round(ms / (1000 * 60 * 60 * 24));
};

const authHeaders = () => {
  const tk =
    localStorage.getItem("ns_auth_token") ||
    sessionStorage.getItem("ns_auth_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token");
  return tk ? { Authorization: `Bearer ${tk}` } : {};
};

async function getJSON(pathOrUrl) {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : apiJoin(pathOrUrl);
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

async function getFirst(paths) {
  for (const p of paths) {
    try {
      return await getJSON(p);
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

/** Normaliza o payload da API em linhas para a tabela */
function buildRows(payload) {
  const arr = Array.isArray(payload)
    ? payload
    : payload?.history || payload?.draws || payload?.items || [];

  return (arr || [])
    .map((it) => {
      const id = it.id ?? it.draw_id ?? it.numero ?? it.n ?? null;
      const opened = it.opened_at ?? it.created_at ?? it.abertura ?? null;
      const closed = it.closed_at ?? it.fechado_em ?? it.fechamento ?? null;
      const realized =
        it.realized_at ?? it.raffled_at ?? it.data_realizacao ?? it.realizacao ?? null;

      const winner =
        it.winner_name ??
        it.vencedor_nome ??
        it.winner_name ??
        it.winner?.name ??
        it.usuario_vencedor ??
        "-";

      const dias =
        it.days_open ??
        it.dias_aberto ??
        (opened ? daysBetween(opened, closed) : "-");

      return {
        n: id,
        abertura: fmtDate(opened),
        fechamento: fmtDate(closed),
        dias,
        realizacao: fmtDate(realized),
        vencedor: winner || "-",
      };
    })
    .filter((r) => r.n != null)
    .sort((a, b) => Number(b.n || 0) - Number(a.n || 0));
}

export default function AdminSorteios() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [menuEl, setMenuEl] = React.useState(null);
  const open = Boolean(menuEl);
  const openMenu = (e) => setMenuEl(e.currentTarget);
  const closeMenu = () => setMenuEl(null);
  const goPainel = () => { closeMenu(); navigate("/admin"); };
  const doLogout = () => { closeMenu(); logout(); navigate("/"); };

  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // tenta os fechados, depois history, depois lista geral
        const payload = await getFirst([
          "/draws?status=closed",
          "/admin/draws?status=closed",
          "/draws/history",
          "/admin/draws/history",
          "/draws",
        ]);
        if (alive && payload) setRows(buildRows(payload));
      } catch (e) {
        console.error("[admin/draws] fetch error:", e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

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
            sx={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
          >
            <Box component="img" src={logoNewStore} alt="NEW STORE" sx={{ height: 40 }} />
          </Box>
          <IconButton color="inherit" sx={{ ml: "auto" }} onClick={openMenu}>
            <AccountCircleRoundedIcon />
          </IconButton>
          <Menu
            anchorEl={menuEl}
            open={open}
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

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 6 } }}>
        <Typography align="center" sx={{ fontWeight: 900, lineHeight: 1.1, fontSize: { xs: 26, md: 48 }, mb: 3 }}>
          Lista de Sorteios
          <br /> Realizados
        </Typography>

        <Paper variant="outlined">
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table sx={{ minWidth: 920 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Nº SORTEIO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>DATA ABERTURA</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>DATA FECHAMENTO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>DIAS ABERTO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>DATA REALIZAÇÃO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>USUÁRIO VENCEDOR</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6}>Carregando…</TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ color: "#bbb" }}>
                      Nenhum sorteio encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((d) => (
                  <TableRow key={d.n} hover>
                    <TableCell>{pad3(d.n)}</TableCell>
                    <TableCell>{d.abertura}</TableCell>
                    <TableCell>{d.fechamento}</TableCell>
                    <TableCell>{d.dias}</TableCell>
                    <TableCell>{d.realizacao}</TableCell>
                    <TableCell>{d.vencedor}</TableCell>
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
