// src/AdminUsersPage.jsx
import * as React from "react";
import {
  AppBar, Toolbar, IconButton, Typography, Container, CssBaseline, Paper, Stack,
  TextField, Button, Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Checkbox, Divider, Snackbar, Alert, CircularProgress, createTheme, ThemeProvider, Box, Chip, MenuItem,
  Tab, Tabs, Dialog, DialogTitle, DialogContent, DialogActions
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

/* ------------------------------ Auxiliares de Draw ------------------------------ */
async function safeJSON(path) {
  try {
    const r = await fetch(apiJoin(path), {
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      cache: "no-store",
    });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch {
    return null;
  }
}

function normalizeList(obj) {
  if (!obj) return [];
  if (Array.isArray(obj)) return obj;
  return obj.draws || obj.items || obj.list || obj.data || [];
}

/** Tenta descobrir o sorteio aberto (vigente) e devolve o id. */
async function findOpenDrawId() {
  const candidates = [
    "/admin/draws?status=open",
    "/draws?status=open",
    "/admin/draws/open",
    "/draws/open",
    "/admin/draws",
    "/draws",
  ];
  for (const p of candidates) {
    const j = await safeJSON(p);
    if (!j) continue;

    // pode vir lista ou objeto único
    const arr = normalizeList(j);
    if (arr.length) {
      const open = arr.find(d => /^(open|aberto)$/i.test(String(d?.status || d?.state || ""))) || arr[0];
      if (open?.id != null) return Number(open.id);
    } else if (j?.id != null) {
      // ex.: /draws/open retorna um único
      return Number(j.id);
    }
  }
  return null;
}

/** Normaliza payload do board para [{ n, label, state }] */
function normalizeBoardPayload(payload) {
  let raw = [];
  if (Array.isArray(payload)) raw = payload;
  else raw = payload?.board || payload?.cells || payload?.items || [];

  if (Array.isArray(raw) && raw.length) {
    return raw.map((c, idx) => {
      const n = Number(c?.n ?? c?.number ?? c?.num ?? c?.index ?? idx);
      const s = String(c?.state ?? c?.status ?? "").toLowerCase();
      let state = "open";
      if (/taken|sold|indispon|ocupad|closed|fechado/.test(s)) state = "taken";
      else if (/reserv|hold|pending/.test(s)) state = "reserved";
      return { n, label: String(n).padStart(2, "0"), state, isWinner: !!c?.isWinner, isMine: !!c?.isMine };
    }).filter(c => Number.isInteger(c.n) && c.n >= 0 && c.n <= 99);
  }

  // Outros formatos: listas de reservados/vendidos
  const reserved = new Set((payload?.reserved_numbers || payload?.reservations || []).map(Number));
  const taken = new Set((payload?.taken_numbers || payload?.sold_numbers || []).map(Number));

  const out = [];
  for (let n = 0; n < 100; n++) {
    let state = "open";
    if (taken.has(n)) state = "taken";
    else if (reserved.has(n)) state = "reserved";
    out.push({ n, label: String(n).padStart(2, "0"), state });
  }
  return out;
}

function normalizeSecondaryBoardPayload(payload) {
  const raw = Array.isArray(payload)
    ? payload
    : payload?.secondary_numbers ||
      payload?.numbers ||
      payload?.items ||
      payload?.draw?.numbers ||
      (Array.isArray(payload?.data) ? payload.data : null) ||
      payload?.data?.numbers ||
      payload?.data?.items ||
      payload?.data?.draw?.numbers ||
      payload?.result?.numbers ||
      [];

  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((c, idx) => {
        const n =
          typeof c === "number" || typeof c === "string"
            ? Number(c)
            : Number(c?.n ?? c?.number ?? c?.num ?? c?.value ?? idx);
        const s = String(c?.status ?? c?.state ?? "").toLowerCase();
        let state = "blocked";
        if (s === "available" || s === "open" || s === "disponivel") state = "open";
        else if (s === "reserved" || s === "reservado") state = "reserved";
        else if (s === "sold" || s === "taken" || s === "indisponivel") state = "taken";
        else if (s === "blocked" || s === "bloqueado") state = "blocked";
        return { n, label: String(n).padStart(2, "0"), state };
      })
      .filter(c => Number.isInteger(c.n) && c.n >= 0 && c.n <= 99);
  }

  return [];
}

function normalizeAdditionalDrawItem(item) {
  const draw = item?.draw && typeof item.draw === "object" ? item.draw : item || {};
  const config = item?.config && typeof item.config === "object" ? item.config : {};
  const stats = item?.stats && typeof item.stats === "object" ? item.stats : {};
  const id = Number(draw.id ?? item?.id ?? config.id);

  if (!Number.isInteger(id) || id <= 0) return null;

  return {
    id,
    draw_id: id,
    draw,
    config,
    stats,
    label:
      draw.banner_title ||
      draw.product_name ||
      draw.promo_phrase ||
      config.banner_title ||
      `Sorteio adicional #${id}`,
    status: draw.status,
    draw_type: draw.draw_type || "adicional",
    ticket_price_cents:
      draw.ticket_price_cents ??
      draw.price_cents ??
      config.ticket_price_cents ??
      null,
    max_numbers_per_selection:
      draw.max_numbers_per_selection ??
      config.max_numbers_per_selection ??
      null,
  };
}

function normalizeAdditionalDrawsPayload(payload) {
  const list = Array.isArray(payload)
    ? payload
    : payload?.draws ?? payload?.data?.draws ?? [];

  if (!Array.isArray(list)) return [];
  return list.map(normalizeAdditionalDrawItem).filter(Boolean);
}

/** Busca a grade (board) para um sorteio. */
async function fetchBoard(drawId) {
  const paths = [
    `/me/draws/${drawId}/board`,
    `/admin/draws/${drawId}/board`,
    `/draws/${drawId}/board`,
    `/draws/${drawId}`, // às vezes devolve { board: [...] }
  ];
  for (const p of paths) {
    const j = await safeJSON(p);
    if (!j) continue;
    const board = normalizeBoardPayload(j);
    if (board.length) return board;
  }
  // fallback: grade "vazia" (tudo livre)
  return Array.from({ length: 100 }, (_, n) => ({ n, label: String(n).padStart(2, "0"), state: "open" }));
}

async function findOpenSecondaryDrawId() {
  const j = await safeJSON("/admin/additional-draws");
  const list = normalizeAdditionalDrawsPayload(j);
  const additional = list
    .filter((item) => {
      const type = String(item.draw_type || "adicional").toLowerCase();
      const status = String(item.status || "").toLowerCase();
      return status === "open" && (type === "adicional" || type === "secundario");
    })
    .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))[0];
  return additional?.id ?? null;
}

