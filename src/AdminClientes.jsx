// src/AdminClientes.jsx
import * as React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar, Box, Container, CssBaseline, IconButton, Menu, MenuItem, Divider,
  Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  ThemeProvider, Toolbar, Typography, createTheme, Button, Stack, Snackbar, Alert,
} from "@mui/material";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import PictureAsPdfRoundedIcon from "@mui/icons-material/PictureAsPdfRounded";
import logoNewStore from "./Logo-branca-sem-fundo-768x132.png";
import { useAuth } from "./authContext";

const theme = createTheme({
  palette: { mode: "dark", background: { default: "#0E0E0E", paper: "#121212" }, success: { main: "#67C23A" } },
  typography: { fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(",") },
});

/* ---------- API base ---------- */
const RAW_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_BASE ||
  "";
const API_BASE = String(RAW_BASE).replace(/\/+$/, "");
const apiJoin = (path) => {
  let p = path.startsWith("/") ? path : `/${path}`;
  const baseEndsApi = API_BASE.endsWith("/api");
  const pathStartsApi = p.startsWith("/api/");
  if (!API_BASE) return pathStartsApi ? p : `/api${p}`;
  if (baseEndsApi && pathStartsApi) p = p.slice(4);
  if (!baseEndsApi && !pathStartsApi) p = `/api${p}`;
  return `${API_BASE}${p}`;
};

/* ---------- utils ---------- */
const fmtBRL = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .format(Number.isFinite(Number(v)) ? Number(v) : 0);

const fmtDate = (v) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString("pt-BR");
};

const safeText = (value, fallback = "-") => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const safeNumber = (value) => Number(value) || 0;

const escapeCSV = (value) => {
  const text = safeText(value, "").replace(/"/g, '""');
  return `"${text}"`;
};

const getFileDate = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const fmtDateTimeBR = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

const downloadBlob = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const startOfDay = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const getStartOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const daysUntilExpiration = (expiresAt, today = getStartOfToday()) => {
  const exp = startOfDay(expiresAt);
  if (!exp) return null;
  return Math.round((exp.getTime() - today.getTime()) / 86400000);
};

const EXPORT_OPTIONS = {
  active: { label: "Saldo ativo", fileBase: "clientes-saldo-ativo" },
  expired: { label: "Saldo vencido", fileBase: "clientes-saldo-vencido" },
};

const getExportOption = (value) => EXPORT_OPTIONS[value] || EXPORT_OPTIONS.active;

const hasPositiveBalance = (row) => Number(row?.total) > 0;

const isActiveBalanceRow = (row, today = getStartOfToday()) => {
  const days = daysUntilExpiration(row?.expires_at, today);
  return hasPositiveBalance(row) && days !== null && days >= 0;
};

const isExpiredBalanceRow = (row, today = getStartOfToday()) => {
  const days = daysUntilExpiration(row?.expires_at, today);
  return hasPositiveBalance(row) && days !== null && days < 0;
};

const getExpirationLabel = (row) => {
  const exp = startOfDay(row?.expires_at);
  if (!exp) return "Não informada";
  return fmtDate(exp);
};

const getBalanceStatus = (row, today = getStartOfToday()) => {
  const days = daysUntilExpiration(row?.expires_at, today);
  if (days === null) {
    return {
      key: "unknown",
      label: "EXPIRAÇÃO NÃO INFORMADA",
      daysLabel: "—",
      color: "#9E9E9E",
    };
  }
  if (days < 0) {
    return { key: "expired", label: "VENCIDO", daysLabel: "VENCIDO", color: "#EF5350" };
  }
  if (days === 0) {
    return { key: "today", label: "VENCE HOJE", daysLabel: "0", color: "#67C23A" };
  }
  if (days <= 7) {
    return { key: "due7", label: `VENCE EM ${days} ${days === 1 ? "DIA" : "DIAS"}`, daysLabel: String(days), color: "#FFA726" };
  }
  if (days <= 30) {
    return { key: "due30", label: `VENCE EM ${days} DIAS`, daysLabel: String(days), color: "#FDD835" };
  }
  return { key: "active", label: "ATIVO", daysLabel: String(days), color: "#67C23A" };
};

const sortText = (a, b) =>
  safeText(a, "").localeCompare(safeText(b, ""), "pt-BR", { sensitivity: "base" });

const sortableDateTime = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
};

