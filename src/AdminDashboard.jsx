// src/AdminDashboard.jsx
import * as React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  ButtonBase,
  Container,
  CssBaseline,
  Divider,
  Alert,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tab,
  Tabs,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
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

/* ---------- helpers de API (robusto com /api) ---------- */
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
  const r = await fetch(apiJoin(path), {
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "omit",
    cache: "no-store", // evita cache 304
  });
  if (!r.ok) {
    let err = `${r.status}`;
    try { const j = await r.json(); if (j?.error || j?.message) err = j.error || j.message; } catch {}
    throw new Error(err);
  }
  return r.json();
}
async function postJSON(path, body, method = "POST") {
  const r = await fetch(apiJoin(path), {
    method,
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "omit",
    body: JSON.stringify(body || {}),
  });
  if (!r.ok) {
    let err = `${r.status}`;
    try { const j = await r.json(); if (j?.error || j?.message) err = j.error || j.message; } catch {}
    throw new Error(err);
  }
  return r.json().catch(() => ({}));
}

const EMPTY_ADDITIONAL_FORM = {
  banner_title: "",
  ticket_price_cents: "",
  max_numbers_per_selection: 25,
};

const normalizeAdditionalDraws = (payload) => {
  const list = Array.isArray(payload)
    ? payload
    : payload?.draws ?? payload?.data?.draws ?? [];

  if (!Array.isArray(list)) return [];

  return list
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const draw = item.draw && typeof item.draw === "object" ? item.draw : item;
      const config = item.config && typeof item.config === "object" ? item.config : {};
      const stats = item.stats && typeof item.stats === "object" ? item.stats : {};
      const buyers = Array.isArray(item.buyers)
        ? item.buyers
        : Array.isArray(draw?.buyers)
        ? draw.buyers
        : [];
      return draw?.id == null ? null : { draw, config, stats, buyers };
    })
    .filter(Boolean);
};

const additionalFormFromItem = (item) => ({
  banner_title: String(item?.config?.banner_title ?? item?.draw?.banner_title ?? ""),
  ticket_price_cents: String(
    item?.config?.ticket_price_cents ?? item?.draw?.ticket_price_cents ?? ""
  ),
  max_numbers_per_selection:
    item?.config?.max_numbers_per_selection ??
    item?.draw?.max_numbers_per_selection ??
    25,
});

/* ---------- Card grande clicável (as 3 listas) ---------- */
const ADMIN_NEWSTORE_GREEN = "#047514";
const ADMIN_NEWSTORE_GREEN_HOVER = "#058a18";
const ADMIN_NEWSTORE_GREEN_BORDER = "#0bbf2a";
const ADMIN_NEWSTORE_GREEN_SHADOW = "rgba(5, 138, 24, 0.25)";

