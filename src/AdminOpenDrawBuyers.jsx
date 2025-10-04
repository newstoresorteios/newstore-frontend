// src/AdminOpenDrawBuyers.jsx
import * as React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar, Box, Button, Chip, Container, CssBaseline, Divider, IconButton,
  Paper, Stack, Tab, Tabs, TextField, ThemeProvider, Toolbar, Typography, createTheme,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import logoNewStore from "./Logo-branca-sem-fundo-768x132.png";
import { useAuth } from "./authContext";

/* ---------- tema ---------- */
const theme = createTheme({
  palette: { mode: "dark", primary: { main: "#2E7D32" }, background: { default: "#0E0E0E", paper: "#121212" } },
  shape: { borderRadius: 16 },
  typography: { fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(",") },
});

/* ---------- helpers de API (iguais ao AdminDashboard) ---------- */
const RAW_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_BASE ||
  "/api";
const API_BASE = String(RAW_BASE).replace(/\/+$/, "");

const apiJoin = (path) => {
  let p = path.startsWith("/") ? path : `/${path}`;
  const baseHasApi = /\/api\/?$/.test(API_BASE);
  if (baseHasApi && p.startsWith("/api/")) p = p.slice(4);
  if (!baseHasApi && !p.startsWith("/api/")) p = `/api${p}`;
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
  const r = await fetch(apiJoin(path), { headers: { "Content-Type": "application/json", ...authHeaders() }, credentials: "omit", cache: "no-store" });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

/* ---------- util ---------- */
const pad2 = (n) => String(n).padStart(2, "0");
const buyerColor = (idx) => {
  const palette = [
    "#59d98e","#5bb6ff","#ffb74d","#e57373","#ba68c8","#4db6ac","#7986cb",
    "#aed581","#90a4ae","#f06292","#9575cd","#4fc3f7","#81c784","#ff8a65",
  ];
  return palette[idx % palette.length];
};

export default function AdminOpenDrawBuyers() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [tab, setTab] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [drawId, setDrawId] = React.useState(null);
  const [sold, setSold] = React.useState(0);
  const [remaining, setRemaining] = React.useState(0);
  const [buyers, setBuyers] = React.useState([]);      // [{user_id, name, email, numbers[], count, total_cents}]
  const [numbers, setNumbers] = React.useState([]);    // [{n, user_id, name, email}]
  const [query, setQuery] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await getJSON("/admin/dashboard/open-buyers");
      setDrawId(r.draw_id ?? null);
      setSold(r.sold ?? 0);
      setRemaining(r.remaining ?? Math.max(0, 100 - Number(r.sold || 0)));
      setBuyers(Array.isArray(r.buyers) ? r.buyers : []);
      setNumbers(Array.isArray(r.numbers) ? r.numbers : []);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { load(); }, [load]);

  // Map de user_id -> idx/color
  const idToIdx = React.useMemo(() => {
    const ids = buyers.map(b => b.user_id);
    const map = new Map();
    let k = 0;
    ids.forEach(id => { if (!map.has(id)) { map.set(id, k++); } });
    return map;
  }, [buyers]);

  const filteredBuyers = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter(b =>
      String(b.name || "").toLowerCase().includes(q) ||
      String(b.email || "").toLowerCase().includes(q) ||
      (Array.isArray(b.numbers) && b.numbers.some(n => pad2(n).includes(q)))
    );
  }, [buyers, query]);

  const exportCSV = () => {
    const rows = [];
    rows.push(["draw_id","user_id","name","email","count","numbers","total_cents"]);
    buyers.forEach(b => {
      rows.push([
        drawId,
        b.user_id,
        (b.name || "").replaceAll(","," "),
        (b.email || "").replaceAll(","," "),
        b.count,
        (b.numbers || []).map(pad2).join(" "),
        b.total_cents || 0
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sorteio_${drawId}_compradores.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

          <IconButton color="inherit" sx={{ ml: "auto" }}>
            <AccountCircleRoundedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
        <Stack spacing={2.5}>
          <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, md: 28 } }}>
            Sorteio Ativo — Compradores
          </Typography>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4 }}>
            <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
              <Stack>
                <Typography sx={{ opacity: .7, fontWeight: 700 }}>Nº Sorteio</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{loading ? "…" : (drawId ?? "-")}</Typography>
              </Stack>
              <Stack>
                <Typography sx={{ opacity: .7, fontWeight: 700 }}>Vendidos (aprovados)</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{loading ? "…" : sold}</Typography>
              </Stack>
              <Stack>
                <Typography sx={{ opacity: .7, fontWeight: 700 }}>Restantes</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900 }}>{loading ? "…" : remaining}</Typography>
              </Stack>

              <Box sx={{ flex: 1 }} />

              <TextField
                size="small"
                placeholder="Buscar por nome, e-mail ou número…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                sx={{ minWidth: { xs: "100%", sm: 280 } }}
              />

              <Button startIcon={<DownloadRoundedIcon />} onClick={exportCSV} variant="outlined">
                Exportar CSV
              </Button>
            </Stack>

            <Divider sx={{ my: 2.5 }} />

            <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="primary" indicatorColor="primary">
              <Tab label="Por comprador" />
              <Tab label="Por número (00–99)" />
            </Tabs>

            {/* --- Tab 1: Compradores --- */}
            {tab === 0 && (
              <Box sx={{ mt: 2 }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800 }}>Comprador</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>E-mail</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>Qtd</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>Números</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>Valor (R$)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredBuyers.length === 0 && (
                        <TableRow><TableCell colSpan={5} sx={{ color: "#bbb" }}>Nenhum comprador.</TableCell></TableRow>
                      )}
                      {filteredBuyers.map((b, i) => (
                        <TableRow key={b.user_id || i}>
                          <TableCell sx={{ fontWeight: 700 }}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Chip size="small" label={pad2(i+1)} sx={{ bgcolor: buyerColor(idToIdx.get(b.user_id) ?? i), color: "#000", fontWeight: 800 }} />
                              <span>{b.name || "(sem nome)"}</span>
                            </Stack>
                          </TableCell>
                          <TableCell>{b.email || "-"}</TableCell>
                          <TableCell>{b.count || 0}</TableCell>
                          <TableCell sx={{ maxWidth: 520, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {(b.numbers || []).map(pad2).join(", ")}
                          </TableCell>
                          <TableCell>
                            {((b.total_cents || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            )}

            {/* --- Tab 2: Grade 00–99 --- */}
            {tab === 1 && (
              <Box sx={{ mt: 2 }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "repeat(10, 1fr)", md: "repeat(20, 1fr)" },
                    gap: .6,
                  }}
                >
                  {Array.from({ length: 100 }, (_, n) => {
                    const owner = numbers.find(x => Number(x.n) === n);
                    const idx   = owner ? (idToIdx.get(owner.user_id) ?? 0) : 0;
                    const bg    = owner ? buyerColor(idx) : "transparent";
                    const bd    = owner ? "none" : "1px solid rgba(255,255,255,.18)";
                    const fg    = owner ? "#000" : "inherit";
                    const title = owner ? `${pad2(n)} • ${owner.name || owner.email || "Comprador"}` : pad2(n);
                    return (
                      <Box
                        key={n}
                        title={title}
                        sx={{
                          userSelect: "none",
                          textAlign: "center",
                          py: .8,
                          borderRadius: 1.5,
                          fontWeight: 800,
                          letterSpacing: .5,
                          fontSize: 12,
                          border: bd,
                          bgcolor: bg,
                          color: fg,
                        }}
                      >
                        {pad2(n)}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}
          </Paper>
        </Stack>
      </Container>
    </ThemeProvider>
  );
}