async function fetchSecondaryBoard(drawId) {
  const j = await safeJSON(`/admin/additional-draws/${drawId}/numbers`);
  if (!j) return [];
  const board = normalizeSecondaryBoardPayload(j);
  return board;
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
    winner_balance_cents: u.winner_balance_cents == null ? null : Number(u.winner_balance_cents),
    winner_balance_updated_at: u.winner_balance_updated_at || null,
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
    winner_balance_cents: null, winner_balance_updated_at: null,
  };
  const [form, setForm] = React.useState(blank);
  const [saldoStr, setSaldoStr] = React.useState("0,00");
  const [balanceAdjustmentReason, setBalanceAdjustmentReason] = React.useState("");
  const [winnerDialog, setWinnerDialog] = React.useState({ open: false, mode: "assign" });
  const [winnerAmountStr, setWinnerAmountStr] = React.useState("");
  const [winnerReason, setWinnerReason] = React.useState("");
  const [winnerSaving, setWinnerSaving] = React.useState(false);
  const [winnerError, setWinnerError] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [toast, setToast] = React.useState({ open: false, msg: "", sev: "success" });

  // atribuição de números
  const [assignDrawMode, setAssignDrawMode] = React.useState("principal");
  const [drawId, setDrawId] = React.useState("");
  const [numbersCsv, setNumbersCsv] = React.useState("");
  const [secondaryAssignDrawId, setSecondaryAssignDrawId] = React.useState("");
  const [secondaryAssignNumbers, setSecondaryAssignNumbers] = React.useState("");
  const [additionalAssignDraws, setAdditionalAssignDraws] = React.useState([]);
  const [assigning, setAssigning] = React.useState(false);
  const [creditCouponOnAssign, setCreditCouponOnAssign] = React.useState(true);
  const [noCouponCreditReason, setNoCouponCreditReason] = React.useState("");

  // board (referência)
  const [board, setBoard] = React.useState([]);
  const [secondaryAssignBoard, setSecondaryAssignBoard] = React.useState([]);
  const [boardLoading, setBoardLoading] = React.useState(false);
  const [secondaryAssignBoardLoading, setSecondaryAssignBoardLoading] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const list = await fetchAllUsersPaged(["/admin/users"], 500);
      if (alive) {
        setUsers(list);
        setLoading(false);
      }
    })();

    // descobrir sorteio aberto e preencher o campo
    (async () => {
      const id = await findOpenDrawId();
      if (id != null) {
        setDrawId(String(id));
        setBoardLoading(true);
        const b = await fetchBoard(id);
        setBoard(b);
        setBoardLoading(false);
      }
    })();

    return () => { alive = false; };
  }, []);

  // quando o id digitado mudar, recarrega a grade (se número válido)
  React.useEffect(() => {
    const idNum = Number(drawId);
    if (!Number.isInteger(idNum) || idNum <= 0) return;
    let cancel = false;
    (async () => {
      setBoardLoading(true);
      const b = await fetchBoard(idNum);
      if (!cancel) setBoard(b);
      setBoardLoading(false);
    })();
    return () => { cancel = true; };
  }, [drawId]);

  React.useEffect(() => {
    const idNum = Number(secondaryAssignDrawId);
    if (!Number.isInteger(idNum) || idNum <= 0) return;
    let cancel = false;
    (async () => {
      setSecondaryAssignBoardLoading(true);
      const b = await fetchSecondaryBoard(idNum);
      if (!cancel) setSecondaryAssignBoard(b);
      setSecondaryAssignBoardLoading(false);
    })();
    return () => { cancel = true; };
  }, [secondaryAssignDrawId]);

  React.useEffect(() => {
    if (assignDrawMode !== "adicional") return;
    let cancel = false;
    (async () => {
      const payload = await safeJSON("/admin/additional-draws");
      const list = normalizeAdditionalDrawsPayload(payload)
        .filter((item) => {
          const type = String(item.draw_type || "adicional").toLowerCase();
          const status = String(item.status || "").toLowerCase();
          return status === "open" && (type === "adicional" || type === "secundario");
        })
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
      if (cancel) return;
      setAdditionalAssignDraws(list);
      const stillSelected = list.some((item) => String(item.id) === String(secondaryAssignDrawId));
      if (list.length && !stillSelected) setSecondaryAssignDrawId(String(list[0].id));
      if (!list.length) {
        setSecondaryAssignDrawId("");
        setSecondaryAssignBoard([]);
      }
    })();
    return () => { cancel = true; };
  }, [assignDrawMode, secondaryAssignDrawId]);

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
      winner_balance_cents: u.winner_balance_cents == null ? null : Number(u.winner_balance_cents),
      winner_balance_updated_at: u.winner_balance_updated_at || null,
    });
    setSaldoStr(centsToBRLString(u.coupon_value_cents || 0));
    setBalanceAdjustmentReason("");
    setWinnerError("");
  }
  function handleNew() {
    setForm(blank);
    setSaldoStr("0,00");
    setBalanceAdjustmentReason("");
    setWinnerError("");
  }

  function mergeUpdatedUser(updated) {
    const normalized = normalizeUsers([updated])[0];
    if (!normalized) return;
    setUsers((prev) => prev.map((u) => (u.id === normalized.id ? normalized : u)));
    setForm((prev) => (prev.id === normalized.id ? normalized : prev));
    setSaldoStr(centsToBRLString(normalized.coupon_value_cents || 0));
  }

  function openWinnerBalanceDialog(mode) {
    if (!form.id) {
      setToast({ open: true, sev: "warning", msg: "Selecione um cliente na lista." });
      return;
    }
    setWinnerDialog({ open: true, mode });
    setWinnerAmountStr(mode === "hide" ? "" : centsToBRLString(form.winner_balance_cents || 0));
    setWinnerReason("");
    setWinnerError("");
  }

  async function handleWinnerBalanceSave() {
    if (!form.id) {
      setWinnerError("Selecione um cliente na lista.");
      return;
    }

    const reason = String(winnerReason || "").trim();
    if (!reason) {
      setWinnerError("Informe o motivo.");
      return;
    }

    const isHide = winnerDialog.mode === "hide";
    const amountCents = isHide ? null : brlStringToCents(winnerAmountStr);
    if (!isHide && amountCents <= 0) {
      setWinnerError("Informe um valor maior que zero.");
      return;
    }

    if (isHide && !window.confirm("Ocultar saldo vencedor deste cliente?")) return;

    try {
      setWinnerSaving(true);
      setWinnerError("");
      const r = await fetch(apiJoin(`/admin/users/${form.id}/winner-balance`), {
        method: isHide ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify(isHide ? { reason } : { amount_cents: amountCents, reason }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "winner_balance_failed");

      mergeUpdatedUser(j.user || j);
      setWinnerDialog({ open: false, mode: "assign" });
      setWinnerReason("");
      setWinnerAmountStr("");
      setToast({
        open: true,
        sev: "success",
        msg: isHide ? "Saldo vencedor ocultado." : "Saldo vencedor salvo.",
      });
    } catch (e) {
      setWinnerError(e?.message || "Não foi possível salvar o saldo vencedor.");
    } finally {
      setWinnerSaving(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      const creating = !form.id;

      const payload = {
        name: String(form.name || "").trim(),
        email: String(form.email || "").trim(),
        phone: String(form.phone || "").trim(),
        is_admin: !!form.is_admin,
        coupon_code: String(form.coupon_code || "").trim(),
        coupon_value_cents: brlStringToCents(saldoStr),
        balance_adjustment_reason: balanceAdjustmentReason || null,
        ...(creating ? { set_default_password: true } : {}),
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
      setToast({
        open: true,
        sev: "success",
        msg: creating ? "Salvo com sucesso. Senha padrão: newstore" : "Salvo com sucesso."
      });
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
    const isSecondaryAssign = assignDrawMode === "adicional";
    const activeDrawId = isSecondaryAssign ? secondaryAssignDrawId : drawId;
    const activeNumbersCsv = isSecondaryAssign ? secondaryAssignNumbers : numbersCsv;
    const d = Number(activeDrawId);
    const nums = String(activeNumbersCsv || "")
      .split(/[,\s;]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n));

    if (!Number.isInteger(d) || d <= 0 || nums.length === 0) {
      setToast({ open: true, sev: "warning", msg: "Informe um sorteio e pelo menos um número." });
      return;
    }
    if (!isSecondaryAssign && !creditCouponOnAssign && !String(noCouponCreditReason || "").trim()) {
      setToast({ open: true, sev: "warning", msg: "Informe o motivo da cortesia/sem crédito." });
      return;
    }

    try {
      setAssigning(true);
      const assignUrl = isSecondaryAssign
        ? `/admin/additional-draws/${d}/assign-numbers`
        : `/admin/users/${form.id}/assign-numbers`;
      const assignPayload = isSecondaryAssign
        ? {
            user_id: form.id,
            numbers: nums,
            generate_balance: creditCouponOnAssign,
          }
        : {
            user_id: form.id,
            draw_id: d,
            numbers: nums,
            credit_coupon: creditCouponOnAssign,
            no_coupon_credit_reason: creditCouponOnAssign ? null : String(noCouponCreditReason || "").trim(),
          };

      const r = await fetch(apiJoin(assignUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify(assignPayload),
      });
      if (!r.ok) throw new Error("assign_failed");
      setToast({ open: true, sev: "success", msg: "Números atribuídos com sucesso." });
      if (isSecondaryAssign) setSecondaryAssignNumbers("");
      else setNumbersCsv("");
      setNoCouponCreditReason("");
      setCreditCouponOnAssign(true);

      // atualiza a referência do board
      if (isSecondaryAssign) {
        setSecondaryAssignBoardLoading(true);
        const b = await fetchSecondaryBoard(d);
        setSecondaryAssignBoard(b);
        setSecondaryAssignBoardLoading(false);
      } else {
        setBoardLoading(true);
        const b = await fetchBoard(d);
        setBoard(b);
        setBoardLoading(false);
      }
    } catch {
      setToast({ open: true, sev: "error", msg: "Falha ao atribuir números." });
    } finally {
      setAssigning(false);
    }
  }

  /* ---- estilo das células (simples e responsivo) ---- */
  const getCellSx = (state) => {
    if (state === "taken") {
      return {
        color: "#FFB3B3",
        border: "1px solid #FF8A8A",
        background:
          "linear-gradient(180deg, #472427 0%, #2B1517 100%)",
      };
    }
    if (state === "reserved") {
      return {
        color: "#FFE7A1",
        border: "1px solid #FFD666",
        background:
          "linear-gradient(180deg, #3A2E12 0%, #2A230D 100%)",
      };
    }
    if (state === "blocked") {
      return {
        color: "rgba(255,255,255,.45)",
        border: "1px solid rgba(255,255,255,.18)",
        background:
          "linear-gradient(180deg, #2A2A2A 0%, #1A1A1A 100%)",
      };
    }
    return {
      color: "#0E0E0E",
      border: "1px solid rgba(255,255,255,.2)",
      background:
        "linear-gradient(180deg, #67C23A 0%, #58A834 100%)",
    };
  };

  const isSecondaryAssignMode = assignDrawMode === "adicional";
  const activeAssignDrawId = isSecondaryAssignMode ? secondaryAssignDrawId : drawId;
  const activeAssignNumbers = isSecondaryAssignMode ? secondaryAssignNumbers : numbersCsv;
  const activeAssignBoard = isSecondaryAssignMode ? secondaryAssignBoard : board;
  const activeBoardLoading = isSecondaryAssignMode ? secondaryAssignBoardLoading : boardLoading;
  const setActiveAssignDrawId = isSecondaryAssignMode ? setSecondaryAssignDrawId : setDrawId;
  const setActiveAssignNumbers = isSecondaryAssignMode ? setSecondaryAssignNumbers : setNumbersCsv;

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
            <Typography variant="body2" sx={{ mt: 1, opacity: 0.75 }}>
              Alterações manuais no saldo serão registradas no histórico financeiro do cliente.
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mt: 1.5 }}>
              <TextField
                label="Motivo do ajuste"
                value={balanceAdjustmentReason}
                onChange={(e) => setBalanceAdjustmentReason(e.target.value)}
                placeholder="Opcional"
                fullWidth
              />
            </Stack>

            <Paper
              variant="outlined"
              sx={{
                mt: 2,
                p: { xs: 1.5, md: 2 },
                borderColor: "rgba(212,175,55,0.38)",
                bgcolor: "rgba(212,175,55,0.04)",
              }}
            >
              <Stack spacing={1.25}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={900}>
                    Saldo vencedor
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.76 }}>
                    Prêmio em créditos atribuído ao cliente. Este valor é separado do cashback.
                  </Typography>
                </Box>
                <Typography sx={{ fontWeight: 800 }}>
                  {form.winner_balance_cents == null
                    ? "Não atribuído — oculto para o cliente"
                    : `Saldo vencedor atual: ${toBRL(Number(form.winner_balance_cents) / 100)}`}
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button
                    variant="outlined"
                    color="secondary"
                    disabled={!form.id}
                    onClick={() => openWinnerBalanceDialog(form.winner_balance_cents == null ? "assign" : "update")}
                  >
                    {form.winner_balance_cents == null ? "Atribuir saldo vencedor" : "Atualizar saldo vencedor"}
                  </Button>
                  {form.winner_balance_cents != null && (
                    <Button
                      variant="text"
                      color="error"
                      disabled={!form.id}
                      onClick={() => openWinnerBalanceDialog("hide")}
                    >
                      Ocultar saldo vencedor
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Paper>

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
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
              <Stack spacing={0.75} sx={{ minWidth: 220 }}>
                <Typography variant="caption" sx={{ opacity: 0.75, fontWeight: 800 }}>
                  Tipo de sorteio
                </Typography>
                                <Tabs
                  value={assignDrawMode}
                  onChange={(_, value) => setAssignDrawMode(value)}
                  textColor="primary"
                  indicatorColor="primary"
                  sx={{ minHeight: 36 }}
                >
                  <Tab value="principal" label="Principal" sx={{ minHeight: 36, fontWeight: 900 }} />
                  <Tab value="adicional" label="Adicional" sx={{ minHeight: 36, fontWeight: 900 }} />
                </Tabs>
              </Stack>
              {isSecondaryAssignMode && (
                <TextField
                  select
                  label="Sorteio adicional"
                  value={secondaryAssignDrawId}
                  onChange={(e) => setSecondaryAssignDrawId(e.target.value)}
                  sx={{ minWidth: 240 }}
                >
                  {additionalAssignDraws.map((additional) => (
                    <MenuItem key={additional.id} value={String(additional.id)}>
                      {additional.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
                            {isSecondaryAssignMode && additionalAssignDraws.length === 0 && (
                <Alert severity="info" sx={{ minWidth: 240 }}>
                  Nenhum sorteio adicional aberto.
                </Alert>
              )}
              <TextField
                label={isSecondaryAssignMode ? "Sorteio ID" : "Sorteio (ID)"}
                value={activeAssignDrawId}
                onChange={(e) => setActiveAssignDrawId(e.target.value)}
                sx={{ maxWidth: 220 }}
              />
              <TextField
                label="Números (separados por vírgula ou espaço)"
                value={activeAssignNumbers}
                onChange={(e) => setActiveAssignNumbers(e.target.value)}
                fullWidth
              />
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  onClick={async () => {
                    if (isSecondaryAssignMode) {
                      const id = await findOpenSecondaryDrawId();
                      if (id != null) setSecondaryAssignDrawId(String(id));
                      else setToast({ open: true, sev: "info", msg: "Nenhum sorteio adicional aberto." });
                      return;
                    }
                    const id = await findOpenDrawId();
                    if (id != null) setDrawId(String(id));
                  }}
                >
                  Carregar sorteio aberto
                </Button>
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
            </Stack>
            <Stack sx={{ mt: 1.5 }} spacing={1}>
              <Stack direction="row" alignItems="center">
                <Checkbox
                  checked={creditCouponOnAssign}
                  onChange={(e) => setCreditCouponOnAssign(e.target.checked)}
                />
                <Typography sx={{ opacity: 0.95 }}>Gerar saldo/cupom para os números atribuídos</Typography>
              </Stack>
              {creditCouponOnAssign ? (
                <Typography variant="body2" sx={{ opacity: 0.75 }}>
                  Os números serão atribuídos e o saldo/cupom será creditado conforme o valor atual do sorteio.
                </Typography>
              ) : (
                <TextField
                  label="Motivo da cortesia/sem crédito"
                  value={noCouponCreditReason}
                  onChange={(e) => setNoCouponCreditReason(e.target.value)}
                  required
                  fullWidth
                />
              )}
            </Stack>

            {/* Referência do board (desktop e mobile) */}
            <Box sx={{ mt: 2.5 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Situação do sorteio</Typography>
                <Chip size="small" label="Disponível" sx={{ bgcolor: "#67C23A", color: "#0E0E0E", fontWeight: 800 }} />
                <Chip size="small" label="Reservado"  sx={{ bgcolor: "#FFD54F", color: "#000", fontWeight: 800 }} />
                <Chip size="small" label="Indisponível" sx={{ bgcolor: "#E57373", color: "#000", fontWeight: 800 }} />
                {isSecondaryAssignMode && (
                  <Chip size="small" label="Bloqueado" sx={{ bgcolor: "#2A2A2A", color: "rgba(255,255,255,.72)", fontWeight: 800 }} />
                )}
                <Box sx={{ flex: 1 }} />
                <Button size="small" onClick={async () => {
                  const idNum = Number(activeAssignDrawId);
                  if (!Number.isInteger(idNum) || idNum <= 0) return;
                  if (isSecondaryAssignMode) {
                    setSecondaryAssignBoardLoading(true);
                    const b = await fetchSecondaryBoard(idNum);
                    setSecondaryAssignBoard(b);
                    setSecondaryAssignBoardLoading(false);
                    return;
                  }
                  setBoardLoading(true);
                  const b = await fetchBoard(idNum);
                  setBoard(b);
                  setBoardLoading(false);
                }}>
                  Atualizar grade
                </Button>
              </Stack>

              <Paper variant="outlined" sx={{ p: { xs: 1, md: 1.5 } }}>
                {activeBoardLoading ? (
                  <Stack alignItems="center" py={3} gap={1}>
                    <CircularProgress />
                    <Typography sx={{ opacity: .8 }}>Carregando grade…</Typography>
                  </Stack>
                ) : isSecondaryAssignMode && !activeAssignBoard.length ? (
                  <Typography sx={{ opacity: .8, py: 3, textAlign: "center" }}>
                    Nenhum número encontrado para o sorteio adicional.
                  </Typography>
                ) : (
                  <Box
                    role="grid"
                    aria-label="Números do sorteio (referência)"
                    sx={{
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "repeat(5, minmax(40px, 1fr))",
                        sm: "repeat(8, minmax(44px, 1fr))",
                        md: "repeat(10, minmax(46px, 1fr))",
                      },
                      gap: { xs: .6, sm: .7, md: .8 },
                    }}
                  >
                    {activeAssignBoard.map((c) => (
                      <Box
                        key={c.n}
                        sx={{
                          userSelect: "none",
                          textAlign: "center",
                          py: .7,
                          borderRadius: 999,
                          fontWeight: 900,
                          letterSpacing: .4,
                          fontSize: { xs: 12, sm: 13 },
                          ...getCellSx(c.state),
                        }}
                        title={
                          c.state === "taken" ? "Indisponível" :
                          c.state === "reserved" ? "Reservado" :
                          c.state === "blocked" ? "Bloqueado" : "Disponível"
                        }
                      >
                        {c.label}
                      </Box>
                    ))}
                  </Box>
                )}
              </Paper>
            </Box>
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
              <Table size="small" sx={{ minWidth: 1040 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>NOME</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>EMAIL</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>CELULAR</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>CUPOM</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>SALDO</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>SALDO VENCEDOR</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>ADMIN</TableCell>
                    <TableCell sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>CRIADO EM</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={9} sx={{ color: "#bbb" }}>Carregando…</TableCell>
                    </TableRow>
                  )}
                  {!loading && filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} sx={{ color: "#bbb" }}>Nenhum usuário encontrado.</TableCell>
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
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {u.winner_balance_cents == null ? "—" : toBRL(Number(u.winner_balance_cents) / 100)}
                      </TableCell>
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

      <Dialog
        open={winnerDialog.open}
        onClose={() => {
          if (!winnerSaving) setWinnerDialog((s) => ({ ...s, open: false }));
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 900 }}>
          {winnerDialog.mode === "hide" ? "Ocultar saldo vencedor" : "Saldo vencedor"}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {winnerDialog.mode !== "hide" && (
              <TextField
                label="Valor do saldo vencedor"
                value={winnerAmountStr}
                onChange={(e) => setWinnerAmountStr(e.target.value)}
                helperText="Informe o valor final em reais. Não é incremento."
                fullWidth
                autoFocus
              />
            )}
            <TextField
              label={winnerDialog.mode === "hide" ? "Motivo para ocultar" : "Motivo da atribuição"}
              value={winnerReason}
              onChange={(e) => setWinnerReason(e.target.value)}
              inputProps={{ maxLength: 500 }}
              multiline
              minRows={2}
              fullWidth
            />
            {winnerError && (
              <Alert severity="error" variant="outlined">
                {winnerError}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={winnerSaving} onClick={() => setWinnerDialog((s) => ({ ...s, open: false }))}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color={winnerDialog.mode === "hide" ? "error" : "secondary"}
            disabled={winnerSaving}
            onClick={handleWinnerBalanceSave}
          >
            {winnerSaving ? "Salvando..." : winnerDialog.mode === "hide" ? "Ocultar saldo vencedor" : "Salvar saldo vencedor"}
          </Button>
        </DialogActions>
      </Dialog>

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
