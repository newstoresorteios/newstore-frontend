// src/AdminAnalytics.jsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert, AppBar, Box, Button, Chip, CircularProgress, Container, CssBaseline, IconButton,
  LinearProgress, Paper, Stack,
  Tab, Tabs, ThemeProvider, Toolbar, Typography, createTheme, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TableSortLabel
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend
} from "recharts";
import { getJSON } from "./lib/api";

/* ============================== TEMA ============================== */
const theme = createTheme({
  palette: { mode: "dark", primary: { main: "#2E7D32" }, background: { default: "#0E0E0E", paper: "#121212" } },
  shape: { borderRadius: 16 },
  typography: { fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(",") }
});

const BRL = (c) => (Number(c || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (n) => `${(Number(n || 0) * 100).toFixed(0)}%`;
const dateKey = (value, length = 10) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toISOString().slice(0, length);
};
const BLOCK_ERROR = "Não foi possível carregar estes dados agora.";
const CHART_COLORS = {
  primary: "#67C23A",
  secondary: "#42A5F5",
  warning: "#FFB74D",
  error: "#EF5350",
  muted: "#90A4AE",
};

const sortRows = (rows, sortConfig, getValue) => {
  if (!sortConfig?.key) return rows;
  return [...rows].sort((left, right) => {
    const leftValue = getValue(left, sortConfig.key);
    const rightValue = getValue(right, sortConfig.key);
    if (leftValue == null && rightValue == null) return 0;
    if (leftValue == null) return 1;
    if (rightValue == null) return -1;
    const comparison = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), "pt-BR", { numeric: true, sensitivity: "base" });
    return sortConfig.direction === "desc" ? -comparison : comparison;
  });
};

const couponOwnerName = (coupon) => coupon?.name || coupon?.email || "Sem dono identificado";
const couponCode = (coupon) => coupon?.coupon_code || coupon?.tray_coupon_id || "(sem)";
const couponAverageTicket = (coupon) => coupon?.average_ticket_cents ?? coupon?.avg_ticket_cents ?? null;
const couponAverageValue = (coupon) => coupon?.coupon_value_cents ?? coupon?.avg_coupon_cents ?? null;
const buyerAverageTicket = (buyer) => buyer?.average_ticket_cents ?? buyer?.avg_ticket_cents ?? null;

const normalizeWinningNumbers = (payload) => {
  const rows = Array.isArray(payload)
    ? payload
    : payload?.winning_numbers ||
      payload?.numbers ||
      payload?.items ||
      payload?.rows ||
      payload?.data?.winning_numbers ||
      payload?.data?.numbers ||
      payload?.data?.items ||
      payload?.data ||
      [];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => ({
      key: row?.number ?? row?.n ?? row?.winner_number ?? index,
      number: row?.number ?? row?.n ?? row?.winner_number ?? null,
      wins: row?.win_count ?? row?.wins_count ?? row?.winning_count ?? row?.wins ?? row?.victories ?? row?.times_won ?? row?.count ?? null,
      lastDraw: row?.last_draw_id ?? row?.last_winning_draw_id ?? row?.last_draw?.id ?? row?.last_draw ?? row?.draw_id ?? null,
      lastWinAt: row?.last_win_at ?? row?.last_won_at ?? row?.last_victory_at ?? row?.last_winning_at ?? row?.last_win_date ?? row?.won_at ?? null,
    }))
    .filter((row) => row.number != null);
};

/* ============================ COMPONENTES ============================ */
function KpiCard({ label, value, hint, loading = false, error = false, accent = CHART_COLORS.primary }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.25,
        borderRadius: 4,
        minWidth: 0,
        minHeight: 132,
        borderTop: `3px solid ${accent}`,
        bgcolor: "rgba(255,255,255,0.025)",
      }}
    >
      <Typography sx={{ opacity: .72, fontWeight: 800, mb: 1, fontSize: 13 }}>{label}</Typography>
      {loading ? (
        <CircularProgress size={26} thickness={5} />
      ) : (
        <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.15 }}>
          {error ? "—" : value}
        </Typography>
      )}
      {hint && <Typography variant="caption" sx={{ opacity: .65 }}>{hint}</Typography>}
    </Paper>
  );
}

function Section({ title, subtitle, right, children, sx }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, minWidth: 0, ...sx }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
        spacing={1}
        sx={{ mb: 1 }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>{title}</Typography>
          {subtitle && <Typography variant="caption" sx={{ opacity: .62 }}>{subtitle}</Typography>}
        </Box>
        {right}
      </Stack>
      {children}
    </Paper>
  );
}

function BlockNotice({ loading, error }) {
  if (loading) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 2 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" sx={{ opacity: .72 }}>Carregando dados…</Typography>
      </Stack>
    );
  }
  if (error) return <Alert severity="warning" sx={{ my: 1 }}>{BLOCK_ERROR}</Alert>;
  return null;
}

function SortableHeader({ label, column, sortConfig, onSort, align = "left" }) {
  const active = sortConfig?.key === column;
  return (
    <TableCell
      align={align}
      sortDirection={active ? sortConfig.direction : false}
      sx={{ color: "#64B5F6", fontWeight: 900, whiteSpace: "nowrap" }}
    >
      <TableSortLabel
        active={active}
        direction={active ? sortConfig.direction : "asc"}
        onClick={() => onSort(column)}
        sx={{
          color: "inherit !important",
          "& .MuiTableSortLabel-icon": { color: "#64B5F6 !important" },
        }}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );
}

/* =============================== PÁGINA =============================== */

