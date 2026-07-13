// src/NewStorePage.jsx
// Tamanho aproximado: ~1060 linhas (mantido o conteúdo original + iniciais + fix de número no mobile)

import * as React from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import logoNewStore from "./Logo-branca-sem-fundo-768x132.png";
import { SelectionContext } from "./selectionContext";
import PixModal from "./PixModal";
import { createPixPayment, checkPixStatus } from "./services/pix";
import { useAuth } from "./authContext";

import {
   List, ListItem, ListItemText,
  Alert, Accordion, AccordionSummary, AccordionDetails
} from "@mui/material";
import PixIcon from "@mui/icons-material/Pix";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import GiftCardSimulator from "./components/GiftCardSimulator.jsx";

import {
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Paper,
  Stack,
  ThemeProvider,
  Toolbar,
  Typography,
  LinearProgress,
  createTheme,
} from "@mui/material";
import AccountCircleRoundedIcon from "@mui/icons-material/AccountCircleRounded";

// Imagens locais
import imgCardExemplo from "./cartaoilustrativoTexto-do-seu-paragrafo-6-1024x1024.png";

import imgAcumulo1 from "./1-2-1-1024x512.png";  
import imgAcumulo2 from "./2-1-1-1024x512.png";

// Tema
const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#67C23A" },
    secondary: { main: "#FFC107" },
    error: { main: "#D32F2F" },
    background: { default: "#0E0E0E", paper: "#121212" },
    success: { main: "#59b15f" },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(","),
  },
});

// Helpers
const pad2 = (n) => n.toString().padStart(2, "0");

const normalizeStatusToken = (status) =>
  String(status || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isPrincipalUnavailableStatus = (status) =>
  ["taken", "sold", "unavailable", "indisponivel", "blocked", "closed"].includes(
    normalizeStatusToken(status)
  );

const getInitialsFromName = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

const getNumberOwnerInitials = (item) => {
  const rawInitials =
    item?.initials ||
    item?.buyer_initials ||
    item?.buyerInitials ||
    item?.owner_initials ||
    item?.ownerInitials ||
    item?.oi;

  if (rawInitials) {
    return String(rawInitials).slice(0, 3).toUpperCase();
  }

  const rawName =
    item?.buyer_name ||
    item?.user_name ||
    item?.customer_name ||
    item?.comprador ||
    item?.reserved_by ||
    item?.owner_name ||
    item?.user?.name ||
    item?.customer?.name ||
    (typeof item?.owner === "string" ? item.owner : item?.owner?.name) ||
    item?.name;

  return getInitialsFromName(rawName).slice(0, 3);
};

const getPrincipalSoldInitials = getNumberOwnerInitials;

// Mocks
const MOCK_RESERVADOS = [];
const MOCK_INDISPONIVEIS = [];

// Base do backend
const API_BASE = (
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_BASE ||
  "https://newstore-backend.onrender.com"
).replace(/\/+$/, "");

// ===== Helpers de auth + reserva =====
function sanitizeToken(t) {
  if (!t) return "";
  let s = String(t).trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  )
    s = s.slice(1, -1);
  if (/^Bearer\s+/i.test(s)) s = s.replace(/^Bearer\s+/i, "").trim();
  if (!s || /^(null|undefined)$/i.test(s)) return "";
  return s.replace(/\s+/g, "");
}
function getAuthToken() {
  try {
    const keys = ["ns_auth_token", "authToken", "token", "jwt", "access_token"];
    for (const k of keys) {
      const raw = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (raw) return sanitizeToken(raw);
    }
    return "";
  } catch {
    return "";
  }
}
async function reserveNumbers(numbers) {
  const token = getAuthToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const r = await fetch(`${API_BASE}/api/reservations`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ numbers }),
  });

  if (r.status === 409) {
    const j = await r.json().catch(() => ({}));
    const c = j?.conflicts || j?.n || [];
    throw new Error(
      `Alguns números ficaram indisponíveis: ${
        Array.isArray(c) ? c.join(", ") : c
      }`
    );
  }
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.error || "Falha ao reservar");
  }
  return r.json(); // { reservationId, drawId, expiresAt, numbers }
}