const compareNullableSort = (a, b, compare, direction) => {
  const aEmpty = a === null || a === undefined || a === "";
  const bEmpty = b === null || b === undefined || b === "";
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;
  const result = compare(a, b);
  return direction === "asc" ? result : -result;
};

const compareRows = (a, b, sortConfig) => {
  const today = getStartOfToday();
  const key = sortConfig.key;
  let result = 0;

  if (key === "nome") {
    result = sortText(a.nome, b.nome);
  } else if (key === "cadastro") {
    return compareNullableSort(sortableDateTime(a.cadastro_at), sortableDateTime(b.cadastro_at), (x, y) => x - y, sortConfig.direction);
  } else if (key === "compras") {
    result = safeNumber(a.compras) - safeNumber(b.compras);
  } else if (key === "total") {
    result = safeNumber(a.total) - safeNumber(b.total);
  } else if (key === "ultima") {
    return compareNullableSort(sortableDateTime(a.ultima_at), sortableDateTime(b.ultima_at), (x, y) => x - y, sortConfig.direction);
  } else if (key === "vezes") {
    result = safeNumber(a.vezes) - safeNumber(b.vezes);
  } else if (key === "cupom") {
    return compareNullableSort(safeText(a.cupom, ""), safeText(b.cupom, ""), sortText, sortConfig.direction);
  } else if (key === "dias") {
    return compareNullableSort(daysUntilExpiration(a.expires_at, today), daysUntilExpiration(b.expires_at, today), (x, y) => x - y, sortConfig.direction);
  }

  return sortConfig.direction === "asc" ? result : -result;
};

const TABLE_COLUMNS = [
  { key: "nome", label: "NOME DO CLIENTE" },
  { key: "cadastro", label: "DATA DE CADASTRO" },
  { key: "compras", label: "QUANTIDADE DE COMPRAS" },
  { key: "total", label: "VALOR (saldo do cupom)" },
  { key: "ultima", label: "ÚLTIMA COMPRA" },
  { key: "vezes", label: "VEZES CONTEMPLADO" },
  { key: "cupom", label: "CUPOM" },
  { key: "dias", label: "DIAS PARA EXPIRAÇÃO" },
];

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
  const r = await fetch(url, {
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include"
  });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

/* ---------- helpers cupom ---------- */
const extractCoupon = (obj) =>
  String(
    obj?.coupon ??
    obj?.coupon_code ??
    obj?.discount_coupon ??
    obj?.discount_code ??
    obj?.referral_code ??
    obj?.invite_code ??
    obj?.cupom ??
    obj?.cupom_codigo ??
    obj?.codigo_cupom ??
    obj?.code ??
    obj?.coupon?.code ??
    obj?.cupom?.code ??
    ""
  ).trim() || null;

/** Fallback local: usa SOMENTE coupon_value_cents do payload de usuários */
const readCouponValueCentsOnly = (u) => {
  const n = Number(u?.coupon_value_cents);
  return Number.isFinite(n) ? n : 0;
};

