// src/AdminDashboard.jsx
import * as React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Container,
  CssBaseline,
  Divider,
  Alert,
  FormControlLabel,
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
  product_name: "",
  product_link: "",
  banner_title: "",
  ticket_price_cents: "",
  max_numbers_per_selection: 25,
  status: "draft",
};

const EMPTY_NEW_ADDITIONAL_FORM = {
  product_name: "",
  ticket_price_cents: "",
  max_numbers_per_selection: 25,
  status: "open",
};

const EMPTY_NEW_PRINCIPAL_FORM = {
  ticket_price_cents: "",
  banner_title: "",
  max_numbers_per_selection: "",
  number_count: 100,
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
  product_name: String(item?.draw?.product_name ?? ""),
  product_link: String(item?.draw?.product_link ?? ""),
  banner_title: String(item?.config?.banner_title ?? item?.draw?.banner_title ?? ""),
  ticket_price_cents: String(
    item?.config?.ticket_price_cents ?? item?.draw?.ticket_price_cents ?? ""
  ),
  max_numbers_per_selection:
    item?.config?.max_numbers_per_selection ??
    item?.draw?.max_numbers_per_selection ??
    25,
  status: String(item?.draw?.status ?? "draft"),
});

const isOpenAdditionalItem = (item) => {
  const type = String(item?.draw?.draw_type || "").toLowerCase();
  const status = String(item?.draw?.status || "").toLowerCase();
  return status === "open" && (type === "adicional" || type === "secundario");
};

const isRealizedAdditionalItem = (item) => item?.draw?.realized_at != null;

const newestAdditionalItem = (items, predicate = () => true) =>
  items.reduce((newest, item) => {
    if (!predicate(item)) return newest;
    if (!newest || Number(item?.draw?.id || 0) > Number(newest?.draw?.id || 0)) {
      return item;
    }
    return newest;
  }, null);

const sortAdditionalItems = (items) =>
  [...items].sort((a, b) => {
    const openDifference = Number(isOpenAdditionalItem(b)) - Number(isOpenAdditionalItem(a));
    if (openDifference) return openDifference;
    return Number(b?.draw?.id || 0) - Number(a?.draw?.id || 0);
  });

const formatAdminDrawDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR");
};