// Checagem do limite no backend: só chama quando há token.
async function checkUserPurchaseLimit({ addCount = 0, drawId } = {}) {
  const token = getAuthToken();
  if (!token) {
    return { blocked: false, current: null, max: null, unauthenticated: true };
  }

  const qs = new URLSearchParams();
  qs.set("add", String(addCount));
  if (drawId != null) qs.set("draw_id", String(drawId));

  let res = await fetch(`${API_BASE}/api/purchase-limit/check?${qs}`, {
    credentials: "include",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) throw new Error("unauthorized");
  if (!res.ok) throw new Error(`limit_check_${res.status}`);

  const j = await res.json().catch(() => ({}));
  const blocked = !!(
    j?.blocked ??
    j?.limitReached ??
    j?.reached ??
    j?.exceeded
  );
  const current = j?.current ?? j?.cnt ?? j?.count ?? null;
  const max = j?.max ?? j?.limit ?? j?.MAX ?? null;
  return { blocked, current, max };
}

const normalizeSecondaryStatus = (status) => {
  const st = String(status || "").toLowerCase();
  if (st === "available") return "available";
  if (st === "reserved") return "reserved";
  if (st === "sold" || st === "taken") return "sold";
  if (st === "blocked") return "blocked";
  return "blocked";
};

const getSecondaryDrawFromPayload = (payload) => {
  const draw =
    payload?.draw ||
    payload?.secondary_draw ||
    payload?.secondaryDraw ||
    payload?.data?.draw ||
    payload?.data?.secondary_draw ||
    payload?.data?.secondaryDraw ||
    payload?.current ||
    (payload?.data && !Array.isArray(payload.data) ? payload.data : null) ||
    payload;
  if (!draw || typeof draw !== "object") return null;

  const id =
    draw.id ??
    draw.secondary_draw_id ??
    draw.secondaryDrawId ??
    draw.draw_id ??
    draw.drawId;
  if (id == null) return null;
  return { ...draw, id };
};

const getSecondaryNumbersFromPayload = (payload) => {
  const raw = Array.isArray(payload)
    ? payload
    : payload?.numbers ||
      payload?.items ||
      payload?.draw?.numbers ||
      (Array.isArray(payload?.data) ? payload.data : null) ||
      payload?.data?.numbers ||
      payload?.data?.items ||
      payload?.data?.draw?.numbers ||
      payload?.result?.numbers ||
      [];

  return raw
    .map((item) => {
      const n =
        typeof item === "number" || typeof item === "string"
          ? Number(item)
          : Number(item?.n ?? item?.number ?? item?.num ?? item?.value);
      if (!Number.isInteger(n) || n < 0 || n > 99) return null;
      return {
        ...item,
        n,
        status: normalizeSecondaryStatus(item?.status),
        owner_initials: getNumberOwnerInitials(item) || null,
      };
    })
    .filter(Boolean);
};

const formatSecondaryMoney = (cents) => {
  const value = Number(cents);
  if (!Number.isFinite(value) || value <= 0) return "-";
  return (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const getSecondaryReservationId = (reservation) =>
  reservation?.reservation_id ?? reservation?.reservationId ?? reservation?.id;

const ADDITIONAL_LOGIN_REQUIRED_MESSAGE =
  "Faça login ou crie sua conta para reservar números no sorteio adicional.";

function getAdditionalReserveErrorMessage(error) {
  const code = String(error || "");
  if (code === "numbers_reserved") return "Esse numero ja esta reservado temporariamente.";
  if (code === "numbers_unavailable") return "Esse numero nao esta mais disponivel.";
  if (code === "draw_not_open") return "Esse sorteio adicional nao esta mais disponivel.";
  if (code && !/^[a-z0-9_:-]+$/i.test(code)) return code;
  const messages = {
    unauthorized: ADDITIONAL_LOGIN_REQUIRED_MESSAGE,
    numbers_unavailable: "Alguns números ficaram indisponíveis. Atualize a seleção.",
    reservation_expired: "Reserva expirada. Selecione os números novamente.",
    purchase_limit_exceeded: "Limite de compra excedido para este sorteio.",
    additional_config_not_found: "Configuração do sorteio adicional indisponível.",
    draw_not_open: "Este sorteio adicional não está aberto.",
    draw_not_found: "Sorteio adicional não encontrado.",
  };
  return messages[code] || "Falha ao reservar números do adicional.";
}
function getRequestAuthToken(contextToken) {
  return getAuthToken() || sanitizeToken(contextToken);
}

const getSecondaryPixErrorMessage = (error) => {
  const code = String(error || "");
  const messages = {
    mp_token_missing: "Token Mercado Pago ausente no backend local.",
    reservation_expired: "Reserva expirada. Selecione os números novamente.",
    reservation_not_active: "Reserva não está ativa.",
    mercado_pago_payment_failed: "Falha ao criar pagamento Mercado Pago.",
    secondary_payment_create_failed: "Falha ao criar pagamento do sorteio secundário.",
  };
  return messages[code] || "Falha ao gerar PIX do secundário.";
};

const ADDITIONAL_PIX_PENDING_MESSAGE = "Aguardando confirmação do pagamento...";
const ADDITIONAL_PIX_SUCCESS_MESSAGE = "Pagamento confirmado com sucesso!";
const ADDITIONAL_PIX_FAILED_MESSAGE = "Não foi possível confirmar o pagamento. Tente novamente ou entre em contato com o suporte.";
const ADDITIONAL_PIX_PAID_STATUSES = new Set(["approved", "paid", "pago"]);
const ADDITIONAL_PIX_FINAL_ERROR_STATUSES = new Set(["failed", "rejected", "cancelled", "canceled", "expired"]);

const normalizeAdditionalPixPayment = (payload) => {
  const source =
    payload?.payment ||
    payload?.data?.payment ||
    payload?.data ||
    payload ||
    {};
  const rawQrCodeBase64 = String(
    source?.qr_code_base64 ||
      source?.qrCodeBase64 ||
      source?.pix_qr_code_base64 ||
      ""
  );

  return {
    ...payload,
    ...source,
    paymentId: source?.paymentId ?? source?.payment_id ?? source?.id ?? null,
    payment_id: source?.payment_id ?? source?.paymentId ?? source?.id ?? null,
    reservation_id:
      source?.reservation_id ?? source?.reservationId ?? payload?.reservation_id ?? null,
    amount_cents:
      source?.amount_cents ?? source?.amountCents ?? payload?.amount_cents ?? null,
    copy_paste_code:
      source?.copy_paste_code ||
      source?.copyPaste ||
      source?.pix_copy_paste ||
      source?.qr_code ||
      "",
    qr_code_base64: rawQrCodeBase64.replace(
      /^data:image\/[a-z0-9.+-]+;base64,/i,
      ""
    ),
  };
};

export default function NewStorePage({
  reservados = MOCK_RESERVADOS,
  indisponiveis = MOCK_INDISPONIVEIS,
  groupUrl = "https://chat.whatsapp.com/GdosYmyW2Jj1mDXNDTFt6F",
}) {
  const navigate = useNavigate();
  const { selecionados, setSelecionados, limparSelecao } =
    React.useContext(SelectionContext);
  const { user, token, logout } = useAuth();
  const isAuthenticated = !!(user?.email || user?.id || token);
  const logoTo = isAuthenticated ? "/conta" : "/";

  // Estados vindos do backend
  const [srvReservados, setSrvReservados] = React.useState([]);
  const [srvIndisponiveis, setSrvIndisponiveis] = React.useState([]);

  // Iniciais dos vendidos (n -> "AB")
  const [soldInitials, setSoldInitials] = React.useState({});

  // Preço dinâmico
  const FALLBACK_PRICE = Number(process.env.REACT_APP_PIX_PRICE) || 55;
  const [unitPrice, setUnitPrice] = React.useState(FALLBACK_PRICE);

  // Config dinâmicas
  const [bannerTitle, setBannerTitle] = React.useState("");
  const [maxSelect, setMaxSelect] = React.useState(5);

  // Draw atual (se o backend expuser)
  const [currentDrawId, setCurrentDrawId] = React.useState(null);
  const [principalOpen, setPrincipalOpen] = React.useState(null);

  const [secondaryDraw, setSecondaryDraw] = React.useState(null);
  const [secondaryNumbers, setSecondaryNumbers] = React.useState([]);
  const [selectedSecondaryNumbers, setSelectedSecondaryNumbers] = React.useState([]);
  const [secondaryReservation, setSecondaryReservation] = React.useState(null);
  const [secondaryPayment, setSecondaryPayment] = React.useState(null);
  const [secondaryLoading, setSecondaryLoading] = React.useState(false);
  const [secondaryNumbersLoading, setSecondaryNumbersLoading] = React.useState(false);
  const [secondaryReserveLoading, setSecondaryReserveLoading] = React.useState(false);
  const [secondaryPixLoading, setSecondaryPixLoading] = React.useState(false);
  const [secondaryPixOpen, setSecondaryPixOpen] = React.useState(false);
  const [secondaryError, setSecondaryError] = React.useState("");
  const [secondaryNotice, setSecondaryNotice] = React.useState("");
  const secondaryPreviewNumbers = React.useMemo(
    () => Array.from({ length: 100 }, (_, idx) => idx),
    []
  );
  const [additionalDraws, setAdditionalDraws] = React.useState([]);
  const [additionalNumbersByDrawId, setAdditionalNumbersByDrawId] = React.useState({});
  const [selectedAdditionalNumbersByDrawId, setSelectedAdditionalNumbersByDrawId] = React.useState({});
  const [additionalReservationsByDrawId, setAdditionalReservationsByDrawId] = React.useState({});
  const [additionalPaymentByDrawId, setAdditionalPaymentByDrawId] = React.useState({});
  const [additionalLoading, setAdditionalLoading] = React.useState(false);
  const [additionalLoadingByDrawId, setAdditionalLoadingByDrawId] = React.useState({});
  const [additionalNumbersLoadingByDrawId, setAdditionalNumbersLoadingByDrawId] = React.useState({});
  const [additionalReserveLoadingByDrawId, setAdditionalReserveLoadingByDrawId] = React.useState({});
  const [additionalPixLoadingByDrawId, setAdditionalPixLoadingByDrawId] = React.useState({});
  const [additionalPixStatusByDrawId, setAdditionalPixStatusByDrawId] = React.useState({});
  const [additionalPixMessageByDrawId, setAdditionalPixMessageByDrawId] = React.useState({});
  const [additionalErrorByDrawId, setAdditionalErrorByDrawId] = React.useState({});
  const [additionalNoticeByDrawId, setAdditionalNoticeByDrawId] = React.useState({});
  const [additionalPixOpenDrawId, setAdditionalPixOpenDrawId] = React.useState(null);

  // Limite acumulado do usuário
  const [limitUsage, setLimitUsage] = React.useState({
    current: null,
    max: null,
  });

  // ===== Carregar preço, textos e (se houver) draw id — sem 404 no console
  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/config`, {
          credentials: "include",
          cache: "no-store",
        });
        if (res.ok) {
          const j = await res.json().catch(() => ({}));

          // preço
          const cents =
            j?.ticket_price_cents ??
            j?.price_cents ??
            j?.current?.price_cents ??
            j?.current_draw?.price_cents;
          const reais =
            cents != null && Number.isFinite(Number(cents))
              ? Number(cents) / 100
              : Number(j?.ticket_price ?? j?.price);
          if (alive && Number.isFinite(reais) && reais > 0) setUnitPrice(reais);

          // draw id (se enviado)
          const did =
            j?.current_draw_id ??
            j?.draw_id ??
            j?.current?.id ??
            j?.current_draw?.id;
          if (alive && did != null) setCurrentDrawId(did);

          // banner dinâmico
          if (alive && typeof j?.banner_title === "string") {
            setBannerTitle(j.banner_title);
          }

          // teto de seleção dinâmico
          const maxSel =
            j?.max_numbers_per_selection ?? j?.max_select ?? j?.selection_limit;
          if (alive && Number.isFinite(Number(maxSel)) && Number(maxSel) > 0) {
            setMaxSelect(Number(maxSel));
          }
        }
      } catch {
        // fallback silencioso
      } finally {
        // também tentamos carregar o uso do limite (add=0)
        try {
          const info = await checkUserPurchaseLimit({
            addCount: 0,
            drawId: currentDrawId,
          });
          if (alive) setLimitUsage({ current: info.current, max: info.max });
        } catch {}
      }
    })();

    return () => {
      alive = false;
    };
  }, [currentDrawId]);

  // Refetch imediato quando um novo sorteio for criado/aberto (admin)
  React.useEffect(() => {
    const onDrawChanged = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/config`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const j = await res.json().catch(() => ({}));
        const did =
          j?.current_draw_id ?? j?.draw_id ?? j?.current?.id ?? j?.current_draw?.id;
        if (did != null) setCurrentDrawId(did);
      } catch {}
    };
    window.addEventListener("ns:draw:changed", onDrawChanged);
    return () => window.removeEventListener("ns:draw:changed", onDrawChanged);
  }, []);

  // Polling leve de /api/numbers (sem Content-Type p/ não gerar preflight)
  const reloadSrvNumbers = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/numbers`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const j = await res.json();
      const nextDrawId = j?.drawId ?? j?.draw_id ?? null;
      const hasOpenPrincipal = nextDrawId != null && !j?.error;
      setPrincipalOpen(hasOpenPrincipal);
      setCurrentDrawId(hasOpenPrincipal ? nextDrawId : null);
      if (!hasOpenPrincipal) limparSelecao();

      const numbersFromApi = Array.isArray(j?.numbers) ? j.numbers : [];
      if (!numbersFromApi.length) {
        if (hasOpenPrincipal) {
          setSrvReservados([]);
          setSrvIndisponiveis([]);
          setSoldInitials({});
        }
        return;
      }

      const reserv = [];
      const indis = [];
      const initials = {};

      for (const it of numbersFromApi) {
        const st = String(it.status || "").toLowerCase();
        const num = Number(it.n);
        const soldInitial = getPrincipalSoldInitials(it);
        if (soldInitial) initials[num] = soldInitial;
        if (st === "reserved") reserv.push(num);
        if (isPrincipalUnavailableStatus(st)) {
          indis.push(num);
        }
      }

      setSrvReservados(Array.from(new Set(reserv)));
      setSrvIndisponiveis(Array.from(new Set(indis)));
      setSoldInitials(initials);
    } catch {
      /* silencioso */
    }
  }, [limparSelecao]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      await reloadSrvNumbers();
      if (!alive) return;
    })();

    const id = setInterval(() => {
      if (!alive) return;
      reloadSrvNumbers();
    }, 15000);

    const onReload = () => {
      if (!alive) return;
      reloadSrvNumbers();
    };
    window.addEventListener("ns:numbers:reload", onReload);

    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("ns:numbers:reload", onReload);
    };
  }, [reloadSrvNumbers]);

  const reservadosAll = React.useMemo(
    () => Array.from(new Set([...(reservados || []), ...srvReservados])),
    [reservados, srvReservados]
  );
  const indisponiveisAll = React.useMemo(
    () =>
      Array.from(new Set([...(indisponiveis || []), ...srvIndisponiveis])),
    [indisponiveis, srvIndisponiveis]
  );

  // menu avatar
  const [menuEl, setMenuEl] = React.useState(null);
  const menuOpen = Boolean(menuEl);
  const handleOpenMenu = (e) => setMenuEl(e.currentTarget);
  const handleCloseMenu = () => setMenuEl(null);
  const goConta = () => {
    handleCloseMenu();
    navigate("/conta");
  };
  const goLogin = () => {
    handleCloseMenu();
    navigate("/login");
  };
  const doLogout = () => {
    handleCloseMenu();
    logout();
    navigate("/");
  };

  // modal (confirmação)
  const [open, setOpen] = React.useState(false);
  const handleAbrirConfirmacao = () => {
    if (principalOpen !== true) return;
    setOpen(true);
  };
  const handleFechar = () => setOpen(false);

  // PIX modal
  const [pixOpen, setPixOpen] = React.useState(false);
  const [pixLoading, setPixLoading] = React.useState(false);
  const [pixData, setPixData] = React.useState(null);
  const [pixAmount, setPixAmount] = React.useState(0);

  // sucesso PIX
  const [pixApproved, setPixApproved] = React.useState(false);
  const handlePixApproved = React.useCallback(() => {
    setPixApproved(true);
    setPixOpen(false);
    setPixLoading(false);
  }, []);

  // === Modal de limite ===
  const [limitOpen, setLimitOpen] = React.useState(false);
  const [limitInfo, setLimitInfo] = React.useState({
    type: "purchase",
    current: undefined,
    max: undefined,
  });
  const openLimitModal = (info) => {
    setLimitInfo(info || { type: "purchase" });
    setLimitOpen(true);
  };

  // Quantos ainda pode comprar segundo o servidor
  const remainingFromServer =
    (limitUsage.max ?? Infinity) - (limitUsage.current ?? 0);

  const handleIrPagamento = async () => {
    setOpen(false);

    if (principalOpen !== true) {
      alert("Rodada encerrada. Em breve abriremos o próximo sorteio.");
      return;
    }

    if (!isAuthenticated) {
      navigate("/login", { replace: false, state: { from: "/", wantPay: true } });
      return;
    }

    const addCount = selecionados.length || 1;

    try {
      const { blocked, current, max } = await checkUserPurchaseLimit({
        addCount,
        drawId: currentDrawId,
      });

      const wouldBe = (current ?? 0) + addCount;
      const overByFront = Number.isFinite(max) && wouldBe > max;

      if (blocked || overByFront) {
        openLimitModal({
          type: "purchase",
          current: current ?? limitUsage.current,
          max: max ?? limitUsage.max ?? 5,
        });
        setLimitUsage({ current: current ?? 0, max: max ?? 5 });
        return;
      }
    } catch (e) {
      console.warn("[limit-check] falhou, seguindo fluxo]:", e);
    }

    const amount = selecionados.length * unitPrice;
    setPixAmount(amount);
    setPixOpen(true);
    setPixLoading(true);
    setPixApproved(false);

    try {
      const { reservationId } = await reserveNumbers(selecionados);
      const data = await createPixPayment({
        orderId: String(Date.now()),
        amount,
        numbers: selecionados,
        reservationId,
      });
      setPixData(data);

      setLimitUsage((old) => ({
        current:
          Number.isFinite(old.current) ? (old.current ?? 0) + addCount : old.current,
        max: old.max,
      }));
    } catch (e) {
      alert(e.message || "Falha ao gerar PIX");
      setPixOpen(false);
    } finally {
      setPixLoading(false);
    }
  };

  // Polling de status PIX
  React.useEffect(() => {
    if (!pixOpen || !pixData?.paymentId || pixApproved) return;
    const id = setInterval(async () => {
      try {
        const st = await checkPixStatus(pixData.paymentId);
        if (st?.status === "approved") handlePixApproved();
      } catch {}
    }, 3500);
    return () => clearInterval(id);
  }, [pixOpen, pixData, pixApproved, handlePixApproved]);

  // Seleção com teto (front)
  const isReservado = (n) => reservadosAll.includes(n);
  const isIndisponivel = (n) => indisponiveisAll.includes(n);
  const isSelecionado = (n) => selecionados.includes(n);
  const handleClickNumero = (n) => {
    if (principalOpen !== true) return;
    if (isIndisponivel(n)) return;
    setSelecionados((prev) => {
      const already = prev.includes(n);
      if (already) return prev.filter((x) => x !== n);

      if (prev.length >= maxSelect) {
        openLimitModal({
          type: "selection",
          current: maxSelect,
          max: maxSelect,
        });
        return prev;
      }

      if (Number.isFinite(remainingFromServer) && remainingFromServer <= prev.length) {
        openLimitModal({
          type: "purchase",
          current: limitUsage.current ?? 0,
          max: limitUsage.max ?? 5,
        });
        return prev;
      }

      return [...prev, n];
    });
  };

  const getCellSx = (n) => {
    if (principalOpen !== true) {
      return {
        border: "2px solid",
        borderColor: "error.main",
        bgcolor: "rgba(211,47,47,0.15)",
        color: "grey.300",
        cursor: "not-allowed",
        opacity: 0.95,
      };
    }
    if (isIndisponivel(n)) {
      return {
        border: "2px solid",
        borderColor: "error.main",
        bgcolor: "rgba(211,47,47,0.15)",
        color: "grey.300",
        cursor: "not-allowed",
        opacity: 0.85,
      };
    }
    if (isSelecionado(n) || isReservado(n)) {
      return {
        border: "2px solid",
        borderColor: "secondary.main",
        bgcolor: "rgba(255,193,7,0.12)",
      };
    }
    return {
      border: "2px solid rgba(255,255,255,0.08)",
      bgcolor: "primary.main",
      color: "#0E0E0E",
      "&:hover": { filter: "brightness(0.95)" },
      transition: "filter 120ms ease",
    };
  };

  const principalClosedForPurchase = principalOpen === false;

  const continuarDisabled =
    principalOpen !== true ||
    !selecionados.length ||
    (Number.isFinite(remainingFromServer) &&
      selecionados.length > Math.max(0, remainingFromServer));

  const getSecondaryHeaders = React.useCallback(
    (withJson = false) => {
      const headers = withJson ? { "Content-Type": "application/json" } : {};
      const authToken = getRequestAuthToken(token);
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      return headers;
    },
    [token]
  );

  const fetchSecondaryNumbers = React.useCallback(async (drawId) => {
    const res = await fetch(
      `${API_BASE}/api/secondary-draws/${encodeURIComponent(drawId)}/numbers`,
      {
        credentials: "include",
        cache: "no-store",
      }
    );
    if (!res.ok) throw new Error(`secondary_numbers_${res.status}`);
    const payload = await res.json().catch(() => ({}));
    return getSecondaryNumbersFromPayload(payload);
  }, []);

  const reloadSecondaryNumbers = React.useCallback(
    async (drawId = secondaryDraw?.id) => {
      if (drawId == null) return;
      setSecondaryNumbersLoading(true);
      try {
        const nextNumbers = await fetchSecondaryNumbers(drawId);
        setSecondaryNumbers(nextNumbers);
      } finally {
        setSecondaryNumbersLoading(false);
      }
    },
    [fetchSecondaryNumbers, secondaryDraw?.id]
  );

  React.useEffect(() => {
    const legacySecondaryEnabled =
      process.env.REACT_APP_ENABLE_LEGACY_SECONDARY === "true";
    if (!legacySecondaryEnabled) {
      setSecondaryDraw(null);
      setSecondaryNumbers([]);
      setSelectedSecondaryNumbers([]);
      setSecondaryReservation(null);
      setSecondaryPayment(null);
      setSecondaryLoading(false);
      setSecondaryNumbersLoading(false);
      return undefined;
    }

    let alive = true;

    (async () => {
      setSecondaryLoading(true);
      setSecondaryNumbersLoading(true);
      setSecondaryError("");
      try {
        const res = await fetch(`${API_BASE}/api/secondary-draws/current`, {
          credentials: "include",
          cache: "no-store",
        });

        if (res.status === 204 || res.status === 404) {
          if (!alive) return;
          setSecondaryDraw(null);
          setSecondaryNumbers([]);
          setSelectedSecondaryNumbers([]);
          setSecondaryReservation(null);
          setSecondaryPayment(null);
          setSecondaryNotice("");
          return;
        }

        if (!res.ok) throw new Error(`secondary_current_${res.status}`);

        const payload = await res.json().catch(() => ({}));
        const draw = getSecondaryDrawFromPayload(payload);
        if (!draw) {
          if (!alive) return;
          setSecondaryDraw(null);
          setSecondaryNumbers([]);
          setSelectedSecondaryNumbers([]);
          setSecondaryReservation(null);
          setSecondaryPayment(null);
          setSecondaryNotice("");
          return;
        }

        const nextNumbers = await fetchSecondaryNumbers(draw.id);
        if (!alive) return;
        setSecondaryDraw(draw);
        setSecondaryNumbers(nextNumbers);
        setSelectedSecondaryNumbers([]);
        setSecondaryReservation(null);
        setSecondaryPayment(null);
        setSecondaryNotice("");
      } catch (e) {
        if (!alive) return;
        setSecondaryError("Não foi possível carregar o sorteio secundário.");
      } finally {
        if (alive) {
          setSecondaryLoading(false);
          setSecondaryNumbersLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [fetchSecondaryNumbers]);

  const secondaryNumberByValue = React.useMemo(() => {
    const map = new Map();
    for (const item of secondaryNumbers) map.set(item.n, item);
    return map;
  }, [secondaryNumbers]);

  const secondaryPriceCents = Number(
    secondaryDraw?.price_cents ??
      secondaryDraw?.ticket_price_cents ??
      secondaryDraw?.quota_price_cents ??
      0
  );
  const secondaryAvailableCount = secondaryNumbers.filter(
    (item) => item.status === "available"
  ).length;
  const secondaryPrizeLabel =
    secondaryDraw?.product_name ||
    secondaryDraw?.prize ||
    secondaryDraw?.title ||
    secondaryDraw?.name ||
    "-";
  const secondaryBannerTitle =
    secondaryDraw?.product_name ||
    secondaryDraw?.promo_phrase ||
    secondaryDraw?.title ||
    secondaryDraw?.name ||
    "SORTEIO SECUNDÁRIO";
  const secondaryQuotaLabel = formatSecondaryMoney(secondaryPriceCents);
  const secondaryStatusLabel = secondaryDraw?.status || "aberto";
  const secondaryAvailableLabel = secondaryDraw ? String(secondaryAvailableCount) : "-";
  const secondaryTotalCents =
    selectedSecondaryNumbers.length *
    (Number.isFinite(secondaryPriceCents) ? secondaryPriceCents : 0);
  const secondaryTotalLabel = formatSecondaryMoney(secondaryTotalCents);
  const secondaryReservationId = getSecondaryReservationId(secondaryReservation);
  const secondaryReservationNumbers =
    secondaryReservation?.numbers ||
    secondaryReservation?.reserved_numbers ||
    secondaryReservation?.selected_numbers ||
    [];
  const secondaryReservationAmountCents = Number(
    secondaryReservation?.amount_cents ?? secondaryReservation?.total_cents
  );
  const secondaryReservationAmountValue = Number(
    secondaryReservation?.amount ?? secondaryReservation?.total
  );
  const secondaryReservationAmount =
    Number.isFinite(secondaryReservationAmountCents) &&
    secondaryReservationAmountCents > 0
      ? secondaryReservationAmountCents / 100
      : Number.isFinite(secondaryReservationAmountValue) &&
        secondaryReservationAmountValue > 0
      ? secondaryReservationAmountValue
      : secondaryReservationNumbers.length * (secondaryPriceCents / 100);

  const getSecondaryNumberStatus = (n) =>
    secondaryNumberByValue.get(n)?.status || "blocked";
  const isSecondarySelected = (n) => selectedSecondaryNumbers.includes(n);

  const handleSecondaryNumberClick = (n) => {
    const status = getSecondaryNumberStatus(n);
    if (status !== "available" && !isSecondarySelected(n)) return;
    setSecondaryNotice("");
    setSecondaryError("");
    setSecondaryPayment(null);
    setSelectedSecondaryNumbers((prev) =>
      prev.includes(n) ? prev.filter((item) => item !== n) : [...prev, n]
    );
  };

  const getSecondaryCellSx = (n) => {
    const status = getSecondaryNumberStatus(n);
    const selected = isSecondarySelected(n);

    if (selected) {
      return {
        border: "2px solid",
        borderColor: "secondary.main",
        bgcolor: "rgba(255,193,7,0.16)",
        color: "secondary.main",
        cursor: "pointer",
      };
    }
    if (status === "available") {
      return {
        border: "2px solid rgba(255,255,255,0.08)",
        bgcolor: "primary.main",
        color: "#0E0E0E",
        cursor: "pointer",
        "&:hover": { filter: "brightness(0.95)" },
      };
    }
    if (status === "reserved") {
      return {
        border: "2px solid",
        borderColor: "secondary.main",
        bgcolor: "rgba(255,193,7,0.12)",
        color: "rgba(255,255,255,0.72)",
        cursor: "not-allowed",
      };
    }
    if (status === "sold") {
      return {
        border: "2px solid",
        borderColor: "error.main",
        bgcolor: "rgba(211,47,47,0.15)",
        color: "rgba(255,255,255,0.55)",
        cursor: "not-allowed",
      };
    }
    return {
      border: "2px solid",
      borderColor: "error.main",
      bgcolor: "rgba(211,47,47,0.15)",
      color: "rgba(255,255,255,0.55)",
      cursor: "not-allowed",
    };
  };

  const handleReserveSecondaryNumbers = async () => {
    if (!secondaryDraw?.id || !selectedSecondaryNumbers.length) return null;
    setSecondaryReserveLoading(true);
    setSecondaryError("");
    setSecondaryNotice("");
    try {
      const numbersToReserve = selectedSecondaryNumbers.slice().sort((a, b) => a - b);
      const res = await fetch(
        `${API_BASE}/api/secondary-draws/${encodeURIComponent(
          secondaryDraw.id
        )}/reserve`,
        {
          method: "POST",
          headers: getSecondaryHeaders(true),
          credentials: "include",
          body: JSON.stringify({ numbers: numbersToReserve }),
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || payload?.message || "Falha ao reservar números do secundário.");
      }
      const reservation = { ...payload, numbers: payload?.numbers || numbersToReserve };
      setSecondaryReservation(reservation);
      setSelectedSecondaryNumbers([]);
      setSecondaryPayment(null);
      setSecondaryNotice("Números do sorteio secundário reservados.");
      await reloadSecondaryNumbers(secondaryDraw.id);
      return reservation;
    } catch (e) {
      setSecondaryError(e.message || "Falha ao reservar números do secundário.");
      return null;
    } finally {
      setSecondaryReserveLoading(false);
    }
  };

  const handleSecondaryPix = async (reservation = secondaryReservation) => {
    const reservationId = getSecondaryReservationId(reservation);
    if (!reservationId) return null;
    setSecondaryPixLoading(true);
    setSecondaryError("");
    try {
      const res = await fetch(`${API_BASE}/api/secondary-payments/pix`, {
        method: "POST",
        headers: getSecondaryHeaders(true),
        credentials: "include",
        body: JSON.stringify({ reservation_id: reservationId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getSecondaryPixErrorMessage(payload?.error || payload?.message));
        // eslint-disable-next-line no-unreachable
        throw new Error(payload?.error || payload?.message || "Falha ao gerar PIX do secundário.");
      }
      const paymentId = payload?.paymentId ?? payload?.payment_id ?? payload?.id;
      const payment = {
        ...payload,
        paymentId,
        copy_paste_code:
          payload?.copy_paste_code ||
          payload?.copyPaste ||
          payload?.pix_copy_paste ||
          payload?.qr_code ||
          "",
        qr_code_base64:
          payload?.qr_code_base64 ||
          payload?.qrCodeBase64 ||
          payload?.pix_qr_code_base64 ||
          "",
      };
      setSecondaryPayment(payment);
      setSecondaryPixOpen(true);
      return payment;
    } catch (e) {
      setSecondaryError(e.message || "Falha ao gerar PIX do secundário.");
      return null;
    } finally {
      setSecondaryPixLoading(false);
    }
  };

  const handleContinueSecondary = async () => {
    const reservation = await handleReserveSecondaryNumbers();
    if (reservation) await handleSecondaryPix(reservation);
  };

  const getAdditionalDrawsFromPayload = (payload) => {
    const raw = Array.isArray(payload)
      ? payload
      : payload?.draws ||
        payload?.items ||
        (Array.isArray(payload?.data) ? payload.data : null) ||
        payload?.data?.draws ||
        payload?.data?.items ||
        [];
    return raw
      .map((draw) => {
        const id = draw?.id ?? draw?.draw_id ?? draw?.drawId;
        return id == null ? null : { ...draw, id };
      })
      .filter(Boolean);
  };

  const fetchAdditionalNumbers = React.useCallback(async (drawId) => {
    let res = await fetch(
      `${API_BASE}/api/additional-draws/${encodeURIComponent(drawId)}/numbers`,
      {
        credentials: "include",
        cache: "no-store",
      }
    );
    if ([404, 405, 501].includes(res.status)) {
      res = await fetch(
        `${API_BASE}/api/secondary-draws/${encodeURIComponent(drawId)}/numbers`,
        {
          credentials: "include",
          cache: "no-store",
        }
      );
    }
    if (!res.ok) throw new Error(`additional_numbers_${res.status}`);
    const payload = await res.json().catch(() => ({}));
    return getSecondaryNumbersFromPayload(payload);
  }, []);

  const reloadAdditionalNumbers = React.useCallback(
    async (drawId) => {
      if (drawId == null) return;
      setAdditionalLoadingByDrawId((prev) => ({ ...prev, [drawId]: true }));
      setAdditionalNumbersLoadingByDrawId((prev) => ({ ...prev, [drawId]: true }));
      try {
        const nextNumbers = await fetchAdditionalNumbers(drawId);
        setAdditionalNumbersByDrawId((prev) => ({ ...prev, [drawId]: nextNumbers }));
      } finally {
        setAdditionalLoadingByDrawId((prev) => ({ ...prev, [drawId]: false }));
        setAdditionalNumbersLoadingByDrawId((prev) => ({ ...prev, [drawId]: false }));
      }
    },
    [fetchAdditionalNumbers]
  );

  React.useEffect(() => {
    let alive = true;
    (async () => {
      setAdditionalLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/additional-draws/open`, {
          credentials: "include",
          cache: "no-store",
        });
        let draws = [];
        if (res.ok) {
          const payload = await res.json().catch(() => ({}));
          draws = getAdditionalDrawsFromPayload(payload);
        }
        if (!draws.length) {
          const legacyRes = await fetch(`${API_BASE}/api/secondary-draws/current`, {
            credentials: "include",
            cache: "no-store",
          });
          if (legacyRes.ok) {
            const legacyPayload = await legacyRes.json().catch(() => ({}));
            const legacyDraw = getSecondaryDrawFromPayload(legacyPayload);
            draws = legacyDraw ? [legacyDraw] : [];
          }
        }
        if (!alive) return;
        setAdditionalDraws(draws);
        await Promise.all(
          draws.map(async (draw) => {
            try {
              if (alive) {
                setAdditionalLoadingByDrawId((prev) => ({ ...prev, [draw.id]: true }));
              }
              const numbers = await fetchAdditionalNumbers(draw.id);
              if (alive) {
                setAdditionalNumbersByDrawId((prev) => ({ ...prev, [draw.id]: numbers }));
              }
            } catch (e) {
              if (alive) {
                setAdditionalErrorByDrawId((prev) => ({
                  ...prev,
                  [draw.id]: "Não foi possível carregar os números deste adicional.",
                }));
              }
            } finally {
              if (alive) {
                setAdditionalLoadingByDrawId((prev) => ({ ...prev, [draw.id]: false }));
              }
            }
          })
        );
      } catch (e) {
        if (alive) setAdditionalDraws([]);
      } finally {
        if (alive) setAdditionalLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fetchAdditionalNumbers]);

  const getAdditionalNumberItem = (drawId, n) => {
    const numbers = additionalNumbersByDrawId[drawId] || [];
    return numbers.find((item) => Number(item.n) === Number(n)) || null;
  };

  const getAdditionalNumberInitials = (drawId, n) => {
    const item = getAdditionalNumberItem(drawId, n);
    return getNumberOwnerInitials(item);
  };

  const getAdditionalNumberStatus = (drawId, n) => {
    const item = getAdditionalNumberItem(drawId, n);
    return item?.status || "blocked";
  };

  const getAdditionalCellSx = (drawId, n) => {
    const status = getAdditionalNumberStatus(drawId, n);
    const selected = isAdditionalSelected(drawId, n);

    if (selected) {
      return {
        border: "2px solid",
        borderColor: "secondary.main",
        bgcolor: "rgba(255,193,7,0.16)",
        color: "secondary.main",
        cursor: "pointer",
      };
    }
    if (status === "available") {
      return {
        border: "2px solid rgba(255,255,255,0.08)",
        bgcolor: "primary.main",
        color: "#0E0E0E",
        cursor: "pointer",
        "&:hover": { filter: "brightness(0.95)" },
      };
    }
    if (status === "reserved") {
      return {
        border: "2px solid",
        borderColor: "secondary.main",
        bgcolor: "rgba(255,193,7,0.12)",
        color: "rgba(255,255,255,0.72)",
        cursor: "not-allowed",
      };
    }
    if (status === "sold") {
      return {
        border: "2px solid",
        borderColor: "error.main",
        bgcolor: "rgba(211,47,47,0.15)",
        color: "rgba(255,255,255,0.55)",
        cursor: "not-allowed",
      };
    }
    return {
      border: "2px solid",
      borderColor: "error.main",
      bgcolor: "rgba(211,47,47,0.15)",
      color: "rgba(255,255,255,0.55)",
      cursor: "not-allowed",
    };
  };

  const isAdditionalSelected = (drawId, n) =>
    (selectedAdditionalNumbersByDrawId[drawId] || []).includes(n);

  const handleAdditionalNumberClick = (drawId, n) => {
    if (additionalReserveLoadingByDrawId[drawId] || additionalPixLoadingByDrawId[drawId]) return;
    const status = getAdditionalNumberStatus(drawId, n);
    if (status !== "available" && !isAdditionalSelected(drawId, n)) return;
    const current = selectedAdditionalNumbersByDrawId[drawId] || [];
    const alreadySelected = current.includes(n);
    const draw = additionalDraws.find((item) => String(item.id) === String(drawId));
    const maxNumbers = Number(draw?.max_numbers_per_selection ?? draw?.max_tickets ?? 0);
    if (!alreadySelected && Number.isFinite(maxNumbers) && maxNumbers > 0 && current.length >= maxNumbers) {
      setAdditionalErrorByDrawId((prev) => ({
        ...prev,
        [drawId]: `Limite de ${maxNumbers} número(s) neste sorteio adicional.`,
      }));
      return;
    }
    setAdditionalErrorByDrawId((prev) => ({ ...prev, [drawId]: "" }));
    setAdditionalNoticeByDrawId((prev) => ({ ...prev, [drawId]: "" }));
    setAdditionalPaymentByDrawId((prev) => ({ ...prev, [drawId]: null }));
    setSelectedAdditionalNumbersByDrawId((prev) => {
      const current = prev[drawId] || [];
      return {
        ...prev,
        [drawId]: current.includes(n)
          ? current.filter((item) => item !== n)
          : [...current, n],
      };
    });
  };

  const handleReserveAdditionalNumbers = async (draw) => {
    const drawId = draw?.id;
    const selected = selectedAdditionalNumbersByDrawId[drawId] || [];
    if (!drawId || !selected.length) return null;
    const authToken = getRequestAuthToken(token);
    if (!authToken) {
      setAdditionalErrorByDrawId((prev) => ({
        ...prev,
        [drawId]: ADDITIONAL_LOGIN_REQUIRED_MESSAGE,
      }));
      return null;
    }
    setAdditionalReserveLoadingByDrawId((prev) => ({ ...prev, [drawId]: true }));
    setAdditionalErrorByDrawId((prev) => ({ ...prev, [drawId]: "" }));
    try {
      const numbersToReserve = selected.slice().sort((a, b) => a - b);
      let res = await fetch(
        `${API_BASE}/api/additional-draws/${encodeURIComponent(drawId)}/reserve`,
        {
          method: "POST",
          headers: getSecondaryHeaders(true),
          credentials: "include",
          body: JSON.stringify({ numbers: numbersToReserve }),
        }
      );
      if ([404, 405, 501].includes(res.status)) {
        res = await fetch(
          `${API_BASE}/api/secondary-draws/${encodeURIComponent(drawId)}/reserve`,
          {
            method: "POST",
            headers: getSecondaryHeaders(true),
            credentials: "include",
            body: JSON.stringify({ numbers: numbersToReserve }),
          }
        );
      }
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getAdditionalReserveErrorMessage(payload?.message || payload?.error));
      }
      const reservation = { ...payload, numbers: payload?.numbers || numbersToReserve };
      setAdditionalReservationsByDrawId((prev) => ({ ...prev, [drawId]: reservation }));
      setSelectedAdditionalNumbersByDrawId((prev) => ({ ...prev, [drawId]: [] }));
      setAdditionalNoticeByDrawId((prev) => ({
        ...prev,
        [drawId]: "Números do sorteio adicional reservados.",
      }));
      await reloadAdditionalNumbers(drawId);
      return reservation;
    } catch (e) {
      setAdditionalErrorByDrawId((prev) => ({
        ...prev,
        [drawId]: getAdditionalReserveErrorMessage(e.message),
      }));
      return null;
    } finally {
      setAdditionalReserveLoadingByDrawId((prev) => ({ ...prev, [drawId]: false }));
    }
  };

  const handleAdditionalPix = async (draw, reservation) => {
    const drawId = draw?.id;
    const reservationId = getSecondaryReservationId(reservation);
    if (!drawId || !reservationId) return null;
    setAdditionalPixLoadingByDrawId((prev) => ({ ...prev, [drawId]: true }));
    setAdditionalErrorByDrawId((prev) => ({ ...prev, [drawId]: "" }));
    try {
      let res = await fetch(`${API_BASE}/api/additional-payments/pix`, {
        method: "POST",
        headers: getSecondaryHeaders(true),
        credentials: "include",
        body: JSON.stringify({ draw_id: drawId, reservation_id: reservationId }),
      });
      if ([404, 405, 501].includes(res.status)) {
        res = await fetch(`${API_BASE}/api/secondary-payments/pix`, {
          method: "POST",
          headers: getSecondaryHeaders(true),
          credentials: "include",
          body: JSON.stringify({ reservation_id: reservationId }),
        });
      }
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(getSecondaryPixErrorMessage(payload?.error || payload?.message));
      }
      const payment = normalizeAdditionalPixPayment(payload);
      setAdditionalPixStatusByDrawId((prev) => ({ ...prev, [drawId]: payment.status || "pending" }));
      setAdditionalPixMessageByDrawId((prev) => ({ ...prev, [drawId]: ADDITIONAL_PIX_PENDING_MESSAGE }));
      setAdditionalPaymentByDrawId((prev) => ({ ...prev, [drawId]: payment }));
      setAdditionalPixOpenDrawId(drawId);
      return payment;
    } catch (e) {
      setAdditionalErrorByDrawId((prev) => ({
        ...prev,
        [drawId]: e.message || "Falha ao gerar PIX do adicional.",
      }));
      return null;
    } finally {
      setAdditionalPixLoadingByDrawId((prev) => ({ ...prev, [drawId]: false }));
    }
  };

  const checkAdditionalPixStatus = React.useCallback(
    async (paymentId) => {
      const res = await fetch(
        `${API_BASE}/api/additional-payments/${encodeURIComponent(paymentId)}/status`,
        {
          method: "GET",
          headers: getSecondaryHeaders(false),
          credentials: "include",
          cache: "no-store",
        }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || payload?.message || `additional_status_${res.status}`);
      }
      return payload;
    },
    [getSecondaryHeaders]
  );

  const handleAdditionalPixApproved = React.useCallback(
    async (drawId) => {
      if (drawId == null) return;
      setAdditionalPixStatusByDrawId((prev) => ({ ...prev, [drawId]: "approved" }));
      setAdditionalPixMessageByDrawId((prev) => ({ ...prev, [drawId]: ADDITIONAL_PIX_SUCCESS_MESSAGE }));
      setAdditionalNoticeByDrawId((prev) => ({ ...prev, [drawId]: ADDITIONAL_PIX_SUCCESS_MESSAGE }));
      setAdditionalPixLoadingByDrawId((prev) => ({ ...prev, [drawId]: false }));
      setAdditionalPaymentByDrawId((prev) => ({
        ...prev,
        [drawId]: prev[drawId] ? { ...prev[drawId], status: "approved" } : prev[drawId],
      }));
      await reloadAdditionalNumbers(drawId);
      setSelectedAdditionalNumbersByDrawId((prev) => ({ ...prev, [drawId]: [] }));
      setAdditionalPixOpenDrawId((current) => (String(current) === String(drawId) ? null : current));
    },
    [reloadAdditionalNumbers]
  );

  React.useEffect(() => {
    const drawId = additionalPixOpenDrawId;
    if (drawId == null) return undefined;

    const payment = additionalPaymentByDrawId[drawId];
    const paymentId = payment?.paymentId ?? payment?.payment_id ?? payment?.id;
    if (!paymentId) return undefined;

    const currentStatus = String(additionalPixStatusByDrawId[drawId] || payment?.status || "").toLowerCase();
    if (ADDITIONAL_PIX_PAID_STATUSES.has(currentStatus)) return undefined;
    if (ADDITIONAL_PIX_FINAL_ERROR_STATUSES.has(currentStatus)) return undefined;

    let stopped = false;
    let intervalId;

    const poll = async () => {
      try {
        const statusPayload = await checkAdditionalPixStatus(paymentId);
        if (stopped) return;

        const nextStatus = String(statusPayload?.status || "pending").toLowerCase();
        setAdditionalPixStatusByDrawId((prev) => (prev[drawId] === nextStatus ? prev : { ...prev, [drawId]: nextStatus }));

        if (statusPayload?.paid || ADDITIONAL_PIX_PAID_STATUSES.has(nextStatus)) {
          if (intervalId) clearInterval(intervalId);
          await handleAdditionalPixApproved(drawId);
          return;
        }

        if (ADDITIONAL_PIX_FINAL_ERROR_STATUSES.has(nextStatus)) {
          if (intervalId) clearInterval(intervalId);
          setAdditionalPixMessageByDrawId((prev) => ({ ...prev, [drawId]: ADDITIONAL_PIX_FAILED_MESSAGE }));
          setAdditionalPixLoadingByDrawId((prev) => ({ ...prev, [drawId]: false }));
          return;
        }

        setAdditionalPixMessageByDrawId((prev) => ({ ...prev, [drawId]: ADDITIONAL_PIX_PENDING_MESSAGE }));
      } catch {
        if (!stopped) {
          setAdditionalPixMessageByDrawId((prev) => ({ ...prev, [drawId]: ADDITIONAL_PIX_PENDING_MESSAGE }));
        }
      }
    };

    poll();
    intervalId = setInterval(poll, 3500);

    return () => {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [
    additionalPaymentByDrawId,
    additionalPixOpenDrawId,
    additionalPixStatusByDrawId,
    checkAdditionalPixStatus,
    handleAdditionalPixApproved,
  ]);
  const handleContinueAdditional = async (draw) => {
    const reservation = await handleReserveAdditionalNumbers(draw);
    if (reservation) await handleAdditionalPix(draw, reservation);
  };

  const renderNumberContent = ({ number, initials, sold, closedInitials = false }) => {
    const showSoldOverlay = sold && !closedInitials;

    return (
      <>
        <Box
          component="span"
          sx={{
            display: { xs: showSoldOverlay ? "none" : "inline", md: "inline" },
          }}
        >
          {closedInitials || pad2(number)}
        </Box>

        {showSoldOverlay && (
          <Box
            sx={{
              display: { xs: "flex", md: "none" },
              position: "absolute",
              inset: 0,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 0.25,
              pointerEvents: "none",
            }}
          >
            <Box sx={{ fontWeight: 900, lineHeight: 1 }}>
              {pad2(number)}
            </Box>

            {initials && (
              <Box
                sx={{
                  mt: 0.25,
                  px: 0.5,
                  py: 0.1,
                  borderRadius: 0.75,
                  fontSize: 10,
                  fontWeight: 900,
                  lineHeight: 1,
                  backgroundColor: "rgba(0,0,0,0.45)",
                  color: "#fff",
                  letterSpacing: 0.5,
                }}
              >
                {initials}
              </Box>
            )}
          </Box>
        )}

        {showSoldOverlay && initials && (
          <Box
            sx={{
              display: { xs: "none", md: "block" },
              position: "absolute",
              right: 4,
              bottom: 4,
              px: 0.5,
              py: 0.1,
              borderRadius: 0.75,
              fontSize: 10,
              fontWeight: 900,
              lineHeight: 1,
              backgroundColor: "rgba(0,0,0,0.45)",
              color: "#fff",
              letterSpacing: 0.5,
              pointerEvents: "none",
              zIndex: 2,
            }}
          >
            {initials}
          </Box>
        )}
      </>
    );
  };

  const renderPixLoadingOverlay = ({ open, title = "Pagamento via PIX" }) => {
    if (!open) return null;

    return (
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "rgba(0,0,0,0.62)",
          backdropFilter: "blur(1px)",
          borderRadius: 2,
        }}
      >
        <Box
          sx={{
            width: { xs: "calc(100% - 32px)", sm: 460 },
            maxWidth: "100%",
            bgcolor: "rgba(24,24,24,0.96)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 2,
            p: { xs: 2, sm: 3 },
            boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
          }}
        >
          <Typography
            sx={{
              fontWeight: 800,
              color: "rgba(255,255,255,0.76)",
              mb: 2,
            }}
          >
            {title}
          </Typography>

          <LinearProgress />
        </Box>
      </Box>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />

      {/* Topo */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <Toolbar sx={{ position: "relative", minHeight: 64 }}>
          <IconButton edge="start" color="inherit">
            {/* espaçamento */}
          </IconButton>

          <Button
            component={RouterLink}
            to="/cadastro"
            variant="text"
            sx={{ fontWeight: 700, mt: 1 }}
          >
            Criar conta
          </Button>

          <Box
            component={RouterLink}
            to={logoTo}
            onClick={(e) => {
              e.preventDefault();
              navigate(logoTo);
            }}
            sx={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Box
              component="img"
              src={logoNewStore}
              alt="NEW STORE"
              sx={{ height: 40, objectFit: "contain" }}
            />
          </Box>

          <IconButton color="inherit" sx={{ ml: "auto" }} onClick={handleOpenMenu}>
            <AccountCircleRoundedIcon />
          </IconButton>
          <Menu
            anchorEl={menuEl}
            open={menuOpen}
            onClose={handleCloseMenu}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            {isAuthenticated ? (
              <>
                <MenuItem onClick={goConta}>Área do cliente</MenuItem>
                <Divider />
                <MenuItem onClick={doLogout}>Sair</MenuItem>
              </>
            ) : (
              <MenuItem onClick={goLogin}>Entrar</MenuItem>
            )}
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Conteúdo */}
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack spacing={4}>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
              <Typography variant="h3" fontWeight={900}>
                Bem-vindos ao Sorteio da{" "}
                <Box component="span" sx={{ opacity: 0.85 }}>
                  New Store
                </Box>{" "}
                Relógios!
              </Typography>
              <Typography variant="h5" fontWeight={900}>
                “Participe, concorra e ainda receba 100% do valor de volta.”
              
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>
                A New Store apresenta o único sorteio em que você nunca sai perdendo.
Ao participar, você garante uma vaga na disputa por <strong>Prêmios</strong>, e ainda transforma o valor da sua participação em um Cartão Presente Digital, válido para compras em todo o site.
⏳ Sorteio válido até o preenchimento total da tabela.
Baseado no resultado oficial da Lotomania (Caixa Econômica Federal).
              </Typography>
            </Stack>
          </Paper>

          {/* === CARTELA === */}
          <Paper
            variant="outlined"
            sx={{ p: { xs: 1.5, md: 3 }, bgcolor: "background.paper" }}
          >
            {/* >>>>> BANNER SUPERIOR (dinâmico) */}
            <Box
              sx={{
                mb: 2,
                p: { xs: 1.25, md: 1.5 },
                borderRadius: 2,
                border: "1px solid rgba(255,255,255,0.12)",
                background:
                  "linear-gradient(90deg, rgba(103,194,58,0.12), rgba(255,193,7,0.10))",
              }}
            >
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 900,
                  textAlign: "center",
                  letterSpacing: 1,
                  background: "linear-gradient(90deg, #67C23A, #FFC107)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  textShadow: "0 0 12px rgba(103,194,58,0.18)",
                }}
              >
                {bannerTitle ||
                  "Sorteio de um Watch Winder Caixa de Suporte Rotativo Para Relógios Automáticos"}
              </Typography>
            </Box>

            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.5}
              alignItems="center"
              justifyContent="space-between"
              sx={{ mb: 2 }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                <Chip
                  size="small"
                  label="DISPONÍVEL"
                  sx={{ bgcolor: "primary.main", color: "#0E0E0E", fontWeight: 700 }}
                />
                <Chip
                  size="small"
                  label="RESERVADO"
                  sx={{
                    bgcolor: "rgba(255,193,7,0.18)",
                    border: "1px solid",
                    borderColor: "secondary.main",
                    color: "secondary.main",
                    fontWeight: 700,
                  }}
                />
                <Chip
                  size="small"
                  label="INDISPONÍVEL"
                  sx={{
                    bgcolor: "rgba(211,47,47,0.18)",
                    border: "1px solid",
                    borderColor: "error.main",
                    color: "error.main",
                    fontWeight: 700,
                  }}
                />
                <Typography variant="body2" sx={{ ml: 0.5, opacity: 0.9 }}>
                  {Number.isFinite(limitUsage.max) && Number.isFinite(limitUsage.current)
                    ? `• Você tem ${Math.max(
                        0,
                        (limitUsage.max ?? 0) - (limitUsage.current ?? 0)
                      )} de ${limitUsage.max} possíveis`
                    : " "}
                </Typography>
                {!!selecionados.length && (
                  <Typography variant="body2" sx={{ ml: 1, opacity: 0.8 }}>
                    • {selecionados.length} selecionado(s) (máx. {maxSelect} por seleção)
                  </Typography>
                )}
              </Stack>

              <Stack direction="row" spacing={1.5}>
                <Button
                  variant="outlined"
                  color="inherit"
                  disabled={!selecionados.length || principalOpen !== true}
                  onClick={limparSelecao}
                >
                  LIMPAR SELEÇÃO
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  disabled={continuarDisabled || principalOpen !== true}
                  onClick={handleAbrirConfirmacao}
                >
                  CONTINUAR
                </Button>
              </Stack>
            </Stack>

            {principalClosedForPurchase && (
              <Alert severity="info" sx={{ mb: 2, bgcolor: "rgba(2,136,209,0.12)" }}>
                Rodada encerrada. Em breve abriremos o próximo sorteio.
              </Alert>
            )}

            {/* Grid 10x10 */}
            <Box
              sx={{
                width: { xs: "calc(100vw - 32px)", sm: "calc(100vw - 64px)", md: "100%" },
                maxWidth: 640,
                aspectRatio: "1 / 1",
                mx: "auto",
              }}
            >
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
                  gridTemplateRows: "repeat(10, minmax(0, 1fr))",
                  gap: { xs: 1, md: 1.2 },
                  height: "100%",
                  width: "100%",
                  boxSizing: "border-box",
                }}
              >
                {Array.from({ length: 100 }).map((_, idx) => {
                  const sold = isIndisponivel(idx);
                  const initials = soldInitials[idx];
                  const closedInitials = principalOpen !== true && initials;
                  const showSoldOverlay = sold && !closedInitials;
                  return (
                    <Box
                      key={idx}
                      onClick={() => handleClickNumero(idx)}
                      aria-disabled={principalOpen !== true ? "true" : undefined}
                      sx={{
                        ...getCellSx(idx),
                        borderRadius: 1.2,
                        userSelect: "none",
                        cursor: principalOpen !== true ? "not-allowed" : sold ? "not-allowed" : "pointer",
                        aspectRatio: "1 / 1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontVariantNumeric: "tabular-nums",
                        position: "relative", // overlays
                      }}
                    >
                      {/* Número central (esconde no mobile se vendido, para não duplicar) */}
                      <Box
                        component="span"
                        sx={{
                          display: { xs: showSoldOverlay ? "none" : "inline", md: "inline" },
                        }}
                      >
                        {closedInitials || pad2(idx)}
                      </Box>

                      {/* >>> MOBILE (xs): NÚMERO EM CIMA + INICIAIS EMBAIXO, centralizados */}
                      {showSoldOverlay && (
                        <Box
                          sx={{
                            display: { xs: "flex", md: "none" },
                            position: "absolute",
                            inset: 0,
                            alignItems: "center",
                            justifyContent: "center",
                            flexDirection: "column",
                            gap: 0.25,
                            pointerEvents: "none",
                          }}
                        >
                          <Box sx={{ fontWeight: 900, lineHeight: 1 }}>
                            {pad2(idx)}
                          </Box>
                          {initials && (
                            <Box
                              sx={{
                                mt: 0.25,
                                px: 0.5,
                                py: 0.1,
                                borderRadius: 0.75,
                                fontSize: 10,
                                fontWeight: 900,
                                lineHeight: 1,
                                backgroundColor: "rgba(0,0,0,0.45)",
                                color: "#fff",
                                letterSpacing: 0.5,
                              }}
                            >
                              {initials}
                            </Box>
                          )}
                        </Box>
                      )}

                      {/* >>> DESKTOP (md+): iniciais no canto inferior direito quando vendido */}
                      {showSoldOverlay && initials && (
                        <Box
                          sx={{
                            display: { xs: "none", md: "block" },
                            position: "absolute",
                            right: 4,
                            bottom: 4,
                            px: 0.5,
                            py: 0.1,
                            borderRadius: 0.75,
                            fontSize: 10,
                            fontWeight: 900,
                            lineHeight: 1,
                            backgroundColor: "rgba(0,0,0,0.45)",
                            color: "#fff",
                            letterSpacing: 0.5,
                            pointerEvents: "none",
                            zIndex: 2,
                          }}
                        >
                          {initials}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>

            {/* >>>>> LINHA INFERIOR (apenas texto adicionado) */}
            <Box sx={{ mt: 2.5, textAlign: "center" }}>
              {(() => {
                const d = new Date();
                d.setDate(d.getDate() + 7);
                const dia = String(d.getDate()).padStart(2, "0");
                return (
                  <Typography variant="subtitle1" sx={{ opacity: 0.95, fontWeight: 800 }}>
                    📅 Utilizaremos o sorteio do dia <strong>{dia}</strong> ou o
                    primeiro sorteio da <strong>Lotomania</strong> após a tabela fechada. 🎯
                  </Typography>
                );
              })()}
            </Box>
          </Paper>
          {/* === FIM CARTELA === */}

          {additionalLoading && (
            <Alert severity="info" sx={{ bgcolor: "rgba(2,136,209,0.12)" }}>
              Carregando sorteios adicionais...
            </Alert>
          )}

          {!additionalLoading && additionalDraws.length === 0 && (
            <Alert severity="info" sx={{ bgcolor: "rgba(2,136,209,0.12)" }}>
              Nenhum sorteio adicional aberto no momento.
            </Alert>
          )}

          {additionalDraws.map((additionalDraw) => {
            const drawId = additionalDraw.id;
            const selectedNumbers = selectedAdditionalNumbersByDrawId[drawId] || [];
            const loadingNumbers =
              !!additionalLoadingByDrawId[drawId] ||
              !!additionalNumbersLoadingByDrawId[drawId];
            const reserveLoading = !!additionalReserveLoadingByDrawId[drawId];
            const pixLoading = !!additionalPixLoadingByDrawId[drawId];
            const isAdditionalPixLoadingThisDraw = reserveLoading || pixLoading;
            const banner =
              additionalDraw.banner_title ||
              additionalDraw.product_name ||
              additionalDraw.promo_phrase ||
              "SORTEIO ADICIONAL";
            const priceCents = Number(
              additionalDraw.ticket_price_cents ??
                additionalDraw.price_cents ??
                additionalDraw.quota_price_cents ??
                0
            );
            const maxNumbers = Number(
              additionalDraw.max_numbers_per_selection ??
                additionalDraw.max_tickets ??
                0
            );

            return (
              <React.Fragment key={drawId}>
                <Box
                  sx={{
                    py: { xs: 1, md: 1.5 },
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                  }}
                >
                  <Divider sx={{ flex: 1, borderColor: "rgba(255,255,255,0.12)" }} />
                  <Typography
                    variant="caption"
                    sx={{ color: "rgba(255,255,255,0.58)", fontWeight: 800 }}
                  >
                    SORTEIO ADICIONAL
                  </Typography>
                  <Divider sx={{ flex: 1, borderColor: "rgba(255,255,255,0.12)" }} />
                </Box>

                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 1.5, md: 3 },
                    bgcolor: "background.paper",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <Stack spacing={2}>
                    <Box
                      sx={{
                        mb: 2,
                        p: { xs: 1.25, md: 1.5 },
                        borderRadius: 2,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background:
                          "linear-gradient(90deg, rgba(103,194,58,0.12), rgba(255,193,7,0.10))",
                      }}
                    >
                      <Typography
                        variant="h4"
                        sx={{
                          fontWeight: 900,
                          textAlign: "center",
                          letterSpacing: 1,
                          background: "linear-gradient(90deg, #67C23A, #FFC107)",
                          WebkitBackgroundClip: "text",
                          backgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          textShadow: "0 0 12px rgba(103,194,58,0.18)",
                        }}
                      >
                        {banner}
                      </Typography>
                    </Box>

                    {additionalErrorByDrawId[drawId] && (
                      <Alert severity="error" sx={{ bgcolor: "rgba(211,47,47,0.12)" }}>
                        <Stack spacing={1}>
                          <span>{additionalErrorByDrawId[drawId]}</span>
                          {additionalErrorByDrawId[drawId] === ADDITIONAL_LOGIN_REQUIRED_MESSAGE ? (
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              <Button
                                size="small"
                                variant="contained"
                                color="success"
                                onClick={() => navigate("/login", { state: { from: "/" } })}
                              >
                                Entrar
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="inherit"
                                onClick={() => navigate("/cadastro", { state: { from: "/" } })}
                              >
                                Criar conta
                              </Button>
                            </Stack>
                          ) : null}
                        </Stack>
                      </Alert>
                    )}

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label="DISPONÍVEL" sx={{ bgcolor: "primary.main", color: "#0E0E0E", fontWeight: 700 }} />
                      <Chip size="small" label="RESERVADO" sx={{ bgcolor: "rgba(255,193,7,0.18)", border: "1px solid", borderColor: "secondary.main", color: "secondary.main", fontWeight: 700 }} />
                      <Chip size="small" label="INDISPONÍVEL" sx={{ bgcolor: "rgba(211,47,47,0.18)", border: "1px solid", borderColor: "error.main", color: "error.main", fontWeight: 700 }} />
                    </Stack>

                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1.5}
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{ mb: 2 }}
                    >
                      <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        {selectedNumbers.length
                          ? `${selectedNumbers.length} selecionado(s) - ${formatSecondaryMoney(selectedNumbers.length * priceCents)}`
                          : maxNumbers > 0
                          ? `Até ${maxNumbers} número(s) por seleção`
                          : " "}
                      </Typography>
                      <Stack direction="row" spacing={1.5}>
                        <Button
                          variant="outlined"
                          color="inherit"
                          disabled={!selectedNumbers.length || isAdditionalPixLoadingThisDraw}
                          onClick={() =>
                            setSelectedAdditionalNumbersByDrawId((prev) => ({
                              ...prev,
                              [drawId]: [],
                            }))
                          }
                        >
                          LIMPAR SELEÇÃO
                        </Button>
                        <Button
                          variant="contained"
                          color="success"
                          disabled={!selectedNumbers.length || isAdditionalPixLoadingThisDraw}
                          onClick={() => handleContinueAdditional(additionalDraw)}
                        >
                          CONTINUAR
                        </Button>
                      </Stack>
                    </Stack>

                    <Box
                      sx={{
                        width: { xs: "calc(100vw - 32px)", sm: "calc(100vw - 64px)", md: "100%" },
                        maxWidth: 640,
                        aspectRatio: "1 / 1",
                        mx: "auto",
                        opacity: loadingNumbers ? 0.72 : 1,
                        pointerEvents: isAdditionalPixLoadingThisDraw ? "none" : "auto",
                        cursor: isAdditionalPixLoadingThisDraw ? "not-allowed" : "auto",
                      }}
                    >
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
                          gridTemplateRows: "repeat(10, minmax(0, 1fr))",
                          gap: { xs: 1, md: 1.2 },
                          height: "100%",
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      >
                        {secondaryPreviewNumbers.map((number) => {
                          const status = getAdditionalNumberStatus(drawId, number);
                          const selected = isAdditionalSelected(drawId, number);
                          const sold = status === "sold";
                          const initials = getAdditionalNumberInitials(drawId, number);
                          return (
                            <Box
                              component="button"
                              type="button"
                              key={number}
                              disabled={status !== "available" && !selected}
                              aria-pressed={selected ? "true" : "false"}
                              onClick={() => handleAdditionalNumberClick(drawId, number)}
                              sx={{
                                ...getAdditionalCellSx(drawId, number),
                                borderRadius: 1.2,
                                userSelect: "none",
                                cursor:
                                  status !== "available" && !selected
                                    ? "not-allowed"
                                    : "pointer",
                                aspectRatio: "1 / 1",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 800,
                                fontVariantNumeric: "tabular-nums",
                                position: "relative",
                                p: 0,
                              }}
                            >
                              {renderNumberContent({
                                number,
                                initials,
                                sold,
                              })}
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>

                    {additionalNoticeByDrawId[drawId] && (
                      <Alert severity="warning" sx={{ bgcolor: "rgba(255,193,7,0.10)" }}>
                        {additionalNoticeByDrawId[drawId]}
                      </Alert>
                    )}
                  </Stack>

                  {renderPixLoadingOverlay({
                    open: isAdditionalPixLoadingThisDraw,
                    title: "Pagamento via PIX",
                  })}
                </Paper>
              </React.Fragment>
            );
          })}

          <Box
            sx={{
              py: { xs: 1, md: 1.5 },
              display: "none",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Divider sx={{ flex: 1, borderColor: "rgba(255,255,255,0.12)" }} />
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.58)", fontWeight: 800 }}
            >
              RODADA EXTRA
            </Typography>
            <Divider sx={{ flex: 1, borderColor: "rgba(255,255,255,0.12)" }} />
          </Box>

          <Paper
            variant="outlined"
            sx={{
              display: "none",
              p: { xs: 1.5, md: 3 },
              bgcolor: "background.paper",
            }}
          >
            <Stack spacing={2}>
              <Box
                sx={{
                  mb: 2,
                  p: { xs: 1.25, md: 1.5 },
                  borderRadius: 2,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background:
                    "linear-gradient(90deg, rgba(103,194,58,0.12), rgba(255,193,7,0.10))",
                }}
              >
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 900,
                    textAlign: "center",
                    letterSpacing: 1,
                    background: "linear-gradient(90deg, #67C23A, #FFC107)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    textShadow: "0 0 12px rgba(103,194,58,0.18)",
                  }}
                >
                  {secondaryBannerTitle}
                </Typography>
                <Stack spacing={0.8} sx={{ display: "none" }}>
                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 900,
                      textAlign: "center",
                      letterSpacing: 1,
                      background: "linear-gradient(90deg, #67C23A, #FFC107)",
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      textShadow: "0 0 12px rgba(103,194,58,0.18)",
                    }}
                  >
                    SORTEIO SECUNDÁRIO
                  </Typography>
                  <Typography
                    variant="subtitle1"
                    sx={{
                      color: "rgba(255,255,255,0.78)",
                      textAlign: { xs: "left", md: "center" },
                    }}
                  >
                    Selecione uma cota da rodada extra sem alterar o sorteio principal.
                  </Typography>
                </Stack>
              </Box>

              {secondaryLoading && (
                <Alert severity="info" sx={{ bgcolor: "rgba(2,136,209,0.12)" }}>
                  Carregando sorteio secundário...
                </Alert>
              )}

              {!secondaryLoading && !secondaryDraw && !secondaryError && (
                <Alert severity="info" sx={{ bgcolor: "rgba(2,136,209,0.12)" }}>
                  Sorteio secundário em preparação.
                </Alert>
              )}

              {secondaryError && (
                <Alert severity="error" sx={{ bgcolor: "rgba(211,47,47,0.12)" }}>
                  {secondaryError}
                </Alert>
              )}

              <Paper
                variant="outlined"
                sx={{
                  display: "none",
                  p: { xs: 1.5, md: 2 },
                  bgcolor: "rgba(255,255,255,0.035)",
                  borderColor: "rgba(255,255,255,0.10)",
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.2}
                  sx={{ justifyContent: "space-between" }}
                >
                  <Typography variant="body1">
                    <strong>Prêmio:</strong> {secondaryPrizeLabel}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Valor da cota:</strong> {secondaryQuotaLabel}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Status:</strong> {secondaryStatusLabel}
                  </Typography>
                  <Typography variant="body1">
                    <strong>Números disponíveis:</strong> {secondaryAvailableLabel}
                  </Typography>
                </Stack>
              </Paper>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip
                  size="small"
                  label="DISPONÍVEL"
                  sx={{ bgcolor: "primary.main", color: "#0E0E0E", fontWeight: 700 }}
                />
                <Chip
                  size="small"
                  label="RESERVADO"
                  sx={{
                    bgcolor: "rgba(255,193,7,0.18)",
                    border: "1px solid",
                    borderColor: "secondary.main",
                    color: "secondary.main",
                    fontWeight: 700,
                  }}
                />
                <Chip
                  size="small"
                  label="INDISPONÍVEL"
                  sx={{
                    bgcolor: "rgba(211,47,47,0.18)",
                    border: "1px solid",
                    borderColor: "error.main",
                    color: "error.main",
                    fontWeight: 700,
                  }}
                />
                <Chip
                  size="small"
                  label="BLOQUEADO"
                  sx={{
                    display: "none",
                    bgcolor: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.16)",
                    color: "rgba(255,255,255,0.58)",
                    fontWeight: 700,
                  }}
                />
              </Stack>

              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={1.5}
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 2 }}
              >
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  {!!selectedSecondaryNumbers.length
                    ? `${selectedSecondaryNumbers.length} selecionado(s)`
                    : " "}
                </Typography>
                <Stack direction="row" spacing={1.5}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    disabled={!selectedSecondaryNumbers.length || secondaryReserveLoading || secondaryPixLoading}
                    onClick={() => setSelectedSecondaryNumbers([])}
                  >
                    LIMPAR SELEÇÃO
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    disabled={
                      !secondaryDraw ||
                      !selectedSecondaryNumbers.length ||
                      secondaryReserveLoading ||
                      secondaryPixLoading
                    }
                    onClick={handleContinueSecondary}
                  >
                    CONTINUAR
                  </Button>
                </Stack>
              </Stack>

              <Box
                sx={{
                  width: "100%",
                  mx: "auto",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  opacity: secondaryNumbersLoading ? 0.72 : 1,
                }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "repeat(5, 56px)",
                      sm: "repeat(10, 56px)",
                      md: "repeat(10, 64px)",
                    },
                    gap: {
                      xs: "10px",
                      sm: "12px",
                    },
                    justifyContent: "center",
                    alignItems: "center",
                    width: "fit-content",
                    maxWidth: "100%",
                    mx: "auto",
                    boxSizing: "border-box",
                  }}
                >
                  {secondaryPreviewNumbers.map((secondaryNumber) => {
                    const status = getSecondaryNumberStatus(secondaryNumber);
                    const selected = isSecondarySelected(secondaryNumber);
                    return (
                      <Box
                        component="button"
                        type="button"
                        key={secondaryNumber}
                        disabled={status !== "available" && !selected}
                        aria-pressed={selected ? "true" : "false"}
                        onClick={() => handleSecondaryNumberClick(secondaryNumber)}
                        sx={{
                          ...getSecondaryCellSx(secondaryNumber),
                          borderRadius: 1.2,
                          aspectRatio: "1 / 1",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontVariantNumeric: "tabular-nums",
                          fontSize: { xs: 12, sm: 14, md: 16 },
                          p: 0,
                          userSelect: "none",
                          transition: "filter 120ms ease, border-color 120ms ease",
                          "&:disabled": {
                            pointerEvents: "none",
                          },
                        }}
                      >
                        {pad2(secondaryNumber)}
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              <Paper
                variant="outlined"
                sx={{
                  display: "none",
                  p: { xs: 1.5, md: 2 },
                  bgcolor: "rgba(255,255,255,0.035)",
                  borderColor: "rgba(255,255,255,0.10)",
                }}
              >
                <Stack spacing={1.5}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.5}
                    alignItems={{ xs: "stretch", md: "center" }}
                    justifyContent="space-between"
                  >
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 800 }}>
                        {selectedSecondaryNumbers.length} número(s) selecionado(s)
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.78 }}>
                        Total secundário: <strong>{secondaryTotalLabel}</strong>
                      </Typography>
                    </Box>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button
                        variant="outlined"
                        color="inherit"
                        disabled={!selectedSecondaryNumbers.length || secondaryReserveLoading}
                        onClick={() => setSelectedSecondaryNumbers([])}
                      >
                        Limpar secundário
                      </Button>
                      <Button
                        variant="contained"
                        color="success"
                        disabled={
                          !secondaryDraw ||
                          !selectedSecondaryNumbers.length ||
                          secondaryReserveLoading
                        }
                        onClick={handleReserveSecondaryNumbers}
                      >
                        {secondaryReserveLoading
                          ? "Reservando..."
                          : "Reservar números do sorteio secundário"}
                      </Button>
                    </Stack>
                  </Stack>

                  {secondaryReservationId && (
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={1.5}
                      alignItems={{ xs: "stretch", md: "center" }}
                      justifyContent="space-between"
                    >
                      <Typography variant="body2" sx={{ opacity: 0.82 }}>
                        Reserva secundária pronta para pagamento.
                      </Typography>
                      <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<PixIcon />}
                        disabled={secondaryPixLoading}
                        onClick={handleSecondaryPix}
                      >
                        {secondaryPixLoading ? "Gerando PIX..." : "Gerar PIX do secundário"}
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Paper>

              {secondaryNotice && (
                <Alert severity="warning" sx={{ bgcolor: "rgba(255,193,7,0.10)" }}>
                  {secondaryNotice}
                </Alert>
              )}
            </Stack>
          </Paper>

          {/* Demais seções */}
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={1.5}>

              <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
  <Stack spacing={1.2}>
    <Box
              sx={{
                mb: 2,
                p: { xs: 1.25, md: 1.5 },
                borderRadius: 2,
                border: "1px solid rgba(255,255,255,0.12)",
                background:
                  "linear-gradient(90deg, rgba(103,194,58,0.12), rgba(255,193,7,0.10))",
              }}
            >
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 900,
                  textAlign: "center",
                  letterSpacing: 1,
                  background: "linear-gradient(90deg, #67C23A, #FFC107)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  textShadow: "0 0 12px rgba(103,194,58,0.18)",
                }}
              >
               Como Funciona Seu Cartão Presente Digital
              </Typography>
            </Box>
              <Typography variant="body1">
      Cada participação que você faz se transforma em crédito no seu Cartão Presente Digital, acumulando automaticamente o valor investido.
      A validade do saldo é de 6 meses, sendo renovada a cada nova participação.
    </Typography>
      <Typography variant="body1">
      • Saldo acumulativo em um único cartão
    </Typography>

    <Typography variant="body1">
      • Validade renovada automaticamente
    </Typography>

    <Typography variant="body1">
      • Uso exclusivo no site da New Store Relógios
    </Typography>

    <Typography variant="body1">
      • Código pessoal e intransferível
    </Typography>
    <Typography variant="body1">
      • Crédito perfeito para planejar a compra do seu próximo relógio
    </Typography>
    <Typography variant="body1">
      <strong>Dica:</strong> É a maneira mais inteligente de participar, enquanto concorre, você acumula crédito para usar quando quiser.
    </Typography>
  </Stack>