export default function AdminAnalytics() {
  const nav = useNavigate();
  const [tab, setTab] = React.useState(0);

  // Estado (GERAL / OVERVIEW)
  const [overview, setOverview] = React.useState(null);
  const [kpiSummary, setKpiSummary] = React.useState(null);
  const [topBuyers, setTopBuyers] = React.useState([]);
  const [hourly, setHourly] = React.useState([]);

  // Estado (LISTAS DE SORTEIO + RESUMO POR SORTEIO)
  const [draws, setDraws] = React.useState([]);
  const [drawsSummary, setDrawsSummary] = React.useState([]);
  const [drawId, setDrawId] = React.useState("");
  const [summary, setSummary] = React.useState(null);
  const [leaks, setLeaks] = React.useState({ expired_reservations: [], expired_payments: [] });
  const [latency, setLatency] = React.useState({ avg_minutes_to_pay: null, weekly: [] });

  // Extras
  const [couponsEff, setCouponsEff] = React.useState([]);
  const [autopayStats, setAutopayStats] = React.useState({ daily: [], avg_missed: null });

  // Placeholders agora ativos
  const [rfm, setRfm] = React.useState([]);
  const [cohorts, setCohorts] = React.useState([]);
  const [latencyGlobal, setLatencyGlobal] = React.useState({ avg_minutes_to_pay: null, weekly: [] });
  const [favorites, setFavorites] = React.useState([]);
  const [winningNumbers, setWinningNumbers] = React.useState([]);

  const [overviewState, setOverviewState] = React.useState({ loading: true, error: "" });
  const [kpiDashboardState, setKpiDashboardState] = React.useState({ loading: true, error: "" });
  const [drawListsState, setDrawListsState] = React.useState({ loading: true, errors: {} });
  const [perDrawState, setPerDrawState] = React.useState({ loading: false, errors: {} });
  const [extrasState, setExtrasState] = React.useState({ loading: true, errors: {} });
  const [rfmState, setRfmState] = React.useState({ loading: false, error: "" });
  const [cohortsState, setCohortsState] = React.useState({ loading: false, error: "" });
  const [latencyGlobalState, setLatencyGlobalState] = React.useState({ loading: false, error: "" });
  const [favoritesState, setFavoritesState] = React.useState({ loading: true, error: "" });
  const [winningNumbersState, setWinningNumbersState] = React.useState({ loading: false, error: "" });

  const [topBuyersSort, setTopBuyersSort] = React.useState({ key: null, direction: "asc" });
  const [drawRankingSort, setDrawRankingSort] = React.useState({ key: null, direction: "asc" });
  const [drawsTableSort, setDrawsTableSort] = React.useState({ key: null, direction: "asc" });
  const [rfmSort, setRfmSort] = React.useState({ key: null, direction: "asc" });
  const [cohortsSort, setCohortsSort] = React.useState({ key: null, direction: "asc" });
  const [couponSort, setCouponSort] = React.useState({ key: null, direction: "asc" });
  const [favoritesSort, setFavoritesSort] = React.useState({ key: null, direction: "asc" });
  const [winningNumbersSort, setWinningNumbersSort] = React.useState({ key: null, direction: "asc" });

  /* ---------------------------- LOADERS ---------------------------- */

  const loadOverview = React.useCallback(async () => {
    setOverviewState({ loading: true, error: "" });
    try {
      const ov = await getJSON("/admin/analytics/overview?days=30");
      setOverview(ov || null);
      setTopBuyers(ov?.topBuyers || []);
      setHourly(ov?.hourly || []);
      setOverviewState({ loading: false, error: "" });
    } catch {
      setOverview(null);
      setTopBuyers([]);
      setHourly([]);
      setOverviewState({ loading: false, error: BLOCK_ERROR });
    }
  }, []);

  const loadKpiDashboard = React.useCallback(async () => {
    setKpiDashboardState({ loading: true, error: "" });
    try {
      const response = await getJSON("/admin/analytics/kpi-dashboard");
      setKpiSummary(response?.summary && typeof response.summary === "object" ? response.summary : null);
      setKpiDashboardState({ loading: false, error: "" });
    } catch {
      setKpiSummary(null);
      setKpiDashboardState({
        loading: false,
        error: "Não foi possível carregar o resumo geral agora.",
      });
    }
  }, []);

  const loadDrawLists = React.useCallback(async () => {
    setDrawListsState({ loading: true, errors: {} });
    const [drawsResult, summaryResult] = await Promise.allSettled([
      getJSON("/admin/analytics/draws"),
      getJSON("/admin/analytics/draws-summary")
    ]);
    const errors = {};
    if (drawsResult.status === "fulfilled") {
      const list = Array.isArray(drawsResult.value) ? drawsResult.value : [];
      setDraws(list);
      setDrawId((current) => current || (list[0]?.id != null ? String(list[0].id) : ""));
    } else {
      setDraws([]);
      errors.draws = BLOCK_ERROR;
    }
    if (summaryResult.status === "fulfilled") {
      setDrawsSummary(Array.isArray(summaryResult.value) ? summaryResult.value : []);
    } else {
      setDrawsSummary([]);
      errors.summary = BLOCK_ERROR;
    }
    setDrawListsState({ loading: false, errors });
  }, []);

  const loadPerDraw = React.useCallback(async (id) => {
    if (!id) {
      setSummary(null);
      setPerDrawState({ loading: false, errors: {} });
      return;
    }
    setSummary(null);
    setLeaks({ expired_reservations: [], expired_payments: [] });
    setLatency({ avg_minutes_to_pay: null, weekly: [] });
    setPerDrawState({ loading: true, errors: {} });
    const [summaryResult, leaksResult, latencyResult] = await Promise.allSettled([
      getJSON(`/admin/analytics/summary/${id}`),
      getJSON(`/admin/analytics/leaks/daily?days=30&drawId=${id}`),
      getJSON(`/admin/analytics/payments/latency?days=120&drawId=${id}`)
    ]);
    const errors = {};
    if (summaryResult.status === "fulfilled") setSummary(summaryResult.value || null);
    else errors.summary = BLOCK_ERROR;
    if (leaksResult.status === "fulfilled") {
      setLeaks(leaksResult.value || { expired_reservations: [], expired_payments: [] });
    } else errors.leaks = BLOCK_ERROR;
    if (latencyResult.status === "fulfilled") {
      setLatency(latencyResult.value || { avg_minutes_to_pay: null, weekly: [] });
    } else errors.latency = BLOCK_ERROR;
    setPerDrawState({ loading: false, errors });
  }, []);

  const loadExtras = React.useCallback(async () => {
    setExtrasState({ loading: true, errors: {} });
    const [couponsResult, autopayResult] = await Promise.allSettled([
      getJSON("/admin/analytics/coupons/efficacy"),
      getJSON("/admin/analytics/autopay/stats")
    ]);
    const errors = {};
    if (couponsResult.status === "fulfilled") setCouponsEff(couponsResult.value || []);
    else {
      setCouponsEff([]);
      errors.coupons = BLOCK_ERROR;
    }
    if (autopayResult.status === "fulfilled") {
      setAutopayStats(autopayResult.value || { daily: [], avg_missed: null });
    } else {
      setAutopayStats({ daily: [], avg_missed: null });
      errors.autopay = BLOCK_ERROR;
    }
    setExtrasState({ loading: false, errors });
  }, []);

  const loadRfm = React.useCallback(async () => {
    setRfmState({ loading: true, error: "" });
    try {
      const rows = await getJSON("/admin/analytics/rfm");
      setRfm(rows || []);
      setRfmState({ loading: false, error: "" });
    } catch {
      setRfm([]);
      setRfmState({ loading: false, error: BLOCK_ERROR });
    }
  }, []);

  const loadCohorts = React.useCallback(async () => {
    setCohortsState({ loading: true, error: "" });
    try {
      const rows = await getJSON("/admin/analytics/cohorts");
      setCohorts(rows || []);
      setCohortsState({ loading: false, error: "" });
    } catch {
      setCohorts([]);
      setCohortsState({ loading: false, error: BLOCK_ERROR });
    }
  }, []);

  const loadLatencyGlobal = React.useCallback(async () => {
    setLatencyGlobalState({ loading: true, error: "" });
    try {
      const response = await getJSON("/admin/analytics/payments/latency?days=120");
      setLatencyGlobal(response || { avg_minutes_to_pay: null, weekly: [] });
      setLatencyGlobalState({ loading: false, error: "" });
    } catch {
      setLatencyGlobal({ avg_minutes_to_pay: null, weekly: [] });
      setLatencyGlobalState({ loading: false, error: BLOCK_ERROR });
    }
  }, []);

  const loadFavorites = React.useCallback(async () => {
    setFavoritesState({ loading: true, error: "" });
    try {
      const rows = await getJSON("/admin/analytics/numbers/favorites-by-user");
      setFavorites(rows || []);
      setFavoritesState({ loading: false, error: "" });
    } catch {
      setFavorites([]);
      setFavoritesState({ loading: false, error: BLOCK_ERROR });
    }
  }, []);

  const loadWinningNumbers = React.useCallback(async () => {
    setWinningNumbersState({ loading: true, error: "" });
    try {
      const response = await getJSON("/admin/analytics/numbers/winning-frequency");
      setWinningNumbers(normalizeWinningNumbers(response));
      setWinningNumbersState({ loading: false, error: "" });
    } catch {
      setWinningNumbers([]);
      setWinningNumbersState({
        loading: false,
        error: "Não foi possível carregar os números vencedores agora.",
      });
    }
  }, []);

  // Efeitos iniciais
  React.useEffect(() => { loadOverview(); }, [loadOverview]);
  React.useEffect(() => { loadKpiDashboard(); }, [loadKpiDashboard]);
  React.useEffect(() => { loadDrawLists(); }, [loadDrawLists]);
  React.useEffect(() => { loadPerDraw(drawId); }, [drawId, loadPerDraw]);
  React.useEffect(() => { loadExtras(); }, [loadExtras]);
  React.useEffect(() => { loadFavorites(); }, [loadFavorites]);

  // Carregamento sob demanda ao trocar de aba
  React.useEffect(() => {
    if (tab === 2) loadRfm();
    if (tab === 3) loadCohorts();
    if (tab === 6) loadLatencyGlobal();
    if (tab === 7) loadWinningNumbers();
  }, [tab, loadRfm, loadCohorts, loadLatencyGlobal, loadWinningNumbers]);

  /* --------------------------- DERIVADOS --------------------------- */

  // Overview
  const totals = overview?.totals || {};
  const hasMetric = (value) => value !== null && value !== undefined && value !== "";
  const gmv30dCents = hasMetric(kpiSummary?.gmv_30d_cents)
    ? kpiSummary.gmv_30d_cents
    : (hasMetric(totals.gmv_30d_cents) ? totals.gmv_30d_cents : null);
  const gmvAllTimeCents = hasMetric(kpiSummary?.gmv_all_time_cents)
    ? kpiSummary.gmv_all_time_cents
    : null;
  const gmvCurrentMonthCents = hasMetric(kpiSummary?.gmv_current_month_cents)
    ? kpiSummary.gmv_current_month_cents
    : null;
  const gmvCurrentYearCents = hasMetric(kpiSummary?.gmv_current_year_cents)
    ? kpiSummary.gmv_current_year_cents
    : null;
  const paidOrdersAllTime = hasMetric(kpiSummary?.paid_orders_all_time)
    ? Number(kpiSummary.paid_orders_all_time)
    : null;
  const paidOrders30d = hasMetric(kpiSummary?.paid_orders_30d)
    ? Number(kpiSummary.paid_orders_30d)
    : null;
  const averageTicketAllTimeCents = hasMetric(kpiSummary?.average_ticket_all_time_cents)
    ? kpiSummary.average_ticket_all_time_cents
    : (hasMetric(kpiSummary?.average_ticket_cents) ? kpiSummary.average_ticket_cents : null);
  const uniqueBuyersAllTime = hasMetric(kpiSummary?.unique_buyers_all_time)
    ? Number(kpiSummary.unique_buyers_all_time)
    : null;
  const averageOrdersPerBuyer = hasMetric(kpiSummary?.average_orders_per_buyer)
    ? Number(kpiSummary.average_orders_per_buyer)
    : (paidOrdersAllTime != null && uniqueBuyersAllTime > 0 ? paidOrdersAllTime / uniqueBuyersAllTime : null);
  const series = overview?.series || [];
  const dailyGMV = series.map(x => ({
    day: dateKey(x.day),
    paid: Number(x.gmv_paid_cents || 0) / 100,
    intent: Number(x.gmv_intent_cents || 0) / 100,
    expired: Number(x.gmv_expired_cents || 0) / 100
  }));
  const dailyOrders = series.map(x => ({
    day: dateKey(x.day),
    paid: Number(x.orders_paid || 0),
    intent: Number(x.orders_intent || 0),
    expired: Number(x.orders_expired || 0)
  }));
  const hourlyPaid = (hourly || []).map(h => ({ h: Number(h.hour_br), paid: Number(h.paid) }));

  // Por sorteio
  const funnel = summary?.funnel || null;
  const paidDraw = summary?.paid || null;
  const fillRate = summary?.fill_rate ?? null;
  const selectedDraw = draws.find((draw) => String(draw.id) === String(drawId)) || null;
  const fillPercent = fillRate == null
    ? null
    : Math.min(100, Math.max(0, Number(fillRate) * 100));
  const funnelTotal = funnel
    ? Number(funnel.available || 0) + Number(funnel.reserved || 0) + Number(funnel.sold || 0)
    : 0;

  const leaksRes = (leaks?.expired_reservations || []).map(x => ({
    day: dateKey(x.day),
    r: Number(x.expired_reservations || 0)
  }));
  const leaksPay = (leaks?.expired_payments || []).map(x => ({
    day: dateKey(x.day),
    p: Number(x.expired_payments || 0)
  }));
  const leaksMerged = (() => {
    const map = new Map();
    leaksRes.forEach(a => map.set(a.day, { day: a.day, r: a.r, p: 0 }));
    leaksPay.forEach(b => { const it = map.get(b.day) || { day: b.day, r: 0, p: 0 }; it.p = b.p; map.set(b.day, it); });
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  })();

  // Cohorts: agregados simples por mês para gráfico (GMV total por mês)
  const cohortsByMonth = React.useMemo(() => {
    const agg = new Map();
    (cohorts || []).forEach(r => {
      const m = dateKey(r.month, 7);
      const prev = agg.get(m) || { month: m, gmv: 0, buyers: 0 };
      prev.gmv += Number(r.gmv_cents || 0) / 100;
      prev.buyers += Number(r.active_buyers || 0);
      agg.set(m, prev);
    });
    return Array.from(agg.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [cohorts]);

  // Favoritos: top 20 números por frequência
  const favoriteNumbersTop = React.useMemo(() => {
    const map = new Map();
    (favorites || []).forEach(f => {
      const n = Number(f.n);
      const c = Number(f.times_bought || 0);
      map.set(n, (map.get(n) || 0) + c);
    });
    return Array.from(map.entries())
      .map(([n, c]) => ({ n, c }))
      .sort((a, b) => b.c - a.c)
      .slice(0, 20);
  }, [favorites]);

  const drawRanking = React.useMemo(() => (
    [...(drawsSummary || [])]
      .sort((a, b) => Number(b.gmv_cents || 0) - Number(a.gmv_cents || 0))
      .slice(0, 5)
  ), [drawsSummary]);

  const changeSort = (setter, column) => {
    setter((current) => ({
      key: column,
      direction: current.key === column && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const sortedTopBuyers = React.useMemo(() => sortRows(topBuyers || [], topBuyersSort, (buyer, key) => ({
    name: buyer.name || "",
    email: buyer.email || "",
    orders: Number(buyer.orders || 0),
    gmv: Number(buyer.gmv_cents || 0),
    averageTicket: buyerAverageTicket(buyer) == null ? null : Number(buyerAverageTicket(buyer)),
  })[key]), [topBuyers, topBuyersSort]);

  const sortedDrawRanking = React.useMemo(() => sortRows(drawRanking, drawRankingSort, (draw, key) => ({
    id: Number(draw.id || 0),
    fill: Number(draw.fill_rate || 0),
    gmv: Number(draw.gmv_cents || 0),
  })[key]), [drawRanking, drawRankingSort]);

  const sortedDrawsSummary = React.useMemo(() => sortRows(drawsSummary || [], drawsTableSort, (draw, key) => ({
    id: Number(draw.id || 0),
    product: draw.product_name || "",
    status: draw.status || "",
    sold: Number(draw.sold || 0),
    fill: Number(draw.fill_rate || 0),
    gmv: Number(draw.gmv_cents || 0),
    averageTicket: Number(draw.avg_ticket_cents || 0),
    paidOrders: Number(draw.paid_orders || 0),
  })[key]), [drawsSummary, drawsTableSort]);

  const sortedRfm = React.useMemo(() => sortRows(rfm || [], rfmSort, (row, key) => ({
    name: row.name || "",
    email: row.email || "",
    frequency: Number(row.freq || 0),
    monetary: Number(row.monetary_cents || 0),
    recency: Number(row.recency_days || 0),
    segment: row.segment || "",
  })[key]), [rfm, rfmSort]);

  const sortedCohorts = React.useMemo(() => sortRows(cohorts || [], cohortsSort, (row, key) => ({
    cohort: row.cohort_month || "",
    month: row.month || "",
    buyers: Number(row.active_buyers || 0),
    gmv: Number(row.gmv_cents || 0),
  })[key]), [cohorts, cohortsSort]);

  const sortedCoupons = React.useMemo(() => sortRows(couponsEff || [], couponSort, (coupon, key) => ({
    owner: couponOwnerName(coupon),
    email: coupon.email || "",
    coupon: couponCode(coupon),
    payRate: Number(coupon.pay_rate || 0),
    gmv: Number(coupon.gmv_cents || 0),
    averageTicket: couponAverageTicket(coupon) == null ? null : Number(couponAverageTicket(coupon)),
    averageCoupon: couponAverageValue(coupon) == null ? null : Number(couponAverageValue(coupon)),
  })[key]), [couponsEff, couponSort]);

  const sortedFavorites = React.useMemo(() => sortRows(favorites || [], favoritesSort, (row, key) => ({
    customer: row.name || `#${row.user_id}`,
    number: Number(row.n),
    purchases: Number(row.times_bought || 0),
  })[key]).slice(0, 300), [favorites, favoritesSort]);

  const sortedWinningNumbers = React.useMemo(() => sortRows(winningNumbers || [], winningNumbersSort, (row, key) => {
    const lastWinTime = row.lastWinAt ? new Date(row.lastWinAt).getTime() : null;
    return ({
      number: Number(row.number),
      wins: row.wins == null ? null : Number(row.wins),
      lastDraw: row.lastDraw == null ? null : Number(row.lastDraw),
      lastWinAt: Number.isNaN(lastWinTime) ? null : lastWinTime,
    })[key];
  }), [winningNumbers, winningNumbersSort]);

  const expiredReservationsTotal = leaksRes.reduce((total, row) => total + row.r, 0);
  const expiredPaymentsTotal = leaksPay.reduce((total, row) => total + row.p, 0);
  const operationalAlerts = React.useMemo(() => {
    const items = [];
    if (summary && Number(funnel?.sold || 0) === 0) {
      items.push({ severity: "warning", text: "O sorteio selecionado ainda não possui números vendidos." });
    }
    if (summary && fillRate != null && Number(fillRate) < 0.3) {
      items.push({ severity: "warning", text: `Percentual vendido abaixo de 30% (${pct(fillRate)}).` });
    }
    if (!perDrawState.errors.leaks && expiredReservationsTotal > 0) {
      items.push({ severity: "info", text: `${expiredReservationsTotal} reservas expiradas nos últimos 30 dias.` });
    }
    if (!perDrawState.errors.leaks && expiredPaymentsTotal > 0) {
      items.push({ severity: "info", text: `${expiredPaymentsTotal} pagamentos expirados nos últimos 30 dias.` });
    }
    return items;
  }, [expiredPaymentsTotal, expiredReservationsTotal, fillRate, funnel, perDrawState.errors.leaks, summary]);

  /* ================================ UI ================================ */

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      <AppBar position="sticky" elevation={0} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Toolbar sx={{ minHeight: 64 }}>
          <IconButton edge="start" color="inherit" onClick={() => nav(-1)} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Typography sx={{ fontWeight: 900, ml: 1 }}>Analytics</Typography>
          <IconButton color="inherit" sx={{ ml: "auto" }}>
            <AccountCircleRoundedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: { xs: 2, md: 4 } }}>
        <Paper sx={{ mb: 2, borderRadius: 4 }} variant="outlined">
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            scrollButtons="auto"
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab label="Visão geral" />
            <Tab label="Todos os sorteios" />
            <Tab label="Clientes & Ações" />
            <Tab label="Grupos por mês" />
            <Tab label="Cupons" />
            <Tab label="Compra automática" />
            <Tab label="Tempo até pagar" />
            <Tab label="Números mais comprados" />
          </Tabs>
        </Paper>

        {/* ===================== TAB 0 — OVERVIEW GLOBAL ===================== */}
        {tab === 0 && (
          <Stack spacing={2.5}>
            <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: -.7 }}>Visão executiva</Typography>
                <Typography sx={{ opacity: .62 }}>Vendas, arrecadação e andamento dos sorteios em uma única visão.</Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label="Últimos 30 dias" variant="outlined" />
                {drawId && <Chip label={`Sorteio #${drawId}`} color="primary" />}
              </Stack>
            </Stack>

            <Section
              title="Resumo executivo — GMV (Volume Bruto de Mercadoria)"
              subtitle="GMV representa o valor bruto vendido antes de taxas, custos ou descontos."
              right={
                <Button
                  onClick={() => {
                    loadOverview();
                    loadKpiDashboard();
                  }}
                  startIcon={<RefreshRoundedIcon />}
                  size="small"
                  variant="outlined"
                >
                  Atualizar
                </Button>
              }
            >
              <BlockNotice loading={overviewState.loading} error={overviewState.error} />
              {kpiDashboardState.error && (
                <Alert severity="info" sx={{ my: 1 }}>{kpiDashboardState.error}</Alert>
              )}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: 1.5,
                  mt: 1.5,
                }}
              >
                <KpiCard
                  label="GMV desde o início"
                  value={hasMetric(gmvAllTimeCents) ? BRL(gmvAllTimeCents) : "—"}
                  hint="todos os pagamentos aprovados"
                  loading={kpiDashboardState.loading}
                  error={Boolean(kpiDashboardState.error)}
                />
                <KpiCard
                  label="GMV últimos 30 dias"
                  value={hasMetric(gmv30dCents) ? BRL(gmv30dCents) : "—"}
                  hint="últimos 30 dias"
                  loading={!hasMetric(gmv30dCents) && (overviewState.loading || kpiDashboardState.loading)}
                  error={!hasMetric(gmv30dCents) && Boolean(overviewState.error && kpiDashboardState.error)}
                  accent={CHART_COLORS.secondary}
                />
                <KpiCard
                  label="GMV mês atual"
                  value={hasMetric(gmvCurrentMonthCents) ? BRL(gmvCurrentMonthCents) : "—"}
                  hint="mês em andamento"
                  loading={kpiDashboardState.loading}
                  error={Boolean(kpiDashboardState.error)}
                  accent={CHART_COLORS.warning}
                />
                <KpiCard
                  label="GMV ano atual"
                  value={hasMetric(gmvCurrentYearCents) ? BRL(gmvCurrentYearCents) : "—"}
                  hint="ano em andamento"
                  loading={kpiDashboardState.loading}
                  error={Boolean(kpiDashboardState.error)}
                  accent={CHART_COLORS.muted}
                />
                <KpiCard
                  label="Pedidos confirmados"
                  value={paidOrdersAllTime != null ? paidOrdersAllTime.toLocaleString("pt-BR") : "—"}
                  hint={paidOrders30d != null ? `${paidOrders30d.toLocaleString("pt-BR")} nos últimos 30 dias` : "desde o início"}
                  loading={kpiDashboardState.loading}
                  error={Boolean(kpiDashboardState.error)}
                  accent={CHART_COLORS.secondary}
                />
                <KpiCard
                  label="Valor médio por pedido"
                  value={hasMetric(averageTicketAllTimeCents) ? BRL(averageTicketAllTimeCents) : "—"}
                  hint="desde o início"
                  loading={kpiDashboardState.loading}
                  error={Boolean(kpiDashboardState.error)}
                  accent={CHART_COLORS.warning}
                />
                <KpiCard
                  label="Clientes únicos"
                  value={uniqueBuyersAllTime != null ? uniqueBuyersAllTime.toLocaleString("pt-BR") : "—"}
                  hint="desde o início"
                  loading={kpiDashboardState.loading}
                  error={Boolean(kpiDashboardState.error)}
                  accent={CHART_COLORS.secondary}
                />
                <KpiCard
                  label="Percentual vendido do sorteio"
                  value={summary && fillRate != null ? pct(fillRate) : "—"}
                  hint={drawId ? `sorteio #${drawId}` : "sorteio não selecionado"}
                  loading={perDrawState.loading}
                  error={Boolean(perDrawState.errors.summary)}
                  accent={CHART_COLORS.primary}
                />
                <KpiCard
                  label="Pedidos por cliente"
                  value={averageOrdersPerBuyer != null ? averageOrdersPerBuyer.toFixed(2) : "—"}
                  hint="desde o início"
                  loading={kpiDashboardState.loading}
                  error={Boolean(kpiDashboardState.error)}
                  accent={CHART_COLORS.muted}
                />
                <KpiCard
                  label="Faixas de valor dos pedidos"
                  value={overview ? `${BRL(totals.p50_ticket_cents)} (mediana)` : "—"}
                  hint={overview ? `P25 ${BRL(totals.p25_ticket_cents)} • P75 ${BRL(totals.p75_ticket_cents)} • P90 ${BRL(totals.p90_ticket_cents)}` : "últimos 30 dias"}
                  loading={overviewState.loading}
                  error={Boolean(overviewState.error)}
                  accent={CHART_COLORS.muted}
                />
              </Box>
            </Section>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "minmax(340px, .85fr) minmax(0, 1.55fr)" },
                gap: 2,
              }}
            >
              <Section
                title="Sorteio selecionado"
                subtitle={selectedDraw ? `${selectedDraw.product_name || "Sem nome"} • ${selectedDraw.status || "status não informado"}` : "Selecione um sorteio para acompanhar"}
                right={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <select
                      value={drawId || ""}
                      onChange={(event) => setDrawId(event.target.value)}
                      aria-label="Selecionar sorteio"
                      style={{
                        maxWidth: 210,
                        background: "#121212",
                        border: "1px solid rgba(255,255,255,.18)",
                        color: "#fff",
                        padding: "8px 10px",
                        borderRadius: 8,
                      }}
                    >
                      {(draws || []).map((draw) => (
                        <option key={draw.id} value={draw.id}>
                          #{draw.id} — {draw.product_name || "Sem nome"}
                        </option>
                      ))}
                    </select>
                    <IconButton size="small" onClick={() => loadPerDraw(drawId)} aria-label="Atualizar sorteio selecionado">
                      <RefreshRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                }
              >
                <BlockNotice loading={drawListsState.loading || perDrawState.loading} error={drawListsState.errors.draws || perDrawState.errors.summary} />
                {!perDrawState.loading && summary && funnel && paidDraw && (
                  <Stack spacing={2.25} sx={{ mt: 2 }}>
                    <Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
                        <Typography sx={{ fontWeight: 800, opacity: .72 }}>Progresso de vendas</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 950 }}>{fillPercent == null ? "—" : `${fillPercent.toFixed(0)}%`}</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={fillPercent || 0}
                        sx={{ height: 12, borderRadius: 99, bgcolor: "rgba(255,255,255,.08)" }}
                      />
                    </Box>

                    <Box>
                      <Typography sx={{ fontWeight: 800, opacity: .72, mb: 1 }}>Distribuição dos números</Typography>
                      <Box sx={{ display: "flex", height: 16, borderRadius: 99, overflow: "hidden", bgcolor: "rgba(255,255,255,.08)" }}>
                        {funnelTotal > 0 && Number(funnel.sold || 0) > 0 && (
                          <Box sx={{ width: `${Number(funnel.sold || 0) / funnelTotal * 100}%`, bgcolor: CHART_COLORS.primary }} />
                        )}
                        {funnelTotal > 0 && Number(funnel.reserved || 0) > 0 && (
                          <Box sx={{ width: `${Number(funnel.reserved || 0) / funnelTotal * 100}%`, bgcolor: CHART_COLORS.warning }} />
                        )}
                        {funnelTotal > 0 && Number(funnel.available || 0) > 0 && (
                          <Box sx={{ width: `${Number(funnel.available || 0) / funnelTotal * 100}%`, bgcolor: "rgba(255,255,255,.24)" }} />
                        )}
                      </Box>
                    </Box>

                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1 }}>
                      {[
                        ["Vendidos", funnel.sold, CHART_COLORS.primary],
                        ["Reservados", funnel.reserved, CHART_COLORS.warning],
                        ["Disponíveis", funnel.available, CHART_COLORS.muted],
                      ].map(([label, value, color]) => (
                        <Paper key={label} variant="outlined" sx={{ p: 1.25, borderRadius: 3, borderColor: color }}>
                          <Typography variant="caption" sx={{ opacity: .7 }}>{label}</Typography>
                          <Typography variant="h6" sx={{ fontWeight: 950 }}>{Number(value || 0).toLocaleString("pt-BR")}</Typography>
                        </Paper>
                      ))}
                    </Box>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1.5 }}>
                      <Box><Typography variant="caption" sx={{ opacity: .6 }}>Valor vendido</Typography><Typography sx={{ fontWeight: 900 }}>{BRL(paidDraw.gmv_cents)}</Typography></Box>
                      <Box><Typography variant="caption" sx={{ opacity: .6 }}>Valor médio por pedido</Typography><Typography sx={{ fontWeight: 900 }}>{BRL(paidDraw.avg_ticket_cents)}</Typography></Box>
                      <Box><Typography variant="caption" sx={{ opacity: .6 }}>Pedidos confirmados</Typography><Typography sx={{ fontWeight: 900 }}>{Number(paidDraw.paid_orders || 0).toLocaleString("pt-BR")}</Typography></Box>
                    </Box>
                  </Stack>
                )}
              </Section>

              <Section title="Vendas por dia (GMV)" subtitle="Pagas, aguardando confirmação e expiradas • últimos 30 dias">
                <BlockNotice loading={overviewState.loading} error={overviewState.error} />
                <Box height={{ xs: 280, md: 340 }} sx={{ minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyGMV} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Legend />
                      <RTooltip formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                      <Area type="monotone" dataKey="paid" name="Confirmado (R$)" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primary} fillOpacity={.3} />
                      <Area type="monotone" dataKey="intent" name="Aguardando confirmação (R$)" stroke={CHART_COLORS.secondary} fill={CHART_COLORS.secondary} fillOpacity={.18} />
                      <Area type="monotone" dataKey="expired" name="Expirado (R$)" stroke={CHART_COLORS.error} fill={CHART_COLORS.error} fillOpacity={.14} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </Section>
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
              <Section title="Pedidos por dia" subtitle="Últimos 30 dias">
                <BlockNotice loading={overviewState.loading} error={overviewState.error} />
                <Box height={280} sx={{ minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyOrders}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="day" />
                      <YAxis allowDecimals={false} />
                      <Legend />
                      <RTooltip />
                      <Bar dataKey="paid" name="Confirmados" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="intent" name="Aguardando confirmação" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expired" name="Expirados" fill={CHART_COLORS.error} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Section>
              <Section title="Horários com mais pagamentos" subtitle="Horário de Brasília">
                <BlockNotice loading={overviewState.loading} error={overviewState.error} />
                <Box height={280} sx={{ minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={hourlyPaid}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="h" tickFormatter={(h) => `${h}h`} />
                      <YAxis allowDecimals={false} />
                      <RTooltip />
                      <Line type="monotone" dataKey="paid" name="Pagamentos confirmados" stroke={CHART_COLORS.secondary} strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Section>
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
              <Section title="Clientes que mais compraram" subtitle="Ranking por valor vendido">
                <BlockNotice loading={overviewState.loading} error={overviewState.error} />
                <TableContainer>
                  <Table size="small" sx={{ minWidth: 720 }}>
                    <TableHead>
                      <TableRow>
                        <SortableHeader label="Cliente" column="name" sortConfig={topBuyersSort} onSort={(column) => changeSort(setTopBuyersSort, column)} />
                        <SortableHeader label="E-mail" column="email" sortConfig={topBuyersSort} onSort={(column) => changeSort(setTopBuyersSort, column)} />
                        <SortableHeader label="Pedidos confirmados" column="orders" sortConfig={topBuyersSort} onSort={(column) => changeSort(setTopBuyersSort, column)} align="right" />
                        <SortableHeader label="Valor vendido (GMV)" column="gmv" sortConfig={topBuyersSort} onSort={(column) => changeSort(setTopBuyersSort, column)} align="right" />
                        <SortableHeader label="Valor médio por pedido" column="averageTicket" sortConfig={topBuyersSort} onSort={(column) => changeSort(setTopBuyersSort, column)} align="right" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedTopBuyers.map((b, i) => (
                        <TableRow key={b.user_id || i} hover>
                          <TableCell sx={{ fontWeight: 700 }}>{b.name || "(sem nome)"}</TableCell>
                          <TableCell>{b.email || "-"}</TableCell>
                          <TableCell align="right">{b.orders || 0}</TableCell>
                          <TableCell align="right">{BRL(b.gmv_cents)}</TableCell>
                          <TableCell align="right">{hasMetric(buyerAverageTicket(b)) ? BRL(buyerAverageTicket(b)) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Section>

              <Section title="Ranking de sorteios" subtitle="Top 5 por valor vendido">
                <BlockNotice loading={drawListsState.loading} error={drawListsState.errors.summary} />
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <SortableHeader label="Sorteio" column="id" sortConfig={drawRankingSort} onSort={(column) => changeSort(setDrawRankingSort, column)} />
                        <SortableHeader label="Percentual vendido registrado" column="fill" sortConfig={drawRankingSort} onSort={(column) => changeSort(setDrawRankingSort, column)} align="right" />
                        <SortableHeader label="Valor vendido (GMV)" column="gmv" sortConfig={drawRankingSort} onSort={(column) => changeSort(setDrawRankingSort, column)} align="right" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedDrawRanking.map((draw) => (
                        <TableRow key={draw.id} hover>
                          <TableCell><b>#{draw.id}</b><br /><Typography variant="caption" sx={{ opacity: .62 }}>{draw.product_name || "Sem nome"}</Typography></TableCell>
                          <TableCell align="right">{pct(draw.fill_rate || 0)}</TableCell>
                          <TableCell align="right">{BRL(draw.gmv_cents)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Section>

              <Section title="Números mais comprados" subtitle="20 mais comprados">
                <BlockNotice loading={favoritesState.loading} error={favoritesState.error} />
                <Box height={260} sx={{ minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={favoriteNumbersTop}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="n" />
                      <YAxis allowDecimals={false} />
                      <RTooltip />
                      <Bar dataKey="c" name="Vezes comprado" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Section>
            </Box>

            <Section title="Alertas operacionais" subtitle="Sinais simples a partir dos dados disponíveis">
              {perDrawState.loading ? (
                <BlockNotice loading />
              ) : (
                <Stack spacing={1} sx={{ mt: 1.5 }}>
                  {perDrawState.errors.summary && <Alert severity="warning">Não foi possível avaliar o andamento do sorteio agora.</Alert>}
                  {perDrawState.errors.leaks && <Alert severity="warning">Não foi possível avaliar reservas e pagamentos expirados agora.</Alert>}
                  {!perDrawState.errors.summary && !perDrawState.errors.leaks && operationalAlerts.length === 0 && (
                    <Alert severity="success">Nenhum alerta crítico no período.</Alert>
                  )}
                  {operationalAlerts.map((alert, index) => (
                    <Alert key={`${alert.text}-${index}`} severity={alert.severity}>{alert.text}</Alert>
                  ))}
                </Stack>
              )}
            </Section>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
              <Section title="Reservas e pagamentos expirados" subtitle="Últimos 30 dias">
                <BlockNotice loading={perDrawState.loading} error={perDrawState.errors.leaks} />
                <Box height={260} sx={{ minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={leaksMerged}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="day" />
                      <YAxis allowDecimals={false} />
                      <Legend />
                      <RTooltip />
                      <Area type="monotone" dataKey="r" name="Reservas expiradas" stroke={CHART_COLORS.warning} fill={CHART_COLORS.warning} fillOpacity={.22} />
                      <Area type="monotone" dataKey="p" name="Pagamentos expirados" stroke={CHART_COLORS.error} fill={CHART_COLORS.error} fillOpacity={.16} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              </Section>

              <Section title="Tempo até o pagamento" subtitle="Tempo médio entre a reserva e a confirmação do pagamento.">
                <BlockNotice loading={perDrawState.loading} error={perDrawState.errors.latency} />
                <Box height={260} sx={{ minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={(latency?.weekly || []).map(x => ({ week: dateKey(x.week), avg: Number(x.avg_minutes || 0) }))}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <RTooltip formatter={(v) => `${Number(v).toFixed(1)} min`} />
                      <Line type="monotone" dataKey="avg" name="Minutos" stroke={CHART_COLORS.secondary} strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Section>
            </Box>
          </Stack>
        )}

        {/* ================== TAB 1 — TODOS OS SORTEIOS ================== */}
        {tab === 1 && (
          <Stack spacing={2}>
            <Section
              title="Percentual vendido registrado por sorteio"
              right={
                <Button onClick={() => loadDrawLists()} startIcon={<RefreshRoundedIcon />} size="small" variant="outlined">
                  Atualizar
                </Button>
              }
            >
              <BlockNotice loading={drawListsState.loading} error={drawListsState.errors.summary} />
              <Box height={320} sx={{ minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(drawsSummary || []).map(d => ({ id: d.id, fr: Number(d.fill_rate || 0) * 100 }))}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="id" />
                    <YAxis unit="%" />
                    <RTooltip />
                    <Bar dataKey="fr" name="Percentual vendido registrado" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Section>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) minmax(0, 1.3fr)" }, gap: 2 }}>
              <Section title="Histórico de vendas (GMV)" subtitle="Por data de realização, fechamento ou abertura">
                <BlockNotice loading={drawListsState.loading} error={drawListsState.errors.summary} />
                <Box height={320} sx={{ minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={(drawsSummary || [])
                        .map(d => ({
                          date: dateKey(d.realized_at || d.closed_at || d.opened_at),
                          gmv: Number(d.gmv_cents || 0) / 100
                        }))
                        .sort((a, b) => a.date.localeCompare(b.date))}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RTooltip formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                      <Line type="monotone" dataKey="gmv" name="Valor vendido (R$)" stroke={CHART_COLORS.primary} strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Box>
              </Section>

              <Section title="Resumo dos sorteios">
                <BlockNotice loading={drawListsState.loading} error={drawListsState.errors.summary} />
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <SortableHeader label="ID" column="id" sortConfig={drawsTableSort} onSort={(column) => changeSort(setDrawsTableSort, column)} />
                        <SortableHeader label="Produto" column="product" sortConfig={drawsTableSort} onSort={(column) => changeSort(setDrawsTableSort, column)} />
                        <SortableHeader label="Status" column="status" sortConfig={drawsTableSort} onSort={(column) => changeSort(setDrawsTableSort, column)} />
                        <SortableHeader label="Vendidos" column="sold" sortConfig={drawsTableSort} onSort={(column) => changeSort(setDrawsTableSort, column)} align="right" />
                        <SortableHeader label="Percentual vendido registrado" column="fill" sortConfig={drawsTableSort} onSort={(column) => changeSort(setDrawsTableSort, column)} align="right" />
                        <SortableHeader label="Valor vendido (GMV)" column="gmv" sortConfig={drawsTableSort} onSort={(column) => changeSort(setDrawsTableSort, column)} align="right" />
                        <SortableHeader label="Valor médio por pedido" column="averageTicket" sortConfig={drawsTableSort} onSort={(column) => changeSort(setDrawsTableSort, column)} align="right" />
                        <SortableHeader label="Pedidos confirmados" column="paidOrders" sortConfig={drawsTableSort} onSort={(column) => changeSort(setDrawsTableSort, column)} align="right" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedDrawsSummary.map(d => (
                        <TableRow key={d.id} hover>
                          <TableCell>#{d.id}</TableCell>
                          <TableCell>{d.product_name || "-"}</TableCell>
                          <TableCell>{d.status}</TableCell>
                          <TableCell align="right">{d.sold || 0}</TableCell>
                          <TableCell align="right">{pct(d.fill_rate || 0)}</TableCell>
                          <TableCell align="right">{BRL(d.gmv_cents)}</TableCell>
                          <TableCell align="right">{BRL(d.avg_ticket_cents)}</TableCell>
                          <TableCell align="right">{d.paid_orders || 0}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Section>
            </Box>
          </Stack>
        )}

        {/* ================== TAB 2 — RFM & AÇÕES ================== */}
        {tab === 2 && (
          <Section
            title="Clientes por comportamento de compra"
            subtitle="RFM mostra clientes por frequência, valor comprado e tempo desde a última compra."
            right={<Button onClick={() => loadRfm()} startIcon={<RefreshRoundedIcon />} size="small" variant="outlined">Atualizar</Button>}
          >
            <BlockNotice loading={rfmState.loading} error={rfmState.error} />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <SortableHeader label="Cliente" column="name" sortConfig={rfmSort} onSort={(column) => changeSort(setRfmSort, column)} />
                    <SortableHeader label="E-mail" column="email" sortConfig={rfmSort} onSort={(column) => changeSort(setRfmSort, column)} />
                    <SortableHeader label="Quantidade de compras" column="frequency" sortConfig={rfmSort} onSort={(column) => changeSort(setRfmSort, column)} align="right" />
                    <SortableHeader label="Valor total comprado" column="monetary" sortConfig={rfmSort} onSort={(column) => changeSort(setRfmSort, column)} align="right" />
                    <SortableHeader label="Dias desde a última compra" column="recency" sortConfig={rfmSort} onSort={(column) => changeSort(setRfmSort, column)} align="right" />
                    <SortableHeader label="Tipo de cliente" column="segment" sortConfig={rfmSort} onSort={(column) => changeSort(setRfmSort, column)} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedRfm.map((r, i) => (
                    <TableRow key={r.id || i} hover>
                      <TableCell>{r.name || "-"}</TableCell>
                      <TableCell>{r.email || "-"}</TableCell>
                      <TableCell align="right">{r.freq || 0}</TableCell>
                      <TableCell align="right">{BRL(r.monetary_cents)}</TableCell>
                      <TableCell align="right">{Number(r.recency_days || 0).toFixed(1)}</TableCell>
                      <TableCell>{r.segment || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Section>
        )}

        {/* ================== TAB 3 — COHORTS ================== */}
        {tab === 3 && (
          <Stack spacing={2}>
            <Section
              title="Grupos de clientes por mês"
              subtitle="Mostra como clientes de cada mês continuam comprando ao longo do tempo."
              right={<Button onClick={() => loadCohorts()} startIcon={<RefreshRoundedIcon />} size="small" variant="outlined">Atualizar</Button>}
            >
              <BlockNotice loading={cohortsState.loading} error={cohortsState.error} />
              <Box height={320} sx={{ minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cohortsByMonth}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Legend />
                    <RTooltip formatter={(v) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                    <Line type="monotone" dataKey="gmv" name="Valor vendido (R$)" stroke={CHART_COLORS.primary} strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Section>

            <Section title="Acompanhamento por grupo e mês">
              <BlockNotice loading={cohortsState.loading} error={cohortsState.error} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <SortableHeader label="Grupo de entrada" column="cohort" sortConfig={cohortsSort} onSort={(column) => changeSort(setCohortsSort, column)} />
                      <SortableHeader label="Mês" column="month" sortConfig={cohortsSort} onSort={(column) => changeSort(setCohortsSort, column)} />
                      <SortableHeader label="Clientes ativos" column="buyers" sortConfig={cohortsSort} onSort={(column) => changeSort(setCohortsSort, column)} align="right" />
                      <SortableHeader label="Valor vendido (GMV)" column="gmv" sortConfig={cohortsSort} onSort={(column) => changeSort(setCohortsSort, column)} align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedCohorts.map((c, i) => (
                      <TableRow key={i} hover>
                        <TableCell>{dateKey(c.cohort_month, 7)}</TableCell>
                        <TableCell>{dateKey(c.month, 7)}</TableCell>
                        <TableCell align="right">{c.active_buyers || 0}</TableCell>
                        <TableCell align="right">{BRL(c.gmv_cents)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Section>
          </Stack>
        )}

        {/* ================== TAB 4 — CUPONS ================== */}
        {tab === 4 && (
          <Section
            title="Eficiência por cupom"
            right={
              <Button onClick={() => loadExtras()} startIcon={<RefreshRoundedIcon />} size="small" variant="outlined">
                Atualizar
              </Button>
            }
          >
            <BlockNotice loading={extrasState.loading} error={extrasState.errors.coupons} />
            <TableContainer>
              <Table size="small" sx={{ minWidth: 1100 }}>
                <TableHead>
                  <TableRow>
                    <SortableHeader label="Dono do cupom" column="owner" sortConfig={couponSort} onSort={(column) => changeSort(setCouponSort, column)} />
                    <SortableHeader label="E-mail" column="email" sortConfig={couponSort} onSort={(column) => changeSort(setCouponSort, column)} />
                    <SortableHeader label="Cupom" column="coupon" sortConfig={couponSort} onSort={(column) => changeSort(setCouponSort, column)} />
                    <SortableHeader label="Percentual confirmado" column="payRate" sortConfig={couponSort} onSort={(column) => changeSort(setCouponSort, column)} align="right" />
                    <SortableHeader label="Valor vendido (GMV)" column="gmv" sortConfig={couponSort} onSort={(column) => changeSort(setCouponSort, column)} align="right" />
                    <SortableHeader label="Valor médio por pedido" column="averageTicket" sortConfig={couponSort} onSort={(column) => changeSort(setCouponSort, column)} align="right" />
                    <SortableHeader label="Valor médio do cupom" column="averageCoupon" sortConfig={couponSort} onSort={(column) => changeSort(setCouponSort, column)} align="right" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedCoupons.map((c, i) => (
                    <TableRow key={`${c.user_id || "owner"}-${couponCode(c)}-${i}`} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{couponOwnerName(c)}</TableCell>
                      <TableCell>{c.email || "—"}</TableCell>
                      <TableCell>{couponCode(c)}</TableCell>
                      <TableCell align="right">{hasMetric(c.pay_rate) ? `${(Number(c.pay_rate) * 100).toFixed(1)}%` : "—"}</TableCell>
                      <TableCell align="right">{hasMetric(c.gmv_cents) ? BRL(c.gmv_cents) : "—"}</TableCell>
                      <TableCell align="right">{hasMetric(couponAverageTicket(c)) ? BRL(couponAverageTicket(c)) : "—"}</TableCell>
                      <TableCell align="right">{hasMetric(couponAverageValue(c)) ? BRL(couponAverageValue(c)) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Section>
        )}

        {/* ================== TAB 5 — AUTOPAY ================== */}
        {tab === 5 && (
          <Stack spacing={2}>
            <Section
              title="Compra automática"
              subtitle="Resultados das tentativas automáticas de compra."
              right={
                <Button onClick={() => loadExtras()} startIcon={<RefreshRoundedIcon />} size="small" variant="outlined">
                  Atualizar
                </Button>
              }
            >
              <BlockNotice loading={extrasState.loading} error={extrasState.errors.autopay} />
              <Box height={300} sx={{ minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={(autopayStats?.daily || []).map(x => ({
                      day: dateKey(x.day),
                      runs: Number(x.runs || 0),
                      ok: Number(x.ok_runs || 0)
                    }))}
                  >
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="day" />
                    <YAxis allowDecimals={false} />
                    <Legend />
                    <RTooltip />
                    <Line type="monotone" dataKey="runs" name="Tentativas" stroke={CHART_COLORS.secondary} strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="ok" name="Concluídas" stroke={CHART_COLORS.primary} strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Section>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 4 }}>
              <Typography>🧠 Média de números "perdidos" por execução: <b>{extrasState.errors.autopay ? "—" : Number(autopayStats?.avg_missed ?? 0).toFixed(2)}</b></Typography>
            </Paper>
          </Stack>
        )}

        {/* ================== TAB 6 — LATÊNCIA (GLOBAL) ================== */}
        {tab === 6 && (
          <Section
            title="Tempo até o pagamento"
            subtitle="Tempo médio entre a reserva e a confirmação do pagamento."
            right={<Button onClick={() => loadLatencyGlobal()} startIcon={<RefreshRoundedIcon />} size="small" variant="outlined">Atualizar</Button>}
          >
            <BlockNotice loading={latencyGlobalState.loading} error={latencyGlobalState.error} />
            <Stack spacing={1} sx={{ mb: 2 }}>
              <Typography>Tempo médio até o pagamento: <b>{!latencyGlobalState.error && latencyGlobal?.avg_minutes_to_pay != null ? `${Number(latencyGlobal.avg_minutes_to_pay).toFixed(1)} min` : "—"}</b></Typography>
            </Stack>
            <Box height={260}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={(latencyGlobal?.weekly || []).map(x => ({
                    week: dateKey(x.week),
                    avg: Number(x.avg_minutes || 0)
                  }))}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <RTooltip formatter={(v) => `${Number(v).toFixed(1)} min`} />
                  <Line type="monotone" dataKey="avg" name="Minutos" stroke={CHART_COLORS.secondary} strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Section>
        )}

        {/* ================== TAB 7 — FAVORITOS & NÚMEROS ================== */}
        {tab === 7 && (
          <Stack spacing={2}>
            <Section
              title="Números mais comprados por cliente"
              right={<Button onClick={() => loadFavorites()} startIcon={<RefreshRoundedIcon />} size="small" variant="outlined">Atualizar</Button>}
            >
              <BlockNotice loading={favoritesState.loading} error={favoritesState.error} />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <SortableHeader label="Cliente" column="customer" sortConfig={favoritesSort} onSort={(column) => changeSort(setFavoritesSort, column)} />
                      <SortableHeader label="Número" column="number" sortConfig={favoritesSort} onSort={(column) => changeSort(setFavoritesSort, column)} align="right" />
                      <SortableHeader label="Quantidade de compras" column="purchases" sortConfig={favoritesSort} onSort={(column) => changeSort(setFavoritesSort, column)} align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedFavorites.map((f, i) => (
                      <TableRow key={i} hover>
                        <TableCell>{f.name || `#${f.user_id}`}</TableCell>
                        <TableCell align="right">{String(f.n).padStart(2, "0")}</TableCell>
                        <TableCell align="right">{f.times_bought || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Section>

            <Section title="20 números mais comprados" subtitle="Todas as compras confirmadas">
              <BlockNotice loading={favoritesState.loading} error={favoritesState.error} />
              <Box height={300} sx={{ minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={favoriteNumbersTop}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="n" />
                    <YAxis allowDecimals={false} />
                    <RTooltip />
                    <Bar dataKey="c" name="Vezes comprado" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </Section>

            <Section
              title="Números que mais ganharam sorteios"
              subtitle="Frequência dos números vencedores, separada das compras"
              right={<Button onClick={() => loadWinningNumbers()} startIcon={<RefreshRoundedIcon />} size="small" variant="outlined">Atualizar</Button>}
            >
              {winningNumbersState.loading && <BlockNotice loading />}
              {winningNumbersState.error && <Alert severity="warning" sx={{ my: 1 }}>{winningNumbersState.error}</Alert>}
              {!winningNumbersState.loading && !winningNumbersState.error && sortedWinningNumbers.length === 0 && (
                <Alert severity="info" sx={{ my: 1 }}>Nenhum número vencedor registrado ainda.</Alert>
              )}
              {!winningNumbersState.loading && !winningNumbersState.error && sortedWinningNumbers.length > 0 && (
                <TableContainer>
                  <Table size="small" sx={{ minWidth: 680 }}>
                    <TableHead>
                      <TableRow>
                        <SortableHeader label="Número" column="number" sortConfig={winningNumbersSort} onSort={(column) => changeSort(setWinningNumbersSort, column)} />
                        <SortableHeader label="Quantidade de vitórias" column="wins" sortConfig={winningNumbersSort} onSort={(column) => changeSort(setWinningNumbersSort, column)} align="right" />
                        <SortableHeader label="Último sorteio" column="lastDraw" sortConfig={winningNumbersSort} onSort={(column) => changeSort(setWinningNumbersSort, column)} align="right" />
                        <SortableHeader label="Data da última vitória" column="lastWinAt" sortConfig={winningNumbersSort} onSort={(column) => changeSort(setWinningNumbersSort, column)} align="right" />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedWinningNumbers.map((row, index) => (
                        <TableRow key={`${row.key}-${index}`} hover>
                          <TableCell sx={{ fontWeight: 800 }}>{String(row.number).padStart(2, "0")}</TableCell>
                          <TableCell align="right">{row.wins ?? "—"}</TableCell>
                          <TableCell align="right">{row.lastDraw != null ? `#${row.lastDraw}` : "—"}</TableCell>
                          <TableCell align="right">{row.lastWinAt ? dateKey(row.lastWinAt) : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Section>
          </Stack>
        )}
      </Container>
    </ThemeProvider>
  );
}