/* ---------- fallback de agregação (caso o endpoint agregado falhe) ---------- */
function normalizeArray(payload, keys) {
  if (Array.isArray(payload)) return payload;
  for (const k of keys) if (Array.isArray(payload?.[k])) return payload[k];
  return [];
}
function addMonths(d, months) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const day = dt.getDate();
  dt.setMonth(dt.getMonth() + months);
  if (dt.getDate() < day) dt.setDate(0);
  return dt;
}
function daysDiff(from, to) {
  const a = new Date(from), b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.ceil((b - a) / 86400000);
}
function buildRowsFallback({ usersPayload, paymentsPayload, drawsPayload }) {
  const users = normalizeArray(usersPayload, ["users", "items", "list"]);
  const pays  = normalizeArray(paymentsPayload, ["payments", "items", "list"]);
  const draws = normalizeArray(drawsPayload, ["draws", "history", "items", "list"]);

  // mapa de última compra e contagem
  const acc = new Map();
  for (const p of pays) {
    const status = String(p.status || p.state || "").trim().toLowerCase();
    if (status !== "approved") continue;
    const uid = Number(p.user_id ?? p.uid ?? p.customer_id ?? p.userId);
    if (!Number.isFinite(uid)) continue;
    const when = p.created_at ?? p.paid_at ?? p.approved_at ?? p.createdAt ?? p.data;
    const it = acc.get(uid) || { compras: 0, last: null };
    it.compras += 1;
    if (when && (!it.last || new Date(when) > new Date(it.last))) it.last = when;
    acc.set(uid, it);
  }

  const wins = new Map();
  for (const d of draws) {
    const uid = Number(d.winner_user_id ?? d.winner_userid ?? d.winner_id ?? d.winner?.id);
    if (!Number.isFinite(uid)) continue;
    wins.set(uid, (wins.get(uid) || 0) + 1);
  }

  // Apenas usuários com coupon_value_cents > 0
  const rows = [];
  for (const u of users) {
    const uid = Number(u.id ?? u.user_id ?? u.uid);
    if (!Number.isFinite(uid)) continue;

    const cents = readCouponValueCentsOnly(u);
    if (cents <= 0) continue; // NÃO lista saldo zerado

    const nome = String(u.name ?? u.full_name ?? u.display_name ?? "").trim() || u.email || "—";
    const cadastro = fmtDate(u.created_at ?? u.createdAt ?? u.cadastro ?? null);
    const cadastroAt = u.created_at ?? u.createdAt ?? u.cadastro ?? null;
    const info = acc.get(uid);
    const last = info?.last || null;

    const exp = addMonths(last || new Date(), 6);
    const dias = exp ? Math.max(0, daysDiff(new Date(), exp) ?? 0) : "-";

    rows.push({
      key: `${uid}-cv`,
      user_id: uid,
      nome,
      email: u.email || "",
      cadastro,
      cadastro_at: cadastroAt,
      compras: info?.compras || 0,
      total: +(cents / 100).toFixed(2), // SOMENTE coupon_value_cents
      ultima: fmtDate(last),
      ultima_at: last,
      vezes: wins.get(uid) || 0,
      dias,
      days_to_expire: dias,
      cupom: extractCoupon(u) || null,
      expires_at: exp ? exp.toISOString() : null,
      expires_label: fmtDate(exp),
    });
  }

  return rows.sort((a, b) => (a.dias ?? 999999) - (b.dias ?? 999999) || (b.total - a.total));
}

