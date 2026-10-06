// src/AdminVencedores.jsx
import * as React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar, Box, Container, CssBaseline, IconButton, Menu, MenuItem, Divider,
  Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ThemeProvider, Toolbar, Typography, createTheme, TextField, Button
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
    error: { main: "#D32F2F" },
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
  return tk
    ? { Authorization: `Bearer ${String(tk).replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "")}` }
    : {};
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
async function patchJSON(path, body) {
  const url = apiJoin(path);
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify(body || {}),
  });
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

// Contrato de vencedores: principal usa o padrao; adicional usa ?draw_type=adicional.
const WINNERS_PATH = "/api/admin/winners";
const winnersListPath = (mode) =>
  mode === "additional" ? `${WINNERS_PATH}?draw_type=adicional` : WINNERS_PATH;
const winnerPatchPath = (mode, drawId) =>
  mode === "additional"
    ? `${WINNERS_PATH}/${drawId}?draw_type=adicional`
    : `${WINNERS_PATH}/${drawId}`;

export default function AdminVencedores() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [savingId, setSavingId] = React.useState(null);
  const [winnerMode, setWinnerMode] = React.useState("principal");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError(false);
      setRows([]);
      try {
        const payload = await getJSON(winnersListPath(winnerMode));
        const list = Array.isArray(payload)
          ? payload
          : payload?.draws ||
            payload?.secondary_winners ||
            payload?.winners ||
            payload?.items ||
            (Array.isArray(payload?.data) ? payload.data : null) ||
            payload?.data?.draws ||
            payload?.data?.secondary_winners ||
            payload?.data?.winners ||
            payload?.data?.items ||
            [];
        if (!Array.isArray(list)) throw new Error("invalid_winners_payload");

        const lines = list.map((w) => ({
          key: `${winnerMode}-${w.id ?? w.draw_id ?? w.secondary_draw_id}-${w.realized_at ?? w.winner_number}`,
          winnerId: w.id ?? w.winner_id ?? w.winnerId ?? null,
          drawId: w.draw_id ?? w.secondary_draw_id ?? w.id,
          winnerUserId: w.winner_user_id ?? w.winnerUserId ?? w.user_id ?? null,
          nome: w.winner_name || "-",
          numero: w.draw_id ?? w.secondary_draw_id ?? w.id,
          numeroVencedor: (w.winner_number ?? "") === "" || w.winner_number == null ? "-" : w.winner_number,
          data: fmtDate(w.realized_at),
          status: w.status || (w.redeemed ? "RESGATADO" : "NÃO RESGATADO"),
          dias: w.days_since ?? "-",
          productName: w.product_name || "",
          productLink: w.product_link || "",
        }));

        if (alive) setRows(lines);
      } catch (e) {
        console.error("[AdminVencedores] fetch error:", e);
        if (alive) {
          setRows([]);
          setLoadError(true);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [winnerMode]);

  const updateField = (key, field, value) => {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  };

  const saveRow = async (row) => {
    try {
      setSavingId(row.drawId);
      // Somente campos editaveis do premio: nunca reenviar o resultado carregado
      // (winner_*, realized_at, status), que o engine pode ter definido depois.
      const body = {
        product_name: row.productName,
        product_link: row.productLink,
      };
      const resp = await patchJSON(winnerPatchPath(winnerMode, row.drawId), body);
      // garante sincronização local
      const updatedDraw = resp?.draw ?? resp?.data?.draw ?? resp;
      setRows((prev) =>
        prev.map((r) =>
          r.drawId === row.drawId
            ? {
                ...r,
                productName: updatedDraw?.product_name ?? r.productName,
                productLink: updatedDraw?.product_link ?? r.productLink,
              }
            : r
        )
      );
    } catch (e) {
      console.error("[AdminVencedores] save error:", e);
      alert("Não foi possível salvar os dados do produto.");
    } finally {
      setSavingId(null);
    }
  };

  // menu
  const [menuEl, setMenuEl] = React.useState(null);
  const open = Boolean(menuEl);
  const openMenu = (e) => setMenuEl(e.currentTarget);
  const closeMenu = () => setMenuEl(null);
  const goPainel = () => {
    closeMenu();
    navigate("/admin");
  };
  const doLogout = () => {
    closeMenu();
    logout();
    navigate("/");
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
          Lista de Vencedores
          <br /> dos Sorteios
        </Typography>

        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 2 }}>
          <Button
            variant={winnerMode === "principal" ? "contained" : "outlined"}
            color="success"
            onClick={() => setWinnerMode("principal")}
            sx={{ borderRadius: 999, fontWeight: 800 }}
          >
            Ganhador Sorteio Principal
          </Button>
          <Button
            variant={winnerMode === "additional" ? "contained" : "outlined"}
            color="success"
            onClick={() => setWinnerMode("additional")}
            sx={{ borderRadius: 999, fontWeight: 800 }}
          >
            Ganhadores Sorteios Adicionais
          </Button>
        </Stack>

        <Paper variant="outlined">
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table sx={{ minWidth: 1100 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>NOME DO USUÁRIO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Nº SORTEIO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>NÚMERO VENCEDOR</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>DATA DO SORTEIO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>SITUAÇÃO DO PRÊMIO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>DIAS CONTEMPLADO</TableCell>

                  {/* NOVAS COLUNAS EDITÁVEIS */}
                  <TableCell sx={{ fontWeight: 800, minWidth: 220 }}>PRODUTO</TableCell>
                  <TableCell sx={{ fontWeight: 800, minWidth: 260 }}>LINK DO PRODUTO</TableCell>
                  <TableCell sx={{ fontWeight: 800 }} align="right">AÇÕES</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={9}>Carregando…</TableCell></TableRow>
                )}
                {!loading && loadError && (
                  <TableRow>
                    <TableCell colSpan={9} role="alert" sx={{ color: "error.main" }}>
                      Não foi possível carregar os vencedores. Tente novamente.
                    </TableCell>
                  </TableRow>
                )}
                {!loading && !loadError && rows.length === 0 && (
                  <TableRow><TableCell colSpan={9} sx={{ color: "#bbb" }}>Nenhum vencedor encontrado.</TableCell></TableRow>
                )}
                {rows.map((w) => (
                  <TableRow key={w.key} hover>
                    <TableCell>{w.nome}</TableCell>
                    <TableCell>{pad3(w.numero)}</TableCell>
                    <TableCell>{w.numeroVencedor}</TableCell>
                    <TableCell>{w.data}</TableCell>
                    <TableCell sx={{ color: w.status === "RESGATADO" ? "success.main" : "error.main", fontWeight: 800 }}>
                      {w.status}
                    </TableCell>
                    <TableCell>{w.dias}</TableCell>

                    {/* PRODUTO (editável) */}
                    <TableCell>
                      <TextField
                        size="small"
                        placeholder="Nome do produto"
                        value={w.productName}
                        onChange={(e) => updateField(w.key, "productName", e.target.value)}
                        fullWidth
                      />
                    </TableCell>

                    {/* LINK DO PRODUTO (editável) */}
                    <TableCell>
                      <TextField
                        size="small"
                        placeholder="https://…"
                        value={w.productLink}
                        onChange={(e) => updateField(w.key, "productLink", e.target.value)}
                        fullWidth
                      />
                    </TableCell>

                    {/* AÇÕES */}
                    <TableCell align="right">
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => saveRow(w)}
                        disabled={savingId === w.drawId}
                      >
                        {savingId === w.drawId ? "Salvando…" : "Salvar"}
                      </Button>
                    </TableCell>
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