function BigCard({ children, onClick }) {
  return (
    <ButtonBase onClick={onClick} sx={{ width: "100%" }}>
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          p: { xs: 3, md: 4 },
          borderRadius: 4,
          bgcolor: ADMIN_NEWSTORE_GREEN,
          border: `1px solid ${ADMIN_NEWSTORE_GREEN_BORDER}`,
          boxShadow: `0 14px 28px ${ADMIN_NEWSTORE_GREEN_SHADOW}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: { xs: 120, md: 140 },
          transition: "transform 120ms ease, background-color 120ms ease, box-shadow 120ms ease",
          "&:hover": {
            transform: "translateY(-2px)",
            bgcolor: ADMIN_NEWSTORE_GREEN_HOVER,
            boxShadow: `0 16px 32px ${ADMIN_NEWSTORE_GREEN_SHADOW}`,
          },
          textAlign: "center",
        }}
      >
        <Typography
          sx={{
            fontWeight: 900,
            letterSpacing: 2,
            fontSize: { xs: 18, md: 28 },
            lineHeight: 1.25,
            color: "#fff",
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

  const [principalDraw, setPrincipalDraw] = React.useState(null);
  const [principalStats, setPrincipalStats] = React.useState({ sold: 0, remaining: 0 });
  const [principalForm, setPrincipalForm] = React.useState({
    ticket_price_cents: "",
    max_numbers_per_selection: 5,
    banner_title: "",
  });
  const [principalLoading, setPrincipalLoading] = React.useState(true);
  const [principalSaving, setPrincipalSaving] = React.useState(false);
  const [principalCreating, setPrincipalCreating] = React.useState(false);
  const [principalClosing, setPrincipalClosing] = React.useState(false);
  const [drawMode, setDrawMode] = React.useState("principal");
  const [additionalDraws, setAdditionalDraws] = React.useState([]);
  const [selectedAdditionalDrawId, setSelectedAdditionalDrawId] = React.useState("");
  const [selectedAdditionalItem, setSelectedAdditionalItem] = React.useState(null);
  const [additionalForm, setAdditionalForm] = React.useState(EMPTY_ADDITIONAL_FORM);
  const [additionalLoading, setAdditionalLoading] = React.useState(false);
  const [additionalSaving, setAdditionalSaving] = React.useState(false);
  const [additionalCreating, setAdditionalCreating] = React.useState(false);
  const [additionalError, setAdditionalError] = React.useState("");
  const selectedAdditionalDrawIdRef = React.useRef("");

  const loadSummary = React.useCallback(async () => {
    setPrincipalLoading(true);
    try {
      // resumo do dashboard
      const r = await getJSON("/admin/dashboard/summary");
      setPrincipalDraw(
        r.draw_id == null
          ? null
          : {
              id: r.draw_id,
              status: r.status || null,
              draw_type: r.draw_type || "principal",
              closed_at: r.closed_at || null,
              realized_at: r.realized_at || null,
            }
      );
      setPrincipalStats({ sold: r.sold ?? 0, remaining: r.remaining ?? r.available ?? 0 });
      if (Number.isFinite(Number(r.price_cents))) {
        setPrincipalForm((form) => ({
          ...form,
          ticket_price_cents: String(Number(r.price_cents)),
        }));
      }

      // configurações públicas
      try {
        const cfg = await getJSON("/config");

        const cfgCents =
          cfg?.ticket_price_cents ??
          cfg?.price_cents ??
          cfg?.current?.price_cents ??
          cfg?.current_draw?.price_cents ??
          null;
        if (cfgCents != null && Number.isFinite(Number(cfgCents))) {
          setPrincipalForm((form) => ({
            ...form,
            ticket_price_cents: String(Number(cfgCents)),
          }));
        }

        const maxSel =
          cfg?.max_numbers_per_selection ??
          cfg?.max_per_selection ??
          cfg?.max_select ??
          null;
        if (maxSel != null && !Number.isNaN(Number(maxSel))) {
          setPrincipalForm((form) => ({
            ...form,
            max_numbers_per_selection: Number(maxSel),
          }));
        }

        const banner =
          cfg?.banner_title ??
          cfg?.promo_title ??
          cfg?.headline ??
          "";
        if (banner != null) {
          setPrincipalForm((form) => ({ ...form, banner_title: String(banner) }));
        }
      } catch (e) {
        console.warn("[AdminDashboard] GET /config opcional:", e?.message || e);
      }
    } catch (e) {
      console.error("[AdminDashboard] GET /summary failed:", e);
      setPrincipalDraw(null);
      setPrincipalStats({ sold: 0, remaining: 0 });
    } finally {
      setPrincipalLoading(false);
    }
  }, []);

  React.useEffect(() => { loadSummary(); }, [loadSummary]);

  const selectAdditionalItem = React.useCallback((item) => {
    const id = item?.draw?.id == null ? "" : String(item.draw.id);
    selectedAdditionalDrawIdRef.current = id;
    setSelectedAdditionalDrawId(id);
    setSelectedAdditionalItem(item || null);
    setAdditionalForm(item ? additionalFormFromItem(item) : EMPTY_ADDITIONAL_FORM);
  }, []);

  const loadAdditionalDraws = React.useCallback(async (preferredId, selectNewest = false) => {
    setAdditionalLoading(true);
    setAdditionalError("");
    try {
      const response = await fetch(apiJoin("/admin/additional-draws"), {
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "omit",
        cache: "no-store",
      });
      if (response.status === 204 || response.status === 404) {
        setAdditionalDraws([]);
        selectAdditionalItem(null);
        return;
      }
      if (!response.ok) throw new Error(`${response.status}`);
      const payload = await response.json().catch(() => ({}));
      const draws = normalizeAdditionalDraws(payload);
      setAdditionalDraws(draws);
      const wantedId = preferredId ?? selectedAdditionalDrawIdRef.current;
      const selected =
        draws.find((item) => String(item.draw.id) === String(wantedId)) ||
        (selectNewest
          ? [...draws].sort((a, b) => Number(b.draw.id) - Number(a.draw.id))[0]
          : null) ||
        draws[0] ||
        null;
      selectAdditionalItem(selected);
    } catch (e) {
      if (String(e?.message || "") === "404") {
        setAdditionalDraws([]);
        selectAdditionalItem(null);
        setAdditionalError("");
      } else {
        setAdditionalError("Não foi possível carregar os sorteios adicionais.");
      }
    } finally {
      setAdditionalLoading(false);
    }
  }, [selectAdditionalItem]);

  React.useEffect(() => {
    if (drawMode === "adicionais") loadAdditionalDraws();
  }, [drawMode, loadAdditionalDraws]);

  // SALVAR: mantém o fluxo do preço que já funciona e tenta salvar os novos campos
  const onSaveAll = async () => {
    if (drawMode === "adicionais") {
      if (!selectedAdditionalItem?.draw?.id) {
        alert("Nenhum sorteio adicional cadastrado para atualizar.");
        return;
      }
      setAdditionalSaving(true);
      try {
        await postJSON(
          `/admin/additional-draws/${selectedAdditionalItem.draw.id}`,
          {
            banner_title: String(additionalForm.banner_title || ""),
            product_name: String(additionalForm.banner_title || ""),
            ticket_price_cents: Math.max(
              0,
              Math.floor(Number(additionalForm.ticket_price_cents || 0))
            ),
            max_numbers_per_selection: Math.max(
              1,
              Math.floor(Number(additionalForm.max_numbers_per_selection || 1))
            ),
          },
          "PATCH"
        );
        await loadAdditionalDraws(selectedAdditionalItem.draw.id);
        alert("Sorteio adicional atualizado.");
      } catch (e) {
        console.error("[AdminDashboard] PATCH additional draw failed:", e);
        alert("Não foi possível atualizar o sorteio adicional.");
      } finally {
        setAdditionalSaving(false);
      }
      return;
    }

    setPrincipalSaving(true);
    let msg = "Configurações atualizadas.";
    try {
      // 1) preço — usa a rota que já funciona hoje
      const priceCents = Number(principalForm.ticket_price_cents);
      if (!Number.isInteger(priceCents) || priceCents <= 0) {
        alert("Informe um valor válido para a cota antes de salvar.");
        return;
      }
      await postJSON("/admin/dashboard/ticket-price", { price_cents: priceCents });

      // 2) banner + max — tenta POST /config (se seu backend ainda não tiver, isso cairá no catch)
      try {
        await postJSON("/config", {
          banner_title: String(principalForm.banner_title || ""),
          max_numbers_per_selection: Math.max(
            1,
            Math.floor(Number(principalForm.max_numbers_per_selection || 1))
          ),
        });
      } catch (e) {
        console.warn("[AdminDashboard] POST /config falhou:", e?.message || e);
        msg =
          "Preço atualizado. Para salvar 'Frase promocional' e 'Máximo de tickets', habilite POST /api/config no backend.";
      }

      await loadSummary();
      alert(msg);
    } catch (e) {
      console.error("[AdminDashboard] salvar configs falhou:", e);
      alert("Não foi possível atualizar as configurações agora.");
    } finally {
      setPrincipalSaving(false);
    }
  };

  const onNewDraw = async () => {
    if (drawMode === "adicionais") {
      try {
        setAdditionalCreating(true);
        const bannerTitle = String(additionalForm.banner_title || "SORTEIO ADICIONAL");
        const ticketPriceCents = Math.max(
          0,
          Math.floor(Number(additionalForm.ticket_price_cents || 10000))
        );
        const maxNumbersPerSelection = Math.max(
          1,
          Math.floor(Number(additionalForm.max_numbers_per_selection || 25))
        );
        const created = await postJSON("/admin/additional-draws", {
          draw_type: "adicional",
          product_name: bannerTitle,
          banner_title: bannerTitle,
          ticket_price_cents: ticketPriceCents,
          max_numbers_per_selection: maxNumbersPerSelection,
          number_count: 100,
        });
        const createdId =
          created?.draw?.id ??
          created?.data?.draw?.id ??
          created?.id ??
          created?.draw_id;
        await loadAdditionalDraws(createdId, createdId == null);
      } catch (e) {
        console.error("[AdminDashboard] POST additional draw failed:", e);
        alert("Não foi possível criar o sorteio adicional.");
      } finally {
        setAdditionalCreating(false);
      }
      return;
    }

    try {
      setPrincipalCreating(true);
      const ticketPriceCents = Number(principalForm.ticket_price_cents);
      if (!Number.isInteger(ticketPriceCents) || ticketPriceCents <= 0) {
        alert("Informe um valor válido para a cota antes de criar o sorteio.");
        return;
      }
      await postJSON("/admin/dashboard/new", {
        draw_type: "principal",
        number_count: 100,
        ticket_price_cents: ticketPriceCents,
      });
      await loadSummary();
      // Notifica o frontend para refetch imediato de config/numbers (reservados) sem esperar polling
      try {
        window.dispatchEvent(new CustomEvent("ns:draw:changed"));
        window.dispatchEvent(new CustomEvent("ns:numbers:reload"));
      } catch {}
    } catch (e) {
      console.error("[AdminDashboard] POST /new failed:", e);
    } finally {
      setPrincipalCreating(false);
    }
  };

  const onClosePrincipalDraw = async () => {
    const drawId = principalDraw?.id;
    if (!drawId) return;
    const confirmed = window.confirm(
      "Tem certeza que deseja fechar este sorteio? Ap\u00f3s fechar, novas compras ser\u00e3o bloqueadas e o sorteio ficar\u00e1 aguardando resultado."
    );
    if (!confirmed) return;

    try {
      setPrincipalClosing(true);
      await postJSON(`/admin/dashboard/draws/${drawId}/close`, {});
      await loadSummary();
      alert("Sorteio fechado, aguardando resultado.");
    } catch (e) {
      console.error("[AdminDashboard] close principal draw failed:", e);
      alert("N\u00e3o foi poss\u00edvel fechar o sorteio agora.");
    } finally {
      setPrincipalClosing(false);
    }
  };

  // menu
  const [menuEl, setMenuEl] = React.useState(null);
  const open = Boolean(menuEl);
  const openMenu = (e) => setMenuEl(e.currentTarget);
  const closeMenu = () => setMenuEl(null);
  const goPainel = () => { closeMenu(); navigate("/admin"); };
  const doLogout = () => { closeMenu(); logout(); navigate("/"); };

  const isAdditionalMode = drawMode === "adicionais";
  const currentLoading = isAdditionalMode ? additionalLoading : principalLoading;
  const currentDrawId = isAdditionalMode
    ? selectedAdditionalItem?.draw?.id
    : principalDraw?.id;
  const currentSold = isAdditionalMode
    ? selectedAdditionalItem?.stats?.sold ?? 0
    : principalStats.sold;
  const currentRemaining = isAdditionalMode
    ? selectedAdditionalItem?.stats?.remaining ??
      selectedAdditionalItem?.stats?.available ??
      0
    : principalStats.remaining ?? principalStats.available ?? 0;
  const currentCreating = isAdditionalMode ? additionalCreating : principalCreating;
  const currentSaving = isAdditionalMode ? additionalSaving : principalSaving;
  const principalStatus = String(principalDraw?.status || "").toLowerCase();
  const principalRealized = Boolean(principalDraw?.realized_at) || principalStatus === "sorteado";
  const principalClosed = !principalRealized && principalStatus === "closed";
  const showClosePrincipal = !isAdditionalMode && principalDraw?.id && principalStatus === "open";

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

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 } }}>
        <Stack spacing={4} alignItems="center">
          <Typography sx={{ fontWeight: 900, textAlign: "center", lineHeight: 1.1, fontSize: { xs: 28, md: 56 } }}>
            Painel de Controle
            <br /> dos Sorteios
          </Typography>

          {/* Painel (resumo + preço e configs) */}
          <Paper variant="outlined" sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, width: "100%" }}>
            <Box sx={{ mb: 3, borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              <Tabs
                value={isAdditionalMode ? "adicional" : "principal"}
                onChange={(_, value) => setDrawMode(value === "adicional" ? "adicionais" : "principal")}
                textColor="primary"
                indicatorColor="primary"
              >
                <Tab value="principal" label="Principal" sx={{ fontWeight: 900 }} />
                <Tab value="adicional" label="Adicional" sx={{ fontWeight: 900 }} />
              </Tabs>
            </Box>

            {isAdditionalMode && !additionalLoading && additionalDraws.length === 0 && (
              <Alert severity="info" sx={{ mb: 3, bgcolor: "rgba(2,136,209,0.12)" }}>
                Nenhum sorteio adicional cadastrado.
              </Alert>
            )}

            {isAdditionalMode && additionalError && (
              <Alert severity="error" sx={{ mb: 3, bgcolor: "rgba(211,47,47,0.12)" }}>
                {additionalError}
              </Alert>
            )}

            {isAdditionalMode && additionalDraws.length > 0 && (
              <TextField
                select
                label="Sorteio adicional"
                value={selectedAdditionalDrawId}
                onChange={(e) => {
                  const item = additionalDraws.find(
                    (candidate) => String(candidate.draw.id) === e.target.value
                  );
                  selectAdditionalItem(item || null);
                }}
                sx={{ mb: 3, minWidth: 280 }}
              >
                {additionalDraws.map((item) => (
                  <MenuItem key={item.draw.id} value={String(item.draw.id)}>
                    #{item.draw.id} - {item.draw.product_name || item.draw.banner_title || "Sorteio adicional"}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <Stack direction="row" spacing={4} alignItems="center" flexWrap="wrap">
              <Stack>
                <Typography sx={{ opacity: 0.7, fontWeight: 700 }}>Nº Sorteio Atual</Typography>
                <Typography variant="h4" sx={{ fontWeight: 900 }}>
                  {currentLoading ? "…" : currentDrawId ?? "-"}
                </Typography>
              </Stack>

              <Stack>
                <Typography sx={{ opacity: 0.7, fontWeight: 700 }}>Nºs Vendidos</Typography>
                <Typography variant="h4" sx={{ fontWeight: 900 }}>
                  {currentLoading ? "…" : currentSold}
                </Typography>
              </Stack>

              <Stack>
                <Typography sx={{ opacity: 0.7, fontWeight: 700 }}>Nºs Restantes</Typography>
                <Typography variant="h4" sx={{ fontWeight: 900 }}>
                  {currentLoading ? "…" : currentRemaining}
                </Typography>
              </Stack>

              <Box sx={{ flex: 1 }} />
              <Stack direction="row" spacing={1.5} flexWrap="wrap" justifyContent="flex-end">
                {showClosePrincipal && (
                  <Button
                    onClick={onClosePrincipalDraw}
                    disabled={principalClosing}
                    variant="outlined"
                    color="warning"
                    sx={{ borderRadius: 999, px: 3 }}
                  >
                    {principalClosing ? "Fechando..." : "FECHAR SORTEIO"}
                  </Button>
                )}

                <Button
                  onClick={onNewDraw}
                  disabled={currentCreating}
                  variant="outlined"
                  sx={{ borderRadius: 999, px: 3 }}
                >
                  {currentCreating ? "Criando..." : "NOVO SORTEIO"}
                </Button>
              </Stack>
            </Stack>

            {!isAdditionalMode && principalClosed && (
              <Alert severity="info" sx={{ mt: 3, bgcolor: "rgba(2,136,209,0.12)" }}>
                Sorteio fechado, aguardando resultado.
              </Alert>
            )}

            {!isAdditionalMode && principalRealized && (
              <Alert severity="success" sx={{ mt: 3, bgcolor: "rgba(46,125,50,0.14)" }}>
                Sorteio realizado.
              </Alert>
            )}

            <Divider sx={{ my: 3 }} />

            {/* Valor por Ticket (centavos) */}
            <Typography sx={{ opacity: 0.7, fontWeight: 700, mb: 1 }}>Valor por Ticket</Typography>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <TextField
                value={
                  isAdditionalMode
                    ? additionalForm.ticket_price_cents
                    : principalForm.ticket_price_cents
                }
                onChange={(e) => {
                  const ticket_price_cents = e.target.value;
                  if (isAdditionalMode) {
                    setAdditionalForm((form) => ({ ...form, ticket_price_cents }));
                  } else {
                    setPrincipalForm((form) => ({ ...form, ticket_price_cents }));
                  }
                }}
                placeholder="em centavos (ex.: 100 = R$ 1,00)"
                inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                sx={{ maxWidth: 320 }}
              />
            </Stack>

            {/* Máximo de tickets por seleção */}
            <Typography sx={{ opacity: 0.7, fontWeight: 700, mb: 1 }}>
              Máximo de Tickets permitidos
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <TextField
                type="number"
                value={
                  isAdditionalMode
                    ? additionalForm.max_numbers_per_selection
                    : principalForm.max_numbers_per_selection
                }
                onChange={(e) => {
                  const max_numbers_per_selection = e.target.value;
                  if (isAdditionalMode) {
                    setAdditionalForm((form) => ({ ...form, max_numbers_per_selection }));
                  } else {
                    setPrincipalForm((form) => ({ ...form, max_numbers_per_selection }));
                  }
                }}
                placeholder="Ex.: 5"
                inputProps={{ min: 1 }}
                sx={{ maxWidth: 320 }}
              />
            </Stack>

            {/* Frase promocional */}
            <Typography sx={{ opacity: 0.7, fontWeight: 700, mb: 1 }}>
              Frase promocional
            </Typography>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
              <TextField
                value={
                  isAdditionalMode ? additionalForm.banner_title : principalForm.banner_title
                }
                onChange={(e) => {
                  const banner_title = e.target.value;
                  if (isAdditionalMode) {
                    setAdditionalForm((form) => ({ ...form, banner_title }));
                  } else {
                    setPrincipalForm((form) => ({ ...form, banner_title }));
                  }
                }}
                placeholder="Ex.: Sorteio de um Watch Winder…"
                fullWidth
              />
            </Stack>

            <Button
              onClick={onSaveAll}
              disabled={currentSaving || (isAdditionalMode && !selectedAdditionalItem)}
              variant="contained"
              color="primary"
              sx={{ borderRadius: 999, px: 3 }}
            >
              {currentSaving ? "Salvando..." : "ATUALIZAR"}
            </Button>
            {isAdditionalMode && selectedAdditionalItem && (
              <Alert severity="info" sx={{ mt: 3, bgcolor: "rgba(2,136,209,0.12)" }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", sm: "center" }}>
                  <Typography sx={{ flex: 1, fontWeight: 700 }}>
                    Compradores do adicional ficam na aba Sorteio Ativo — Compradores.
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    color="info"
                    onClick={() => navigate("/admin/sorteiosAtivos")}
                    sx={{ fontWeight: 800 }}
                  >
                    Ver compradores na aba Sorteio Ativo — Compradores
                  </Button>
                </Stack>
              </Alert>
            )}
          </Paper>

          {/* As 3 listas */}
          <Stack  spacing={3} sx={{ width: "100%" }}>
             <BigCard color="green"  onClick={() => navigate("/admin/AdminClientesUser")}>
              CADASTRO E MANUTENÇÃO
              <br /> CLIENTES
            </BigCard>

            <br />
            <Divider sx={{ my: 3, borderColor: "rgba(255,255,255,0.18)", borderBottomWidth: 2 }} />
            <br />
            <BigCard color="info.dark" onClick={() => navigate("/admin/sorteiosAtivos")}>
              SORTEIO ATIVO<br /> COMPRADORES
            </BigCard>
            <br />
              <br />
            <BigCard color="info.dark" onClick={() => navigate("/admin/analytics")}>
              DASHBOARD - ANALISE
            </BigCard>
            <br />
            <BigCard color="secondary.main" onClick={() => navigate("/admin/notificacoes")}>
              NOTIFICAÇÕES
            </BigCard>
            <br />
            <BigCard color="primary.main" onClick={() => navigate("/admin/cativos")}>
              CATIVOS
            </BigCard>
            <br />
            <BigCard outlined onClick={() => navigate("/admin/sorteios")}>
              LISTA DE SORTEIOS
              <br /> REALIZADOS
            </BigCard>

            <BigCard color="primary.main" onClick={() => navigate("/admin/clientes")}>
              LISTA DE CLIENTES
              <br /> COM SALDO ATIVO
            </BigCard>

            <BigCard color="success.dark" onClick={() => navigate("/admin/historico-saldo")}>
              HISTÓRICO DE SALDO
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