export default function AdminClientes() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [rows, setRows] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [exportingType, setExportingType] = React.useState(null);
  const [snackbar, setSnackbar] = React.useState({ open: false, severity: "success", message: "" });
  const [sortConfig, setSortConfig] = React.useState({ key: null, direction: "asc" });
  const exportingRef = React.useRef(false);
  const topScrollRef = React.useRef(null);
  const tableScrollRef = React.useRef(null);
  const [scrollContentWidth, setScrollContentWidth] = React.useState(0);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // 1) usa o agregado do back (já filtra por coupon_value_cents > 0)
        try {
          const payload = await getJSON("/admin/clients/active");
          const list = normalizeArray(payload, ["clients", "items", "list"]);
          if (alive && list.length) {
            const mapped = list.map(c => ({
              key: c.user_id,
              user_id: Number(c.user_id ?? c.id) || null,
              nome: (c.name || "").trim() || c.email || "—",
              email: c.email || "",
              cadastro: fmtDate(c.created_at),
              cadastro_at: c.created_at || null,
              compras: Number(c.purchases_count) || 0,
              total: Number(c.coupon_value_brl || c.total_brl || 0), // saldo = coupon_value_cents/100
              ultima: fmtDate(c.last_buy),
              ultima_at: c.last_buy || null,
              vezes: Number(c.wins) || 0,
              dias: c.days_to_expire ?? "-",
              days_to_expire: c.days_to_expire,
              cupom: c.coupon_code || extractCoupon(c) || null,
              expires_at: c.expires_at || null,
              expires_label: fmtDate(c.expires_at),
            }));
            setRows(mapped);
            return;
          }
        } catch (err) {
          const code = String(err?.message || "");
          if (alive && /^(401|403|404)$/.test(code)) {
            setRows([]);
            setLoading(false);
            return;
          }
        }

        // 2) fallback local (SOMENTE coupon_value_cents)
        const [usersPayload, paymentsPayload, drawsPayload] = await Promise.all([
          getJSON("/admin/users").catch(() => getJSON("/users")),
          getJSON("/admin/payments?status=approved")
            .catch(() => getJSON("/payments?status=approved"))
            .catch(() => getJSON("/admin/payments"))
            .catch(() => getJSON("/payments")),
          getJSON("/admin/draws/history")
            .catch(() => getJSON("/admin/draws"))
            .catch(() => getJSON("/draws")),
        ]);

        const lines = buildRowsFallback({ usersPayload, paymentsPayload, drawsPayload });
        if (alive) setRows(lines);
      } catch (e) {
        console.error("[AdminClientes] fetch error:", e);
        if (alive) setRows([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const displayedRows = React.useMemo(() => {
    const baseRows = rows.filter((row) => Number(row.total) > 0);
    return [...baseRows].sort((a, b) => compareRows(a, b, sortConfig));
  }, [rows, sortConfig]);

  const updateScrollMetrics = React.useCallback(() => {
    const tableEl = tableScrollRef.current;
    if (!tableEl) return;

    const nextWidth = tableEl.scrollWidth;
    setScrollContentWidth(nextWidth);
    setHasHorizontalOverflow(nextWidth > tableEl.clientWidth + 1);

    if (topScrollRef.current && topScrollRef.current.scrollLeft !== tableEl.scrollLeft) {
      topScrollRef.current.scrollLeft = tableEl.scrollLeft;
    }
  }, []);

  React.useEffect(() => {
    updateScrollMetrics();

    const tableEl = tableScrollRef.current;
    if (!tableEl) return undefined;

    const rafId = window.requestAnimationFrame(updateScrollMetrics);
    const handleResize = () => updateScrollMetrics();
    window.addEventListener("resize", handleResize);

    let observer = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateScrollMetrics);
      observer.observe(tableEl);
      if (tableEl.firstElementChild) observer.observe(tableEl.firstElementChild);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      if (observer) observer.disconnect();
    };
  }, [displayedRows.length, loading, updateScrollMetrics]);

  const showSnackbar = (severity, message) => {
    setSnackbar({ open: true, severity, message });
  };

  const closeSnackbar = () => {
    setSnackbar((current) => ({ ...current, open: false }));
  };

  const getExportRows = (balanceType) => {
    const today = getStartOfToday();
    const predicate = balanceType === "expired" ? isExpiredBalanceRow : isActiveBalanceRow;
    return displayedRows.filter((row) => predicate(row, today));
  };

  const handleExportCSV = async (balanceType) => {
    if (exportingRef.current) return;
    const option = getExportOption(balanceType);
    const exportRows = getExportRows(balanceType);
    if (!exportRows.length) {
      showSnackbar("warning", `Nenhum cliente encontrado para ${option.label.toLowerCase()}.`);
      return;
    }

    exportingRef.current = true;
    setExportingType(`csv-${balanceType}`);
    try {
      await Promise.resolve();
      const headers = [
        "Nome do cliente",
        "E-mail",
        "Data de cadastro",
        "Quantidade de compras",
        "Saldo",
        "Última compra",
        "Vezes contemplado",
        "Cupom",
        "Data de expiração",
        "Dias para expiração",
        "Situação do saldo",
      ];
      const lines = [
        headers.map(escapeCSV).join(";"),
        ...exportRows.map((row) => {
          const status = getBalanceStatus(row);
          return [
            safeText(row.nome),
            safeText(row.email),
            safeText(row.cadastro),
            safeNumber(row.compras),
            fmtBRL(row.total),
            safeText(row.ultima),
            safeNumber(row.vezes),
            safeText(row.cupom),
            getExpirationLabel(row),
            status.daysLabel,
            status.label,
          ].map(escapeCSV).join(";");
        }),
      ];

      const csv = `\uFEFF${lines.join("\r\n")}`;
      downloadBlob(csv, `${option.fileBase}_${getFileDate()}.csv`, "text/csv;charset=utf-8;");
      showSnackbar("success", "CSV gerado com sucesso.");
    } catch (error) {
      console.error("[AdminClientes][CSV_EXPORT_ERROR]", error);
      showSnackbar("error", "Não foi possível gerar o arquivo. Tente novamente.");
    } finally {
      exportingRef.current = false;
      setExportingType(null);
    }
  };

  const handleExportPDF = async (balanceType) => {
    if (exportingRef.current) return;
    const option = getExportOption(balanceType);
    const exportRows = getExportRows(balanceType);
    if (!exportRows.length) {
      showSnackbar("warning", `Nenhum cliente encontrado para ${option.label.toLowerCase()}.`);
      return;
    }

    exportingRef.current = true;
    setExportingType(`pdf-${balanceType}`);
    try {
      await Promise.resolve();
      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });
      const generatedAt = fmtDateTimeBR(new Date());
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("NEW STORE", 10, 12);
      doc.setFontSize(11);
      doc.text("RELATÓRIO DE CLIENTES", 10, 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Situação exportada: ${option.label}`, 10, 28);
      doc.text(`Gerado em: ${generatedAt}`, 10, 34);

      autoTable(doc, {
        startY: 40,
        theme: "grid",
        head: [[
          "Nome",
          "E-mail",
          "Cadastro",
          "Compras",
          "Saldo",
          "Última compra",
          "Contemplações",
          "Cupom",
          "Expiração",
          "Dias restantes",
          "Situação",
        ]],
        body: exportRows.map((row) => {
          const status = getBalanceStatus(row);
          return [
            safeText(row.nome),
            safeText(row.email),
            safeText(row.cadastro),
            String(safeNumber(row.compras)),
            fmtBRL(row.total),
            safeText(row.ultima),
            String(safeNumber(row.vezes)),
            safeText(row.cupom),
            getExpirationLabel(row),
            status.daysLabel,
            status.label,
          ];
        }),
        margin: { top: 10, right: 8, bottom: 14, left: 8 },
        rowPageBreak: "avoid",
        styles: {
          font: "helvetica",
          fontSize: 7,
          cellPadding: 1.2,
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: {
          fillColor: [18, 18, 18],
          textColor: [255, 255, 255],
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 36 },
          1: { cellWidth: 42 },
          2: { cellWidth: 18 },
          3: { cellWidth: 15 },
          4: { cellWidth: 20 },
          5: { cellWidth: 18 },
          6: { cellWidth: 18 },
          7: { cellWidth: 27 },
          8: { cellWidth: 19 },
          9: { cellWidth: 17 },
          10: { cellWidth: 31 },
        },
      });

      const totalPages = doc.internal.getNumberOfPages();
      for (let page = 1; page <= totalPages; page += 1) {
        doc.setPage(page);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(`Página ${page} de ${totalPages}`, pageWidth - 8, pageHeight - 6, { align: "right" });
      }

      doc.save(`${option.fileBase}_${getFileDate()}.pdf`);
      showSnackbar("success", "PDF gerado com sucesso.");
    } catch (error) {
      console.error("[AdminClientes][PDF_EXPORT_ERROR]", error);
      showSnackbar("error", "Não foi possível gerar o arquivo. Tente novamente.");
    } finally {
      exportingRef.current = false;
      setExportingType(null);
    }
  };

  // menu
  const [menuEl, setMenuEl] = React.useState(null);
  const [csvMenuEl, setCsvMenuEl] = React.useState(null);
  const [pdfMenuEl, setPdfMenuEl] = React.useState(null);
  const open = Boolean(menuEl);
  const csvMenuOpen = Boolean(csvMenuEl);
  const pdfMenuOpen = Boolean(pdfMenuEl);
  const openMenu = (e) => setMenuEl(e.currentTarget);
  const closeMenu = () => setMenuEl(null);
  const openCsvMenu = (e) => setCsvMenuEl(e.currentTarget);
  const openPdfMenu = (e) => setPdfMenuEl(e.currentTarget);
  const closeCsvMenu = () => setCsvMenuEl(null);
  const closePdfMenu = () => setPdfMenuEl(null);
  const chooseCSVExport = (balanceType) => {
    closeCsvMenu();
    handleExportCSV(balanceType);
  };
  const choosePDFExport = (balanceType) => {
    closePdfMenu();
    handleExportPDF(balanceType);
  };
  const goPainel = () => { closeMenu(); navigate("/admin"); };
  const doLogout = () => { closeMenu(); logout(); navigate("/"); };
  const exportDisabled = loading || displayedRows.length === 0 || Boolean(exportingType);
  const handleSort = (key) => {
    setSortConfig((current) => {
      if (current.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };
  const handleTopScroll = () => {
    if (!topScrollRef.current || !tableScrollRef.current) return;

    if (tableScrollRef.current.scrollLeft !== topScrollRef.current.scrollLeft) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };
  const handleTableScroll = () => {
    if (!topScrollRef.current || !tableScrollRef.current) return;

    if (topScrollRef.current.scrollLeft !== tableScrollRef.current.scrollLeft) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
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
        <Typography sx={{
          fontWeight: 900, textTransform: "uppercase",
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: { xs: 24, md: 44 }, mb: 2,
        }}>
          Lista de clientes com saldo ativo
        </Typography>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="flex-end"
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={{ mb: 2 }}
        >
          <Button
            variant="contained"
            color="success"
            size="small"
            startIcon={<DownloadRoundedIcon />}
            onClick={openCsvMenu}
            disabled={exportDisabled}
            sx={{ fontWeight: 800, transition: "opacity 160ms ease, transform 160ms ease", "&:hover": { transform: "translateY(-1px)" } }}
          >
            {exportingType?.startsWith("csv") ? "GERANDO CSV..." : "BAIXAR CSV"}
          </Button>
          <Menu anchorEl={csvMenuEl} open={csvMenuOpen} onClose={closeCsvMenu}>
            <MenuItem onClick={() => chooseCSVExport("active")}>Saldo ativo</MenuItem>
            <MenuItem onClick={() => chooseCSVExport("expired")}>Saldo vencido</MenuItem>
          </Menu>
          <Button
            variant="outlined"
            color="inherit"
            size="small"
            startIcon={<PictureAsPdfRoundedIcon />}
            onClick={openPdfMenu}
            disabled={exportDisabled}
            sx={{ fontWeight: 800, transition: "opacity 160ms ease, transform 160ms ease", "&:hover": { transform: "translateY(-1px)" } }}
          >
            {exportingType?.startsWith("pdf") ? "GERANDO PDF..." : "BAIXAR PDF"}
          </Button>
          <Menu anchorEl={pdfMenuEl} open={pdfMenuOpen} onClose={closePdfMenu}>
            <MenuItem onClick={() => choosePDFExport("active")}>Saldo ativo</MenuItem>
            <MenuItem onClick={() => choosePDFExport("expired")}>Saldo vencido</MenuItem>
          </Menu>
        </Stack>

        <Paper variant="outlined" sx={{ bgcolor: "background.paper" }}>
          {hasHorizontalOverflow && (
            <Box
              ref={topScrollRef}
              onScroll={handleTopScroll}
              sx={{
                overflowX: "auto",
                overflowY: "hidden",
                height: 16,
              }}
            >
              <Box sx={{ width: scrollContentWidth, height: 1 }} />
            </Box>
          )}
          <TableContainer
            ref={tableScrollRef}
            onScroll={handleTableScroll}
            sx={{
              overflowX: "auto",
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { height: 0 },
            }}
          >
            <Table sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  {TABLE_COLUMNS.map((column) => (
                    <TableCell
                      key={column.key}
                      onClick={() => handleSort(column.key)}
                      sx={{
                        fontWeight: 800,
                        cursor: "pointer",
                        userSelect: "none",
                        whiteSpace: "nowrap",
                        transition: "color 160ms ease",
                        "&:hover": { color: "#e0e0e0" },
                      }}
                    >
                      {column.label}
                      {sortConfig.key === column.key && (
                        <Box component="span" sx={{ ml: 0.75, color: "#bbb" }}>
                          {sortConfig.direction === "asc" ? "▲" : "▼"}
                        </Box>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow><TableCell colSpan={8}>Carregando…</TableCell></TableRow>
                )}
                {!loading && displayedRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ color: "#bbb" }}>
                      {rows.length === 0 ? "Nenhum cliente com saldo ativo." : "Nenhum cliente encontrado."}
                    </TableCell>
                  </TableRow>
                )}
                {displayedRows.map((r, index) => {
                  const status = getBalanceStatus(r);
                  return (
                    <TableRow
                      key={r.key}
                      hover
                      sx={{
                        bgcolor: index % 2 === 1 ? "rgba(255,255,255,0.025)" : "transparent",
                      }}
                    >
                      <TableCell>{r.nome}</TableCell>
                      <TableCell>{r.cadastro}</TableCell>
                      <TableCell>{r.compras}</TableCell>
                      <TableCell>{fmtBRL(r.total)}</TableCell>
                      <TableCell>{r.ultima}</TableCell>
                      <TableCell>{r.vezes}</TableCell>
                      <TableCell>{r.cupom || "-"}</TableCell>
                      <TableCell sx={{ color: status.key === "expired" ? "#EF5350" : status.key === "unknown" ? "#9E9E9E" : "success.main", fontWeight: 800 }}>{status.daysLabel}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={closeSnackbar} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </ThemeProvider>
  );
}