const additionalRequestErrorMessage = (error) => {
  const code = String(error?.message || "");
  if (code === "open_draw_state_inconsistent") {
    return "Não foi possível abrir o sorteio porque o estado dos sorteios principais está inconsistente.";
  }
  if (code === "additional_draw_database_limit") {
    return "A configuração do banco ainda não permite abrir este sorteio adicional.";
  }
  return null;
};

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
  const [newPrincipalFormOpen, setNewPrincipalFormOpen] = React.useState(false);
  const [newPrincipalForm, setNewPrincipalForm] = React.useState(EMPTY_NEW_PRINCIPAL_FORM);
  const [newPrincipalConfirmed, setNewPrincipalConfirmed] = React.useState(false);
  const [newPrincipalError, setNewPrincipalError] = React.useState("");
  const [principalClosing, setPrincipalClosing] = React.useState(false);
  const [drawMode, setDrawMode] = React.useState("principal");
  const [additionalDraws, setAdditionalDraws] = React.useState([]);
  const [selectedAdditionalDrawId, setSelectedAdditionalDrawId] = React.useState("");
  const [selectedAdditionalItem, setSelectedAdditionalItem] = React.useState(null);
  const [additionalForm, setAdditionalForm] = React.useState(EMPTY_ADDITIONAL_FORM);
  const [additionalLoading, setAdditionalLoading] = React.useState(false);
  const [additionalSaving, setAdditionalSaving] = React.useState(false);
  const [additionalCreating, setAdditionalCreating] = React.useState(false);
  const [additionalClosing, setAdditionalClosing] = React.useState(false);
  const [additionalError, setAdditionalError] = React.useState("");
  const [newAdditionalFormOpen, setNewAdditionalFormOpen] = React.useState(false);
  const [newAdditionalForm, setNewAdditionalForm] = React.useState(EMPTY_NEW_ADDITIONAL_FORM);
  const [newAdditionalError, setNewAdditionalError] = React.useState("");
  const selectedAdditionalDrawIdRef = React.useRef("");
  const additionalSavingRef = React.useRef(false);
  const additionalCreatingRef = React.useRef(false);
  const additionalClosingRef = React.useRef(false);
  const principalSavingRef = React.useRef(false);
  const principalCreatingRef = React.useRef(false);
  const visibleAdditionalDraws = React.useMemo(
    () => additionalDraws.filter((item) => !isRealizedAdditionalItem(item)),
    [additionalDraws]
  );

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

  const loadAdditionalDraws = React.useCallback(async (preferredId) => {
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
      const draws = sortAdditionalItems(normalizeAdditionalDraws(payload));
      setAdditionalDraws(draws);
      const visibleDraws = draws.filter((item) => !isRealizedAdditionalItem(item));
      const wantedId = preferredId ?? selectedAdditionalDrawIdRef.current;
      const selected =
        visibleDraws.find((item) => String(item.draw.id) === String(wantedId)) ||
        newestAdditionalItem(visibleDraws, isOpenAdditionalItem) ||
        newestAdditionalItem(visibleDraws) ||
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

  // SALVAR
  const onSaveAll = async () => {
    if (drawMode === "adicionais") {
      if (additionalSavingRef.current) return;
      const drawId = Number(selectedAdditionalDrawId);
      const selectedItem = visibleAdditionalDraws.find(
        (item) => String(item?.draw?.id) === String(selectedAdditionalDrawId)
      );
      if (!Number.isInteger(drawId) || drawId <= 0 || !selectedItem) {
        alert("Nenhum sorteio adicional cadastrado para atualizar.");
        return;
      }
      const requestedStatus = String(additionalForm.status || selectedItem.draw.status || "draft");
      if (
        requestedStatus === "closed" &&
        String(selectedItem.draw.status || "").toLowerCase() !== "closed"
      ) {
        const confirmed = window.confirm(
          `Confirmo o encerramento somente deste sorteio adicional: #${drawId} - ${selectedItem.draw.product_name || additionalForm.banner_title || "Sorteio adicional"}.`
        );
        if (!confirmed) return;
      }
      additionalSavingRef.current = true;
      setAdditionalSaving(true);
      try {
        await postJSON(
          `/admin/additional-draws/${drawId}`,
          {
            product_name: String(additionalForm.product_name || "").trim(),
            product_link: String(additionalForm.product_link || "").trim() || null,
            banner_title: String(additionalForm.banner_title || ""),
            ticket_price_cents: Math.max(
              0,
              Math.floor(Number(additionalForm.ticket_price_cents || 0))
            ),
            max_numbers_per_selection: Math.max(
              1,
              Math.floor(Number(additionalForm.max_numbers_per_selection || 1))
            ),
            status: requestedStatus,
          },
          "PATCH"
        );
        await loadAdditionalDraws(drawId);
        alert("Sorteio adicional atualizado.");
      } catch (e) {
        console.error("[AdminDashboard] PATCH additional draw failed:", e);
        alert(additionalRequestErrorMessage(e) || "Não foi possível atualizar o sorteio adicional.");
      } finally {
        additionalSavingRef.current = false;
        setAdditionalSaving(false);
      }
      return;
    }

    if (principalSavingRef.current) return;

    const drawId = Number(principalDraw?.id);
    if (!Number.isInteger(drawId) || drawId <= 0) {
      alert("Não foi possível identificar o sorteio principal atual.");
      return;
    }

    const ticketPriceCents = Number(principalForm.ticket_price_cents);
    if (!Number.isInteger(ticketPriceCents) || ticketPriceCents <= 0) {
      alert("Informe um valor válido para a cota antes de salvar.");
      return;
    }

    if (typeof principalForm.banner_title !== "string") {
      alert("Informe uma frase promocional válida.");
      return;
    }
    const bannerTitle = principalForm.banner_title.trim();
    if (bannerTitle.length > 255) {
      alert("A frase promocional deve ter no máximo 255 caracteres.");
      return;
    }

    const maxNumbersPerSelection = Number(principalForm.max_numbers_per_selection);
    if (!Number.isInteger(maxNumbersPerSelection) || maxNumbersPerSelection <= 0) {
      alert("Informe um limite de tickets inteiro e maior que zero.");
      return;
    }

    principalSavingRef.current = true;
    setPrincipalSaving(true);
    try {
      const response = await postJSON(
        `/admin/dashboard/draws/${drawId}/config`,
        {
          ticket_price_cents: ticketPriceCents,
          banner_title: bannerTitle,
          max_numbers_per_selection: maxNumbersPerSelection,
        },
        "PATCH"
      );

      const persistedPrice = Number(response?.config?.ticket_price_cents);
      const persistedLimit = Number(response?.config?.max_numbers_per_selection);
      const persistedBanner = response?.config?.banner_title;
      const validResponse =
        response?.ok === true &&
        response?.sync?.global === true &&
        response?.sync?.draw === true &&
        Number.isInteger(persistedPrice) &&
        persistedPrice > 0 &&
        Number.isInteger(persistedLimit) &&
        persistedLimit > 0 &&
        typeof persistedBanner === "string" &&
        persistedBanner.length <= 255;

      if (!validResponse) throw new Error("invalid_draw_config_response");

      setPrincipalForm({
        ticket_price_cents: String(persistedPrice),
        banner_title: persistedBanner,
        max_numbers_per_selection: persistedLimit,
      });

      await loadSummary();
      alert("Configurações atualizadas.");
    } catch (e) {
      console.error("[AdminDashboard] salvar configs falhou:", e);
      const errorCode = String(e?.message || "");
      if (errorCode === "draw_ticket_price_locked") {
        alert(
          "O valor da cota não pode ser alterado após o início das vendas. A frase promocional e o limite podem ser atualizados mantendo o preço atual."
        );
      } else if (errorCode === "principal_draw_required") {
        alert("O sorteio selecionado não é o principal.");
      } else if (errorCode === "draw_config_sync_failed") {
        alert("Não foi possível sincronizar a configuração do sorteio. Nenhuma alteração foi salva.");
      } else if (
        errorCode === "404" ||
        errorCode === "draw_not_found" ||
        errorCode === "principal_draw_not_found"
      ) {
        alert("O sorteio principal não foi encontrado.");
      } else {
        alert("Não foi possível atualizar o sorteio. Nenhuma alteração foi salva.");
      }
    } finally {
      principalSavingRef.current = false;
      setPrincipalSaving(false);
    }
  };

  const openNewPrincipalForm = () => {
    setNewPrincipalForm({ ...EMPTY_NEW_PRINCIPAL_FORM });
    setNewPrincipalConfirmed(false);
    setNewPrincipalError("");
    setNewPrincipalFormOpen(true);
  };

  const closeNewPrincipalForm = () => {
    if (principalCreatingRef.current) return;
    setNewPrincipalForm({ ...EMPTY_NEW_PRINCIPAL_FORM });
    setNewPrincipalConfirmed(false);
    setNewPrincipalError("");
    setNewPrincipalFormOpen(false);
  };

  const openNewAdditionalForm = () => {
    setNewAdditionalForm({ ...EMPTY_NEW_ADDITIONAL_FORM });
    setNewAdditionalError("");
    setNewAdditionalFormOpen(true);
  };

  const closeNewAdditionalForm = () => {
    if (additionalCreatingRef.current) return;
    setNewAdditionalForm({ ...EMPTY_NEW_ADDITIONAL_FORM });
    setNewAdditionalError("");
    setNewAdditionalFormOpen(false);
  };

  const onCreateAdditionalDraw = async () => {
    if (additionalCreatingRef.current) return;

    const productName = String(newAdditionalForm.product_name || "").trim();
    const bannerTitle = productName;
    const ticketPriceCents = Number(newAdditionalForm.ticket_price_cents);
    const maxNumbersPerSelection = Number(newAdditionalForm.max_numbers_per_selection);
    const numberCount = 100;
    const status = String(newAdditionalForm.status || "open").trim();

    if (!productName) {
      setNewAdditionalError("Informe o nome do novo sorteio adicional.");
      return;
    }
    if (!Number.isInteger(ticketPriceCents) || ticketPriceCents <= 0) {
      setNewAdditionalError("Informe um valor válido para a cota.");
      return;
    }
    if (!Number.isInteger(maxNumbersPerSelection) || maxNumbersPerSelection <= 0) {
      setNewAdditionalError("Informe um limite válido de números por seleção.");
      return;
    }
    if (!Number.isInteger(numberCount) || numberCount !== 100) {
      setNewAdditionalError("Informe uma quantidade de números válida.");
      return;
    }
    if (!["draft", "open", "closed", "cancelled"].includes(status)) {
      setNewAdditionalError("Informe um status válido para o novo sorteio.");
      return;
    }

    additionalCreatingRef.current = true;
    setAdditionalCreating(true);
    setNewAdditionalError("");
    try {
      const created = await postJSON("/admin/additional-draws", {
        draw_type: "adicional",
        product_name: productName,
        banner_title: bannerTitle,
        ticket_price_cents: ticketPriceCents,
        max_numbers_per_selection: maxNumbersPerSelection,
        number_count: numberCount,
        status,
      });
      const createdId = Number(
        created?.draw?.id ??
        created?.data?.draw?.id ??
        created?.id ??
        created?.draw_id
      );
      if (!Number.isInteger(createdId) || createdId <= 0) {
        throw new Error("invalid_additional_draw_response");
      }
      await loadAdditionalDraws(createdId);
      setNewAdditionalForm({ ...EMPTY_NEW_ADDITIONAL_FORM });
      setNewAdditionalFormOpen(false);
    } catch (e) {
      console.error("[AdminDashboard] POST additional draw failed:", e);
      setNewAdditionalError(
        additionalRequestErrorMessage(e) || "Não foi possível criar o sorteio adicional."
      );
    } finally {
      additionalCreatingRef.current = false;
      setAdditionalCreating(false);
    }
  };

  const onNewDraw = async () => {
    if (principalCreatingRef.current) return;

    const ticketPriceCents = Number(newPrincipalForm.ticket_price_cents);
    if (!Number.isInteger(ticketPriceCents) || ticketPriceCents <= 0) {
      setNewPrincipalError("Informe um valor válido para a cota.");
      return;
    }

    const bannerTitle =
      typeof newPrincipalForm.banner_title === "string"
        ? newPrincipalForm.banner_title.trim()
        : "";
    if (!bannerTitle || bannerTitle.length > 255) {
      setNewPrincipalError("Informe a frase promocional do novo sorteio.");
      return;
    }

    const maxNumbersPerSelection = Number(newPrincipalForm.max_numbers_per_selection);
    if (!Number.isInteger(maxNumbersPerSelection) || maxNumbersPerSelection <= 0) {
      setNewPrincipalError("Informe um limite válido de números por seleção.");
      return;
    }

    const numberCount = Number(newPrincipalForm.number_count);
    if (!Number.isInteger(numberCount) || numberCount !== 100) {
      setNewPrincipalError("Preencha o valor, a frase promocional, o limite e a quantidade de números.");
      return;
    }

    if (!newPrincipalConfirmed) {
      setNewPrincipalError("Confirme a criação do novo sorteio principal.");
      return;
    }

    principalCreatingRef.current = true;
    setNewPrincipalError("");
    try {
      setPrincipalCreating(true);
      const response = await postJSON("/admin/dashboard/new", {
        ticket_price_cents: ticketPriceCents,
        banner_title: bannerTitle,
        max_numbers_per_selection: maxNumbersPerSelection,
        number_count: numberCount,
      });

      const createdDrawId = Number(response?.draw?.id ?? response?.draw_id);
      if (
        response?.ok !== true ||
        response?.sync?.global !== true ||
        response?.sync?.draw !== true ||
        !Number.isInteger(createdDrawId) ||
        createdDrawId <= 0
      ) {
        throw new Error("invalid_new_principal_response");
      }

      setNewPrincipalForm({ ...EMPTY_NEW_PRINCIPAL_FORM });
      setNewPrincipalConfirmed(false);
      setNewPrincipalFormOpen(false);
      await loadSummary();
      // Notifica o frontend para refetch imediato de config/numbers (reservados) sem esperar polling
      try {
        window.dispatchEvent(new CustomEvent("ns:draw:changed"));
        window.dispatchEvent(new CustomEvent("ns:numbers:reload"));
      } catch {}
    } catch (e) {
      console.error("[AdminDashboard] POST /new failed:", e);
      const errorCode = String(e?.message || "");
      if (errorCode === "principal_draw_already_open") {
        setNewPrincipalError(
          "Já existe um sorteio principal em andamento. Nenhum sorteio foi criado e o atual não foi alterado."
        );
      } else if (errorCode === "principal_draw_config_required") {
        setNewPrincipalError(
          "Preencha o valor, a frase promocional, o limite e a quantidade de números."
        );
      } else if (errorCode === "draw_config_sync_failed") {
        setNewPrincipalError(
          "Não foi possível salvar a configuração do novo sorteio. Nenhum sorteio foi criado."
        );
      } else {
        setNewPrincipalError(
          "Não foi possível criar o novo sorteio. Nenhuma alteração foi realizada."
        );
      }
    } finally {
      principalCreatingRef.current = false;
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

  const onCloseAdditionalDraw = async () => {
    if (additionalClosingRef.current) return;
    const drawId = Number(selectedAdditionalDrawId);
    const selectedItem = visibleAdditionalDraws.find(
      (item) => String(item?.draw?.id) === String(selectedAdditionalDrawId)
    );
    if (!Number.isInteger(drawId) || drawId <= 0 || !selectedItem) return;

    const name =
      selectedItem.draw.product_name ||
      selectedItem.config?.banner_title ||
      "Sorteio adicional";
    const confirmed = window.confirm(
      `Confirmo o encerramento somente deste sorteio adicional: #${drawId} - ${name}.`
    );
    if (!confirmed) return;

    additionalClosingRef.current = true;
    setAdditionalClosing(true);
    try {
      await postJSON(`/admin/additional-draws/${drawId}`, { status: "closed" }, "PATCH");
      await loadAdditionalDraws(drawId);
      alert("Sorteio adicional encerrado.");
    } catch (e) {
      console.error("[AdminDashboard] close additional draw failed:", e);
      alert(additionalRequestErrorMessage(e) || "Não foi possível encerrar o sorteio adicional.");
    } finally {
      additionalClosingRef.current = false;
      setAdditionalClosing(false);
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
  const openAdditionalCount = visibleAdditionalDraws.filter(isOpenAdditionalItem).length;
  const selectedAdditionalStatus = String(selectedAdditionalItem?.draw?.status || "").toLowerCase();
  const selectedAdditionalIsOpen = selectedAdditionalStatus === "open";
  const principalStatus = String(principalDraw?.status || "").toLowerCase();
  const principalRealized = Boolean(principalDraw?.realized_at) || principalStatus === "sorteado";
  const principalClosed = !principalRealized && principalStatus === "closed";
  const showClosePrincipal = !isAdditionalMode && principalDraw?.id && principalStatus === "open";
  const newPrincipalPrice = Number(newPrincipalForm.ticket_price_cents);
  const newPrincipalBanner = String(newPrincipalForm.banner_title || "").trim();
  const newPrincipalLimit = Number(newPrincipalForm.max_numbers_per_selection);
  const newPrincipalNumberCount = Number(newPrincipalForm.number_count);
  const newPrincipalFormValid =
    Number.isInteger(newPrincipalPrice) &&
    newPrincipalPrice > 0 &&
    newPrincipalBanner.length > 0 &&
    newPrincipalBanner.length <= 255 &&
    Number.isInteger(newPrincipalLimit) &&
    newPrincipalLimit > 0 &&
    newPrincipalNumberCount === 100;
  const newAdditionalFormValid =
    String(newAdditionalForm.product_name || "").trim().length > 0 &&
    Number.isInteger(Number(newAdditionalForm.ticket_price_cents)) &&
    Number(newAdditionalForm.ticket_price_cents) > 0 &&
    Number.isInteger(Number(newAdditionalForm.max_numbers_per_selection)) &&
    Number(newAdditionalForm.max_numbers_per_selection) > 0 &&
    ["draft", "open", "closed", "cancelled"].includes(String(newAdditionalForm.status));

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

            {isAdditionalMode && !additionalLoading && visibleAdditionalDraws.length === 0 && (
              <Alert severity="info" sx={{ mb: 3, bgcolor: "rgba(2,136,209,0.12)" }}>
                Nenhum sorteio adicional cadastrado.
              </Alert>
            )}

            {isAdditionalMode && additionalError && (
              <Alert severity="error" sx={{ mb: 3, bgcolor: "rgba(211,47,47,0.12)" }}>
                {additionalError}
              </Alert>
            )}

            {isAdditionalMode && (
              <Typography sx={{ mb: 2, fontWeight: 800 }}>
                Sorteios adicionais em andamento: {openAdditionalCount}
              </Typography>
            )}

            {isAdditionalMode && visibleAdditionalDraws.length > 0 && (
              <Stack spacing={1.5} sx={{ mb: 3 }}>
                {visibleAdditionalDraws.map((item) => {
                  const draw = item.draw;
                  const selected = String(draw.id) === String(selectedAdditionalDrawId);
                  const status = String(draw.status || "").toLowerCase();
                  const statusLabel =
                    status === "open" ? "Em andamento" : status === "closed" ? "Encerrado" : status;
                  const ticketPriceCents = Number(
                    item.config?.ticket_price_cents ?? draw.ticket_price_cents ?? 0
                  );
                  const sold = Number(item.stats?.sold_count ?? item.stats?.sold ?? 0);
                  const total = Number(item.stats?.total_numbers ?? item.stats?.total ?? 0);

                  return (
                    <ButtonBase
                      key={draw.id}
                      onClick={() => selectAdditionalItem(item)}
                      sx={{ width: "100%", borderRadius: 2, textAlign: "left" }}
                    >
                      <Paper
                        variant="outlined"
                        sx={{
                          width: "100%",
                          p: 2,
                          borderColor: selected ? "primary.main" : "rgba(255,255,255,0.12)",
                          bgcolor: selected ? "rgba(46,125,50,0.12)" : "background.paper",
                        }}
                      >
                        <Stack spacing={1}>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                            <Typography sx={{ fontWeight: 900 }}>
                              #{draw.id} — {item.config?.banner_title || draw.product_name || "Sorteio adicional"}
                            </Typography>
                            <Typography
                              sx={{
                                fontWeight: 900,
                                color: status === "open" ? "success.main" : "text.secondary",
                              }}
                            >
                              {statusLabel || "-"}
                            </Typography>
                          </Stack>
                          <Box
                            sx={{
                              display: "grid",
                              gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
                              gap: 0.75,
                            }}
                          >
                            <Typography variant="body2">Tipo: {draw.draw_type || "adicional"}</Typography>
                            <Typography variant="body2">
                              Cota: {Number.isFinite(ticketPriceCents) ? `R$ ${(ticketPriceCents / 100).toFixed(2).replace(".", ",")}` : "-"}
                            </Typography>
                            <Typography variant="body2">Vendidos: {sold} de {total}</Typography>
                            <Typography variant="body2">Abertura: {formatAdminDrawDate(draw.opened_at)}</Typography>
                            <Typography variant="body2">Fechamento: {formatAdminDrawDate(draw.closed_at)}</Typography>
                          </Box>
                        </Stack>
                      </Paper>
                    </ButtonBase>
                  );
                })}
              </Stack>
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

                {isAdditionalMode && selectedAdditionalIsOpen && (
                  <Button
                    onClick={onCloseAdditionalDraw}
                    disabled={additionalClosing}
                    variant="outlined"
                    color="warning"
                    sx={{ borderRadius: 999, px: 3 }}
                  >
                    {additionalClosing ? "Encerrando..." : "ENCERRAR"}
                  </Button>
                )}

                <Button
                  onClick={isAdditionalMode ? openNewAdditionalForm : openNewPrincipalForm}
                  disabled={
                    currentCreating ||
                    (isAdditionalMode
                      ? newAdditionalFormOpen
                      : newPrincipalFormOpen)
                  }
                  variant="outlined"
                  sx={{ borderRadius: 999, px: 3 }}
                >
                  {currentCreating ? "Criando..." : isAdditionalMode ? "NOVO ADICIONAL" : "NOVO SORTEIO"}
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

            {isAdditionalMode && newAdditionalFormOpen && (
              <Paper variant="outlined" sx={{ mt: 3, p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                <Stack spacing={2.5}>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Novo sorteio adicional
                  </Typography>

                  {newAdditionalError && (
                    <Alert severity="error" sx={{ bgcolor: "rgba(211,47,47,0.12)" }}>
                      {newAdditionalError}
                    </Alert>
                  )}

                  <TextField
                    label="Nome"
                    value={newAdditionalForm.product_name}
                    onChange={(event) => {
                      setNewAdditionalError("");
                      setNewAdditionalForm((form) => ({ ...form, product_name: event.target.value }));
                    }}
                    required
                    inputProps={{ maxLength: 255 }}
                  />
                  <TextField
                    label="Valor da cota em centavos"
                    value={newAdditionalForm.ticket_price_cents}
                    onChange={(event) => {
                      setNewAdditionalError("");
                      setNewAdditionalForm((form) => ({ ...form, ticket_price_cents: event.target.value }));
                    }}
                    required
                    inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                  />
                  <TextField
                    label="Limite de números por seleção"
                    type="number"
                    value={newAdditionalForm.max_numbers_per_selection}
                    onChange={(event) => {
                      setNewAdditionalError("");
                      setNewAdditionalForm((form) => ({
                        ...form,
                        max_numbers_per_selection: event.target.value,
                      }));
                    }}
                    required
                    inputProps={{ min: 1, step: 1 }}
                  />
                  <TextField
                    select
                    label="Status"
                    value={newAdditionalForm.status}
                    onChange={(event) => {
                      setNewAdditionalError("");
                      setNewAdditionalForm((form) => ({ ...form, status: event.target.value }));
                    }}
                  >
                    <MenuItem value="draft">Rascunho</MenuItem>
                    <MenuItem value="open">Em andamento</MenuItem>
                    <MenuItem value="closed">Encerrado</MenuItem>
                    <MenuItem value="cancelled">Cancelado</MenuItem>
                  </TextField>

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <Button
                      onClick={onCreateAdditionalDraw}
                      disabled={
                        !newAdditionalFormValid ||
                        additionalCreating
                      }
                      variant="contained"
                      sx={{ borderRadius: 999, px: 3 }}
                    >
                      {additionalCreating ? "Criando..." : "CRIAR ADICIONAL"}
                    </Button>
                    <Button
                      onClick={closeNewAdditionalForm}
                      disabled={additionalCreating}
                      variant="text"
                    >
                      CANCELAR
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            )}

            {!isAdditionalMode && newPrincipalFormOpen && (
              <Paper variant="outlined" sx={{ mt: 3, p: { xs: 2, md: 3 }, borderRadius: 3 }}>
                <Stack spacing={2.5}>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Novo sorteio principal
                  </Typography>

                  {newPrincipalError && (
                    <Alert severity="error" sx={{ bgcolor: "rgba(211,47,47,0.12)" }}>
                      {newPrincipalError}
                    </Alert>
                  )}

                  <TextField
                    label="Valor da cota em centavos"
                    value={newPrincipalForm.ticket_price_cents}
                    onChange={(event) => {
                      setNewPrincipalError("");
                      setNewPrincipalForm((form) => ({
                        ...form,
                        ticket_price_cents: event.target.value,
                      }));
                    }}
                    required
                    inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                    helperText="Ex.: 5500 para R$ 55,00"
                  />

                  <TextField
                    label="Frase promocional do novo sorteio"
                    value={newPrincipalForm.banner_title}
                    onChange={(event) => {
                      setNewPrincipalError("");
                      setNewPrincipalForm((form) => ({
                        ...form,
                        banner_title: event.target.value,
                      }));
                    }}
                    required
                    inputProps={{ maxLength: 255 }}
                  />

                  <TextField
                    label="Limite de números por seleção"
                    type="number"
                    value={newPrincipalForm.max_numbers_per_selection}
                    onChange={(event) => {
                      setNewPrincipalError("");
                      setNewPrincipalForm((form) => ({
                        ...form,
                        max_numbers_per_selection: event.target.value,
                      }));
                    }}
                    required
                    inputProps={{ min: 1, step: 1 }}
                  />

                  <TextField
                    label="Quantidade de números"
                    type="number"
                    value={newPrincipalForm.number_count}
                    disabled
                    helperText="Padrão NewStore: números de 00 a 99"
                  />

                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={newPrincipalConfirmed}
                        onChange={(event) => {
                          setNewPrincipalError("");
                          setNewPrincipalConfirmed(event.target.checked);
                        }}
                      />
                    }
                    label="Confirmo a criação deste novo sorteio principal com os dados informados."
                  />

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <Button
                      onClick={onNewDraw}
                      disabled={
                        !newPrincipalFormValid ||
                        !newPrincipalConfirmed ||
                        principalCreating
                      }
                      variant="contained"
                      sx={{ borderRadius: 999, px: 3 }}
                    >
                      {principalCreating ? "Criando..." : "CRIAR NOVO SORTEIO"}
                    </Button>
                    <Button
                      onClick={closeNewPrincipalForm}
                      disabled={principalCreating}
                      variant="text"
                    >
                      CANCELAR
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            )}

            {isAdditionalMode && selectedAdditionalItem && (
              <Stack spacing={2} sx={{ mt: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>
                  Editando adicional #{selectedAdditionalDrawId}
                </Typography>
                <TextField
                  label="Nome"
                  value={additionalForm.product_name}
                  onChange={(event) =>
                    setAdditionalForm((form) => ({ ...form, product_name: event.target.value }))
                  }
                  inputProps={{ maxLength: 255 }}
                />
                <TextField
                  label="Link"
                  value={additionalForm.product_link}
                  onChange={(event) =>
                    setAdditionalForm((form) => ({ ...form, product_link: event.target.value }))
                  }
                  inputProps={{ maxLength: 1024 }}
                />
                <TextField
                  select
                  label="Status"
                  value={additionalForm.status}
                  onChange={(event) =>
                    setAdditionalForm((form) => ({ ...form, status: event.target.value }))
                  }
                >
                  <MenuItem value="draft">Rascunho</MenuItem>
                  <MenuItem value="open">Em andamento</MenuItem>
                  <MenuItem value="closed">Encerrado</MenuItem>
                  <MenuItem value="cancelled">Cancelado</MenuItem>
                </TextField>
              </Stack>
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