</Paper>

             
              <Box
                component="img"
                src={imgCardExemplo}
                alt="Cartão presente - exemplo"
                sx={{ width: "100%", maxWidth: 800, mx: "auto", display: "block", borderRadius: 2 }}
              />
             
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={1.2}>
              <Typography variant="h6" fontWeight={800}>
                Informações do sorteio
              </Typography>
              <Typography variant="body1">
                • A vaga só é confirmada após a compensação do pagamento.
              </Typography>
              <Typography variant="body1">
                • O sorteio é realizado assim que todos os números são vendidos.
              </Typography>
              <Typography variant="body1">
                • O ganhador é o participante com o último número sorteado pela Lotomania.
              </Typography>
              <Typography variant="body1">
                • Prazo máximo: 7 dias após abertura da rodada.
              </Typography>
              <Typography variant="body1">
                • Envio do prêmio: frete por conta do vencedor.
              </Typography>
              <Typography variant="body1">
                • O Cartão Presente não é cumulativo com o prêmio nem com outras promoções do site.
              </Typography>
              <Typography variant="body1">
                Transparência total: o resultado pode ser conferido publicamente no site oficial da Caixa Econômica Federal.
              </Typography>
              
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
              <Typography variant="h5" fontWeight={900}>
                Regras para utilização dos <Box component="span" sx={{ opacity: 0.85 }}>cartões presente</Box>
              </Typography>
              <Stack component="ul" sx={{ pl: 3, m: 0 }} spacing={1}>
                <Typography component="li">Uso exclusivo no site da <strong>New Store Relógios.</strong></Typography>
                <Typography component="li">
                  Não é possível comprar outro cartão-presente com crédito de sorteio.
                </Typography>
                <Typography component="li">Sem conversão em dinheiro.</Typography>
               <Typography component="li">
                  Utilização em uma única compra, na compra de diversos produtos e também é possível usar somente parte do valor acumulado. 
                  <Link
                    href="https://chat.whatsapp.com/GdosYmyW2Jj1mDXNDTFt6F"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {" "}Solicitar no grupo
                  </Link>
                </Typography>
                
                <Typography component="li">Validade: <strong>6 meses</strong>, renovável automaticamente a cada participação..</Typography>
                <Typography component="li">
                  A New Store não se responsabiliza por perda, extravio ou validade expirada.
                </Typography>
                <Typography component="li">
                  O cartão não é cumulativo com outros cupons de desconto.
                </Typography>
                
              </Stack>
               {/* IMAGEM RETIRADA PARA DAR LUGAR AO SIMULADOR 
              <Box
                component="img"
                src={imgTabelaUtilizacao}
                alt="Tabela para utilização do cartão presente"
                sx={{ width: "100%", maxWidth: 900, mx: "auto", display: "block", borderRadius: 2, mt: 1 }}
              />
               FIM COMENTÁRIO */}
              <Typography align="center" sx={{ mt: 1.5, fontWeight: 700, letterSpacing: 1 }}>
                Sempre considerar o valor integral do produto na forma de pagamento escolhida (Pix ou crédito).
              </Typography>
             
            </Stack>
          </Paper>

          <GiftCardSimulator
        productName="Relógio Tissot PRX Powermatic 80"
        creditPriceDefault={6799.99}
        pixPriceDefault={5779.99}
        giftBalanceDefault={800}
      />


           <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mt: 2 }}>
  <Stack spacing={2}>
    {/* Exemplo Prático */}
    <Typography variant="h6">⌚ Exemplo Prático</Typography>

    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
      Relógio Tissot PRX Powermatic 80
    </Typography>

    <Divider />

    {/* Crédito */}
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <CreditCardOutlinedIcon fontSize="small" />
        <Chip size="small" label="Compra no crédito" />
      </Stack>
      <List dense disablePadding>
        <ListItem disableGutters>
          <ListItemText primary="Valor no crédito: R$ 6.799,99" />
        </ListItem>
        <ListItem disableGutters>
          <ListItemText primary="→ Pode usar até R$ 800,00 do cartão presente" />
        </ListItem>
        <ListItem disableGutters>
          <ListItemText primary="→ Valor final: R$ 5.999,99 (parcelado em até 12x sem juros)" />
        </ListItem>
      </List>
    </Stack>

    <Divider />

    {/* Pix */}
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <PixIcon fontSize="small" />
        <Chip size="small" color="success" label="À vista (Pix)" />
      </Stack>
      <List dense disablePadding>
        <ListItem disableGutters>
          <ListItemText primary="Valor à vista (Pix): R$ 5.779,99" />
        </ListItem>
        <ListItem disableGutters>
          <ListItemText primary="→ Pode aplicar os mesmos R$ 800,00" />
        </ListItem>
        <ListItem disableGutters>
          <ListItemText primary="→ Valor final: R$ 4.979,99" />
        </ListItem>
      </List>
    </Stack>

    <Alert severity="info" icon={<HelpOutlineOutlinedIcon />}>
      <Typography variant="body2">
        <strong>Importante:</strong> o desconto sempre acompanha a forma de pagamento.
        Compras via Pix devem ter o desconto aplicado <strong>manualmente</strong> pela equipe da loja.
      </Typography>
    </Alert>

    <Divider sx={{ my: 1 }} />

    {/* FAQ */}
    <Typography variant="h6">❓ Perguntas Frequentes (FAQ)</Typography>

    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>1. Como funciona o sorteio?</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2">
          Baseado no resultado oficial da Lotomania. O ganhador é quem possui o último número sorteado.
        </Typography>
      </AccordionDetails>
    </Accordion>

    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>2. Quando o sorteio acontece?</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2">Assim que todos os números são vendidos.</Typography>
      </AccordionDetails>
    </Accordion>

    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>3. O que ganho ao participar?</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2">
          Você concorre ao prêmio e ainda recebe o valor investido de volta em créditos no site.
        </Typography>
      </AccordionDetails>
    </Accordion>

    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>4. Onde posso usar meu cartão presente?</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2">
          Somente no site da New Store Relógios, em qualquer produto disponível no site (respeitando a tabela).
        </Typography>
      </AccordionDetails>
    </Accordion>

    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>5. Posso transferir meu crédito?</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2">
          Não. O cartão é pessoal, intransferível e sem conversão em dinheiro.
        </Typography>
      </AccordionDetails>
    </Accordion>

    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>6. O prêmio inclui o frete?</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2">Não. O custo de envio é por conta do vencedor.</Typography>
      </AccordionDetails>
    </Accordion>

    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>7. Onde acompanho os resultados e novas rodadas?</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2">
          No grupo oficial da New Store Relógios no WhatsApp.
        </Typography>
      </AccordionDetails>
    </Accordion>

    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>8. Posso usar somente uma parte do meu saldo acumulado?</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2">
          Sim, você pode desmembrar o seu cartão presente e usar somente uma parte do seu saldo.
        </Typography>
      </AccordionDetails>
    </Accordion>

    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>9. Posso comprar mais de 1 produto usando meus créditos?</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography variant="body2">
          Sim, você pode escolher diversos produtos no site para aplicar seu desconto.
          Basta seguir a tabela de utilização dos cartões presente.
        </Typography>
      </AccordionDetails>
    </Accordion>
  </Stack>
