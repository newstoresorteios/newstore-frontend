// src/AdminUsersPage.jsx
import * as React from "react";
import {
  AppBar, Toolbar, IconButton, Typography, Container, CssBaseline, Paper, Stack,
  TextField, Button, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Checkbox, Divider, Snackbar, Alert, CircularProgress, createTheme, ThemeProvider
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import SaveRoundedIcon from "@mui/icons-material/SaveRounded";
import DeleteForeverRoundedIcon from "@mui/icons-material/DeleteForeverRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";

import { useNavigate } from "react-router-dom";
import { apiJoin, authHeaders } from "./lib/api";

/* --------------------------- THEME (igual às outras telas) --------------------------- */
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#67C23A" },
    secondary: { main: "#FFC107" },
    error: { main: "#D32F2F" },
    background: { default: "#0E0E0E", paper: "#121212" },
    success: { main: "#2E7D32" },
    warning: { main: "#B58900" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(","),
  },
});

/* ----------------------------------- Helpers ----------------------------------- */
function toBRL(valueNumber) {
  const n = Number(valueNumber || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function centsToBRLString(cents) {
  const v = (Number(cents || 0) / 100);
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function brlStringToCents(str) {
  if (str == null) return 0;
  const clean = String(str).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(clean);
  if (Number.isFinite(n)) return Math.round(n * 100);
  return 0;
}

/** Busca páginas até acabar, retornando lista normalizada. */
async function fetchAllUsersPaged(bases, pageSize = 500) {
  const headers = { "Content-Type": "application/json", ...authHeaders() };
  for (const base of bases) {
    try {
      // Novo backend: usa limit/offset e devolve { users, total, hasMore, limit, offset }
      let out = [];
      let ids = new Set();
      let offset = 0;

      for (;;) {
        const url = `${base}?limit=${pageSize}&offset=${offset}`;
        const r = await fetch(apiJoin(url), { headers, credentials: "include", cache: "no-store" });
        if (!r.ok) break;

        const j = await r.json().catch(() => ({}));
        const page = normalizeUsers(j);

        // evita duplicatas/loops
        const fresh = page.filter(u => !ids.has(u.id));
        fresh.forEach(u => ids.add(u.id));
        out = out.concat(fresh);

        // Preferir sinalização do servidor
        const srvHasMore = typeof j?.hasMore === "boolean"
          ? j.hasMore
          : (page.length > 0 && page.length === (Number(j?.limit) || pageSize));

        if (!srvHasMore || fresh.length === 0) break;

        // avança pelo passo informado pelo servidor; fallback para tam. da página
        const step = Number(j?.limit) || page.length || pageSize;
        const currentOffset = Number(j?.offset);
        offset = Number.isFinite(currentOffset) ? currentOffset + step : offset + step;
      }

      if (out.length > 0) return out;

      // Fallback (compat): se a rota não suporta paginação, tenta simples
      const r0 = await fetch(apiJoin(base), { headers, credentials: "include", cache: "no-store" });
      if (r0.ok) {
        const j0 = await r0.json().catch(() => ({}));
        const once = normalizeUsers(j0);
        if (once.length > 0) return once;
      }
    } catch {
      // tenta próximo base
    }
  }
  return [];
}

/* -------------------------------- Normalizadores -------------------------------- */
function normalizeUsers(payload) {
  const list = Array.isArray(payload)
    ? payload
    : payload?.users || payload?.items || [];
  return (list || []).map((u) => ({
    id: Number(u.id),
    name: u.name || "",
    email: u.email || "",
    phone: u.phone || u.cell || u.celular || u.telefone || "",
    is_admin: !!(u.is_admin || u.role === "admin"),
    created_at: u.created_at || u.createdAt || null,
    coupon_code: u.coupon_code || "",
    coupon_value_cents: Number(u.coupon_value_cents || 0),
  }));
}

/* ------------------------------------ Página ------------------------------------ */
export default function AdminUsersPage() {
  const navigate = useNavigate();

  // lista + busca
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [q, setQ] = React.useState("");

  // form
  const blank = {
    id: null, name: "", email: "", phone: "", is_admin: false,
    coupon_code: "", coupon_value_cents: 0,
  };
  const [form, setForm] = React.useState(blank);
  const [saldoStr, setSaldoStr] = React.useState("0,00");

  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState({ open: false, msg: "", sev: "success" });

  // atribuição de números
  const [drawId, setDrawId] = React.useState("");
  const [numbersCsv, setNumbersCsv] = React.useState("");
  const [assigning, setAssigning] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      // Usa somente o novo backend; mantém assinatura de função inalterada
      const list = await fetchAllUsersPaged(
        ["/admin/users"], 500
      );
      if (alive) {
        setUsers(list);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = React.useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(s) ||
        (u.email || "").toLowerCase().includes(s) ||
        (u.phone || "").toLowerCase().includes(s) ||
        (u.coupon_code || "").toLowerCase().includes(s)
    );
  }, [users, q]);

  function handleSelect(u) {
    setForm({
      id: u.id,
      name: u.name || "",
      email: u.email || "",
      phone: u.phone || "",
      is_admin: !!u.is_admin,
      coupon_code: u.coupon_code || "",
      coupon_value_cents: Number(u.coupon_value_cents || 0),
    });
    setSaldoStr(centsToBRLString(u.coupon_value_cents || 0));
  }
  function handleNew() {
    setForm(blank);
    setSaldoStr("0,00");
  }

  async function handleSave() {
    try {
      setSaving(true);
      const payload = {
        name: String(form.name || "").trim(),
        email: String(form.email || "").trim(),
        phone: String(form.phone || "").trim(),
        is_admin: !!form.is_admin,
        coupon_code: String(form.coupon_code || "").trim(),
        coupon_value_cents: brlStringToCents(saldoStr),
      };
      const url = form.id ? `/admin/users/${form.id}` : "/admin/users";
      const method = form.id ? "PUT" : "POST";

      const r = await fetch(apiJoin(url), {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("save_failed");
      const j = await r.json().catch(() => ({}));
      const saved = normalizeUsers([j])[0] || { ...form, ...payload, id: j?.id };

      setUsers((prev) => {
        const idx = prev.findIndex((x) => x.id === saved.id);
        if (idx >= 0) {
          const cp = prev.slice();
          cp[idx] = saved;
          return cp;
        }
        return [saved, ...prev];
      });
      setForm(saved);
      setSaldoStr(centsToBRLString(saved.coupon_value_cents || 0));
      setToast({ open: true, sev: "success", msg: "Salvo com sucesso." });
    } catch {
      setToast({ open: true, sev: "error", msg: "Não foi possível salvar." });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!form.id) return;
    if (!window.confirm("Excluir este usuário?")) return;
    try {
      setSaving(true);
      const r = await fetch(apiJoin(`/admin/users/${form.id}`), {
        method: "DELETE",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
      });
      if (!r.ok) throw new Error("delete_failed");
      setUsers((prev) => prev.filter((u) => u.id !== form.id));
      handleNew();
      setToast({ open: true, sev: "success", msg: "Excluído." });
    } catch {
      setToast({ open: true, sev: "error", msg: "Não foi possível excluir." });
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign() {
    if (!form.id) {
      setToast({ open: true, sev: "warning", msg: "Selecione um usuário na lista." });
      return;
    }
    const d = Number(drawId);
    const nums = String(numbersCsv || "")
      .split(/[,\s;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n));

    if (!Number.isInteger(d) || d <= 0 || nums.length === 0) {
      setToast({ open: true, sev: "warning", msg: "Informe um sorteio e pelo menos um número." });
      return;
    }

    try {
      setAssigning(true);
      const r = await fetch(apiJoin(`/admin/users/${form.id}/assign-numbers`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ user_id: form.id, draw_id: d, numbers: nums }),
      });
      if (!r.ok) throw new Error("assign_failed");
      setToast({ open: true, sev: "success", msg: "Números atribuídos com sucesso." });
      setDrawId("");
      setNumbersCsv("");
    } catch {
      setToast({ open: true, sev: "error", msg: "Falha ao atribuir números." });
    } finally {
      setAssigning(false);
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <AppBar position="sticky" elevation={0} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Toolbar sx={{ minHeight: { xs: 56, md: 64 } }}>
          <IconButton edge="start" color="inherit" onClick={() => navigate(-1)}>
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Typography sx={{ fontWeight: 900, letterSpacing: 0.5 }}>
            Cadastro de Clientes
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 2.5, md: 5 } }}>
        <Stack spacing={2.5}>
          {/* CRUD */}
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, border: "1px solid rgba(255,255,255,0.08)", bgcolor: "background.paper" }}>
            <Typography variant="h6" fontWeight={900} sx={{ mb: 1 }}>
              Cliente
            </Typography>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Nome"
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                fullWidth
              />
              <TextField
                label="E-mail"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                fullWidth
              />
              <TextField
                label="Celular"
                value={form.phone}
                onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))}
                placeholder="(DDD) 9 9999-9999"
                fullWidth
              />
              <Stack direction="row" alignItems="center" sx={{ minWidth: 180 }}>
                <Checkbox
                  checked={!!form.is_admin}
                  onChange={(e) => setForm((s) => ({ ...s, is_admin: e.target.checked }))}
                />
                <Typography sx={{ opacity: 0.9 }}>Administrador</Typography>
              </Stack>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 2 }}>
              <TextField
                label="Código do Cupom"
                value={form.coupon_code}
                onChange={(e) => setForm((s) => ({ ...s, coupon_code: e.target.value }))}
                sx={{ maxWidth: 280 }}
              />
              <TextField
                label="Saldo (R$)"
                value={saldoStr}
                onChange={(e) => setSaldoStr(e.target.value)}
                helperText="Valor em reais (será salvo em centavos)"
                sx={{ maxWidth: 220 }}
              />
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
              <Button startIcon={<AddRoundedIcon />} onClick={handleNew}>Novo</Button>
              <Button
                variant="contained"
                color="success"
                startIcon={saving ? <CircularProgress size={18} /> : <SaveRoundedIcon />}
                onClick={handleSave}
                disabled={saving}
              >
                Salvar
              </Button>
              <Button
                color="error"
                startIcon={<DeleteForeverRoundedIcon />}
                onClick={handleDelete}
                disabled={!form.id || saving}
              >
                Excluir
              </Button>
            </Stack>

            <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.08)" }} />

            {/* Atribuir números */}
            <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>
              Atribuir números ao cliente selecionado
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label="Sorteio (ID)"
                value={drawId}
                onChange={(e) => setDrawId(e.target.value)}
                sx={{ maxWidth: 220 }}
              />
              <TextField
                label="Números (separados por vírgula ou espaço)"
                value={numbersCsv}
                onChange={(e) => setNumbersCsv(e.target.value)}
                fullWidth
              />
              <Button
                variant="contained"
                color="primary"
                startIcon={assigning ? <CircularProgress size={18} /> : <SendRoundedIcon />}
                onClick={handleAssign}
                disabled={assigning}
              >
                Atribuir
              </Button>
            </Stack>
          </Paper>

          {/* Busca */}
          <Paper variant="outlined" sx={{ p: 1.5, border: "1px solid rgba(255,255,255,0.08)", bgcolor: "background.paper" }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <SearchRoundedIcon sx={{ opacity: 0.7 }} />
              <TextField
                placeholder="Buscar por nome, e-mail, celular ou cupom…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                fullWidth
              />
            </Stack>
          </Paper>

          {/* Tabela */}
          <Paper variant="outlined" sx={{ p: 1, border: "1px solid rgba(255,255,255,0.08)", bgcolor: "background.paper" }}>
            <TableContainer>
              <Table size="small" sx={{ minWidth: 920 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>NOME</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>EMAIL</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>CELULAR</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>CUPOM</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>SALDO</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>ADMIN</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>CRIADO EM</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ color: "#bbb" }}>Carregando…</TableCell>
                    </TableRow>
                  )}
                  {!loading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ color: "#bbb" }}>Nenhum usuário encontrado.</TableCell>
                    </TableRow>
                  )}
                  {filtered.map((u) => (
                    <TableRow key={u.id} hover sx={{ cursor: "pointer" }} onClick={() => handleSelect(u)}>
                      <TableCell>{u.id}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.phone}</TableCell>
                      <TableCell>{u.coupon_code || "-"}</TableCell>
                      <TableCell>{toBRL((u.coupon_value_cents || 0) / 100)}</TableCell>
                      <TableCell>{u.is_admin ? "Sim" : "Não"}</TableCell>
                      <TableCell>{u.created_at ? new Date(u.created_at).toLocaleString("pt-BR") : "--"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      </Container>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.sev} variant="filled" sx={{ width: "100%" }}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