</Paper>



          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={1.5}>
              <Typography>
                Dica: A cada participação o valor investido se soma ao 
                valor investido no sorteio anterior e sua validade é automaticamente renovada.

              </Typography>
              <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems="center"
                sx={{ mt: 1 }}
              >
                <Box component="img" src={imgAcumulo1} alt="Exemplo de acúmulo 1" sx={{ width: "100%", maxWidth: 560, borderRadius: 2 }} />
                <Box component="img" src={imgAcumulo2} alt="Exemplo de acúmulo 2" sx={{ width: "100%", maxWidth: 560, borderRadius: 2 }} />
              </Stack>
            </Stack>
          </Paper>

          {/* Convite grupo */}
          <Paper
            variant="outlined"
            sx={{
              p: { xs: 3, md: 4 },
              textAlign: "center",
              bgcolor: "rgba(103, 194, 58, 0.05)",
              borderColor: "primary.main",
            }}
          >
            <Typography variant="h4" fontWeight={900} sx={{ mb: 1 }}>
              Clique no link abaixo e faça parte do <br /> grupo do sorteio!
            </Typography>
            <Typography sx={{ opacity: 0.85, mb: 2 }}>
              Lá você acompanha novidades, abertura de novas rodadas e avisos importantes.
            </Typography>
            <Button
              component="a"
              href={groupUrl}
              target="_blank"
              rel="noopener"
              size="large"
              variant="contained"
              color="success"
              sx={{ px: 4, py: 1.5, fontWeight: 800, letterSpacing: 0.5 }}
            >
              SIM, EU QUERO PARTICIPAR!
            </Button>
          </Paper>
        </Stack>
      </Container>

      {/* Modal de confirmação */}
      <Dialog open={open} onClose={handleFechar} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontSize: 22, fontWeight: 800, textAlign: "center" }}>
          Confirme sua seleção
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center" }}>
          {selecionados.length ? (
            <>
              <Typography variant="body2" sx={{ opacity: 0.85, mb: 1 }}>
                Você selecionou {selecionados.length} {selecionados.length === 1 ? "número" : "números"}:
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 1, mb: 1 }}>
                {selecionados.slice().sort((a, b) => a - b).map(pad2).join(", ")}
              </Typography>
              <Typography variant="body1" sx={{ mt: 0.5, mb: 1 }}>
                Total: <strong>R$ {(selecionados.length * unitPrice).toFixed(2)}</strong>
              </Typography>
              {Number.isFinite(remainingFromServer) && (
                <Typography variant="caption" sx={{ opacity: 0.75 }}>
                  Você ainda pode comprar {Math.max(0, remainingFromServer)} número(s) neste sorteio.
                </Typography>
              )}
            </>
          ) : (
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Nenhum número selecionado.
            </Typography>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            px: 3,
            pb: 3,
            gap: 1.2,
            flexWrap: "wrap",
            flexDirection: { xs: "column", sm: "row" },
            "& > *": { flex: 1 },
          }}
        >
          <Button variant="outlined" onClick={handleFechar} sx={{ py: 1.2, fontWeight: 700 }}>
            SELECIONAR MAIS NÚMEROS
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={() => {
              limparSelecao();
              setOpen(false);
            }}
            disabled={!selecionados.length}
            sx={{ py: 1.2, fontWeight: 700 }}
          >
            LIMPAR SELEÇÃO
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleIrPagamento}
            disabled={continuarDisabled || principalOpen !== true}
            sx={{ py: 1.2, fontWeight: 700 }}
          >
            IR PARA PAGAMENTO
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal PIX (QR) */}
      <PixModal
        open={pixOpen}
        onClose={() => {
          setPixOpen(false);
          setPixApproved(false);
        }}
        loading={pixLoading}
        data={pixData}
        amount={pixAmount}
        onCopy={() => {
          if (pixData) {
            navigator.clipboard.writeText(
              pixData.copy_paste_code || pixData.qr_code || ""
            );
          }
        }}
        onRefresh={async () => {
          if (!pixData?.paymentId) {
            setPixOpen(false);
            return;
          }
          try {
            const st = await checkPixStatus(pixData.paymentId);
            if (st.status === "approved") {
              handlePixApproved();
            } else {
              alert(`Status: ${st.status || "pendente"}`);
            }
          } catch {
            alert("Não foi possível consultar o status agora.");
          }
        }}
      />

      <PixModal
        open={additionalPixOpenDrawId != null}
        onClose={() => setAdditionalPixOpenDrawId(null)}
        loading={
          additionalPixOpenDrawId != null
            ? !!additionalPixLoadingByDrawId[additionalPixOpenDrawId]
            : false
        }
        data={
          additionalPixOpenDrawId != null
            ? additionalPaymentByDrawId[additionalPixOpenDrawId]
            : null
        }
        amount={(() => {
          const payment = additionalPaymentByDrawId[additionalPixOpenDrawId] || {};
          const paymentAmountCents = Number(payment.amount_cents);
          if (Number.isFinite(paymentAmountCents) && paymentAmountCents > 0) {
            return paymentAmountCents / 100;
          }
          const paymentAmount = Number(payment.amount);
          if (Number.isFinite(paymentAmount) && paymentAmount > 0) {
            return paymentAmount;
          }
          const draw = additionalDraws.find((item) => item.id === additionalPixOpenDrawId);
          const reservation = additionalReservationsByDrawId[additionalPixOpenDrawId] || {};
          const numbers = reservation.numbers || reservation.reserved_numbers || [];
          const cents = Number(draw?.ticket_price_cents ?? draw?.price_cents ?? 0);
          return numbers.length * (cents / 100);
        })()}
        inlineMessage={additionalPixOpenDrawId != null ? additionalPixMessageByDrawId[additionalPixOpenDrawId] || ADDITIONAL_PIX_PENDING_MESSAGE : ADDITIONAL_PIX_PENDING_MESSAGE}
        onCopy={() => {
          const payment = additionalPaymentByDrawId[additionalPixOpenDrawId];
          if (payment) {
            navigator.clipboard.writeText(payment.copy_paste_code || payment.qr_code || "");
          }
        }}
        onRefresh={async () => {
          const drawId = additionalPixOpenDrawId;
          const payment = additionalPaymentByDrawId[drawId];
          const paymentId = payment?.paymentId ?? payment?.payment_id ?? payment?.id;
          if (!drawId || !paymentId) return;
          try {
            const statusPayload = await checkAdditionalPixStatus(paymentId);
            const nextStatus = String(statusPayload?.status || "pending").toLowerCase();
            setAdditionalPixStatusByDrawId((prev) => (prev[drawId] === nextStatus ? prev : { ...prev, [drawId]: nextStatus }));
            if (statusPayload?.paid || ADDITIONAL_PIX_PAID_STATUSES.has(nextStatus)) {
              await handleAdditionalPixApproved(drawId);
            } else if (ADDITIONAL_PIX_FINAL_ERROR_STATUSES.has(nextStatus)) {
              setAdditionalPixMessageByDrawId((prev) => ({ ...prev, [drawId]: ADDITIONAL_PIX_FAILED_MESSAGE }));
            } else {
              setAdditionalPixMessageByDrawId((prev) => ({ ...prev, [drawId]: ADDITIONAL_PIX_PENDING_MESSAGE }));
            }
          } catch {
            setAdditionalPixMessageByDrawId((prev) => ({ ...prev, [drawId]: ADDITIONAL_PIX_FAILED_MESSAGE }));
          }
        }}
      />

      <PixModal
        open={secondaryPixOpen}
        onClose={() => setSecondaryPixOpen(false)}
        loading={secondaryPixLoading}
        data={secondaryPayment}
        amount={secondaryReservationAmount}
        inlineMessage="PIX do sorteio secundário."
        onCopy={() => {
          if (secondaryPayment) {
            navigator.clipboard.writeText(
              secondaryPayment.copy_paste_code || secondaryPayment.qr_code || ""
            );
          }
        }}
        onRefresh={() => {
          alert("A confirmação do PIX secundário será processada pelo backend.");
        }}
      />

      {/* Modal de sucesso do PIX */}
      <Dialog open={pixApproved} onClose={() => setPixApproved(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontSize: 22, fontWeight: 900, textAlign: "center" }}>
          Pagamento confirmado! 🎉
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center" }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
            Seus números foram reservados.
          </Typography>
          <Typography sx={{ opacity: 0.9 }}>
            Boa sorte! Você pode acompanhar tudo na <strong>Área do cliente</strong>.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button fullWidth variant="contained" color="success" onClick={() => setPixApproved(false)} sx={{ py: 1.2, fontWeight: 800 }}>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: limite atingido */}
      <Dialog open={limitOpen} onClose={() => setLimitOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontSize: 20, fontWeight: 900, textAlign: "center" }}>
          {limitInfo?.type === "selection"
            ? `Você pode selecionar no máximo ${maxSelect} números`
            : "Número máximo de compras por usuário atingido"}
        </DialogTitle>
        <DialogContent sx={{ textAlign: "center" }}>
          <Typography sx={{ opacity: 0.9 }}>
            {limitInfo?.type === "selection"
              ? "Para continuar, remova um número antes de adicionar outro."
              : "Você já alcançou o limite de números neste sorteio."}
          </Typography>
          {(Number.isFinite(limitInfo?.current) || Number.isFinite(limitInfo?.max)) && (
            <Typography sx={{ mt: 1, fontWeight: 700 }}>
              ({limitInfo?.current ?? "-"} de {limitInfo?.max ?? "-"})
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button fullWidth variant="contained" onClick={() => setLimitOpen(false)} sx={{ py: 1.1, fontWeight: 800 }}>
            OK
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
