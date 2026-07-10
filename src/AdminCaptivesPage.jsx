import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert, AppBar, Box, Button, Chip, CircularProgress, Container, CssBaseline,
  Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Tab, Tabs, TextField, ThemeProvider, Toolbar,
  Typography,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import PauseCircleOutlineRoundedIcon from "@mui/icons-material/PauseCircleOutlineRounded";
import PlayCircleOutlineRoundedIcon from "@mui/icons-material/PlayCircleOutlineRounded";
import SwapHorizRoundedIcon from "@mui/icons-material/SwapHorizRounded";
import CreditCardRoundedIcon from "@mui/icons-material/CreditCardRounded";
import { adminPanelPaperSx, createNewStoreAdminTheme, newStoreAdminColors } from "./adminTheme";
import {
  authorizeCurrentDrawCaptiveParticipation,
  isDatabaseMigrationRequiredError,
  listAdminCaptives,
  listCaptiveNotificationHistory,
  listCurrentDrawCaptiveParticipation,
  reissueAndResendCaptivePreauths,
  updateAdminCaptiveAuthorizationMode,
  updateAdminCaptiveParticipation,
  updateCaptivePreauthNotifications,
  updateCurrentDrawCaptiveParticipation,
} from "./services/adminCaptives";

const theme = createNewStoreAdminTheme();
const FILTERS = [
  ["todos", "Todos"],
  ["ativos", "Participando"],
  ["pausados", "Pausados"],
  ["com_whatsapp", "Com WhatsApp"],
  ["sem_whatsapp", "Sem WhatsApp"],
  ["com_cartao", "Com cartão"],
  ["sem_cartao", "Sem cartão"],
];
const HISTORY_STATUS_FILTERS = [
  ["", "Todos os status"],
  ["accepted", "Aceita pela Brevo"],
  ["sent", "Enviada"],
  ["delivered", "Entregue"],
  ["skipped", "Não enviada"],
  ["failed", "Falha"],
];
const HISTORY_TYPE_FILTERS = [
  ["", "Todos os tipos"],
  ["initial", "Envio inicial"],
  ["reissue", "Reemissão"],
  ["manual_activation", "Ativação manual"],
];
const PARTICIPATION_FILTERS = [
  ["all", "Todos"],
  ["enabled", "Ativos neste sorteio"],
  ["disabled", "Desativados neste sorteio"],
  ["pending", "Aguardando confirmação"],
  ["confirmed", "Confirmados"],
  ["failed", "Com falha"],
];

const DEFAULT_CAPTIVE_POLICY = {
  default_amount_cents: 5500,
  default_amount_label: "R$ 55,00",
  variable_pricing_requires_preauth: true,
  automatic_label: "Automático até R$ 55,00",
  preauth_label: "Sempre pedir autorização",
  variable_price_rule_label: "Acima de R$ 55,00, a pré-autorização é obrigatória para todos.",
};

function normalizePolicy(policy) {
  return {
    ...DEFAULT_CAPTIVE_POLICY,
    ...(policy && typeof policy === "object" ? policy : {}),
  };
}

function formatShortAmount(amountCents) {
  const cents = Number(amountCents);
  if (!Number.isFinite(cents) || cents <= 0) return DEFAULT_CAPTIVE_POLICY.default_amount_label.replace(",00", "");
  const value = cents / 100;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function formatAmountBRL(amountCents) {
  const cents = Number(amountCents);
  if (!Number.isInteger(cents) || cents <= 0) return "-";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function StatusChip({ label, tone = "neutral" }) {
  const sx = {
    success: { color: "#061006", bgcolor: newStoreAdminColors.greenStrong },
    neutral: { color: "#F5F7F5", bgcolor: "rgba(255,255,255,0.12)" },
    info: { color: "#fff", bgcolor: "#2563EB" },
    warning: { color: "#141006", bgcolor: "#D6A100" },
    error: { color: "#fff", bgcolor: "#9F2F2D" },
  }[tone];
  return <Chip size="small" label={label} sx={{ fontWeight: 900, ...sx }} />;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function LastRun({ row }) {
  const status = row?.last_run_status;
  if (!status) return <StatusChip label="Sem histórico" />;
  if (status === "approved") return <StatusChip label="Última tentativa aprovada" tone="success" />;
  if (status === "failed") return <StatusChip label="Última tentativa falhou" tone="error" />;
  if (status === "ignored") return <StatusChip label="Última tentativa ignorada" tone="warning" />;
  return <StatusChip label={status === "pending" ? "Última tentativa pendente" : status} />;
}

function notificationStatusLabel(status) {
  return {
    accepted: "Aceita pela Brevo",
    sent: "Enviada",
    delivered: "Entregue",
    skipped: "Não enviada",
    not_sent: "Não enviada",
    failed: "Falha",
  }[status] || status || "Sem envio";
}

function notificationStatusTone(status) {
  if (["accepted", "sent", "delivered"].includes(status)) return "success";
  if (status === "failed") return "error";
  return "warning";
}

function notificationReasonLabel(reason) {
  return {
    whatsapp_consent_missing: "Sem consentimento",
    preauth_notifications_disabled: "Notificações pausadas",
    invalid_phone: "Telefone inválido",
    provider_failed: "Falha no provedor",
    skipped_near_expiration: "Prazo próximo da expiração",
    reservation_unavailable: "Reserva indisponível",
    payment_already_approved: "Participação já confirmada",
    whatsapp_template_missing: "Template indisponível",
    whatsapp_disabled: "WhatsApp desabilitado",
  }[reason] || reason || "-";
}

function attemptTypeLabel(type) {
  return {
    initial: "Envio inicial",
    reissue: "Reemissão",
    manual_activation: "Ativação manual",
  }[type] || type || "-";
}

function authorizationStatusLabel(status, source = null) {
  if (status === "authorized" && source === "admin") return "Confirmado pelo administrador";
  if (status === "authorized" && source === "client") return "Confirmado pelo cliente";
  if (status === "charged" && source === "admin") return "Cobrança concluída — autorização administrativa";
  if (status === "charged" && source === "client") return "Cobrança concluída — confirmação do cliente";
  if (status === "failed" && source === "admin") return "Falha após autorização administrativa";
  return {
    pending: "Aguardando confirmação",
    authorized: "Autorizada",
    charged: "Cobrança confirmada",
    failed: "Falha de cobrança",
    declined: "Recusada pelo cliente",
    expired: "Expirada",
  }[status] || status || "Sem autorização";
}

function participationState(row) {
  const labels = {
    pending: ["Ativo — aguardando confirmação", "warning"],
    confirmed: ["Ativo — cobrança confirmada", "success"],
    confirmed_client: ["Confirmado pelo cliente", "success"],
    confirmed_admin: ["Confirmado pelo administrador", "success"],
    payment_processing: ["Cobrança em processamento", "info"],
    failed_retryable: ["Ativo — cobrança falhou, nova tentativa disponível", "error"],
    failed: ["Falha — reserva indisponível", "error"],
    disabled: ["Desativado pelo administrador", "neutral"],
    declined: ["Recusado pelo cliente", "neutral"],
    expired: ["Expirado", "neutral"],
    authorized: ["Ativo — confirmação registrada", "warning"],
    review_required: ["Revisão necessária", "error"],
    no_authorization: ["Sem autorização criada", "neutral"],
  };
  return labels[row?.participation_state] || labels.no_authorization;
}

export default function AdminCaptivesPage() {
  const navigate = useNavigate();
  const [items, setItems] = React.useState([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(50);
  const [q, setQ] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");
  const [status, setStatus] = React.useState("todos");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [rowError, setRowError] = React.useState("");
  const [updatingId, setUpdatingId] = React.useState("");
  const [tab, setTab] = React.useState("captives");
  const [policy, setPolicy] = React.useState(DEFAULT_CAPTIVE_POLICY);
  const [currentDraw, setCurrentDraw] = React.useState(null);
  const [currentDrawError, setCurrentDrawError] = React.useState("");
  const [reissueLoading, setReissueLoading] = React.useState(false);
  const [reissueError, setReissueError] = React.useState("");
  const [reissueResult, setReissueResult] = React.useState(null);
  const [currentDrawPendingCount, setCurrentDrawPendingCount] = React.useState(0);
  const [currentDrawDisabledCount, setCurrentDrawDisabledCount] = React.useState(0);
  const [historyItems, setHistoryItems] = React.useState([]);
  const [historyTotal, setHistoryTotal] = React.useState(0);
  const [historyPage, setHistoryPage] = React.useState(1);
  const [historyLimit] = React.useState(50);
  const [historyStatus, setHistoryStatus] = React.useState("");
  const [historyAttemptType, setHistoryAttemptType] = React.useState("");
  const [historyDrawId, setHistoryDrawId] = React.useState("");
  const [historySearch, setHistorySearch] = React.useState("");
  const [historyDebouncedSearch, setHistoryDebouncedSearch] = React.useState("");
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState("");
  const [participationItems, setParticipationItems] = React.useState([]);
  const [participationTotal, setParticipationTotal] = React.useState(0);
  const [participationPage, setParticipationPage] = React.useState(1);
  const [participationLimit] = React.useState(50);
  const [participationFilter, setParticipationFilter] = React.useState("all");
  const [participationSearch, setParticipationSearch] = React.useState("");
  const [participationDebouncedSearch, setParticipationDebouncedSearch] = React.useState("");
  const [participationLoading, setParticipationLoading] = React.useState(false);
  const [participationError, setParticipationError] = React.useState("");
  const [participationUpdatingId, setParticipationUpdatingId] = React.useState("");
  const [authorizationDialogItem, setAuthorizationDialogItem] = React.useState(null);
  const [authorizationLoadingId, setAuthorizationLoadingId] = React.useState("");
  const [authorizationError, setAuthorizationError] = React.useState("");
  const [authorizationMessage, setAuthorizationMessage] = React.useState("");

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setHistoryDebouncedSearch(historySearch);
      setHistoryPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [historySearch]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setParticipationDebouncedSearch(participationSearch);
      setParticipationPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [participationSearch]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await listAdminCaptives({ q: debouncedQ, status, page, pageSize });
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setTotal(Number(payload?.total || 0));
      setPolicy(normalizePolicy(payload?.policy));
    } catch {
      setItems([]);
      setTotal(0);
      setPolicy(DEFAULT_CAPTIVE_POLICY);
      setError("Não foi possível carregar os números cativos.");
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, status, page, pageSize]);

  React.useEffect(() => { load(); }, [load]);

  const loadCurrentDraw = React.useCallback(async () => {
    try {
      const payload = await listCurrentDrawCaptiveParticipation({ page: 1, limit: 1 });
      setCurrentDrawError("");
      setCurrentDraw(payload?.draw || null);
      setCurrentDrawPendingCount(Number(payload?.pending_authorizations || 0));
      setCurrentDrawDisabledCount(Number(payload?.disabled_count || 0));
    } catch (error) {
      setCurrentDrawError(isDatabaseMigrationRequiredError(error) ? "migration" : "internal");
    }
  }, []);

  React.useEffect(() => { loadCurrentDraw(); }, [loadCurrentDraw]);

  const loadHistory = React.useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const payload = await listCaptiveNotificationHistory({
        draw_id: historyDrawId,
        status: historyStatus,
        attempt_type: historyAttemptType,
        search: historyDebouncedSearch,
        page: historyPage,
        limit: historyLimit,
      });
      setHistoryItems(Array.isArray(payload?.items) ? payload.items : []);
      setHistoryTotal(Number(payload?.total || 0));
    } catch {
      setHistoryItems([]);
      setHistoryTotal(0);
      setHistoryError("Não foi possível carregar o histórico de mensagens.");
    } finally {
      setHistoryLoading(false);
    }
  }, [historyDrawId, historyStatus, historyAttemptType, historyDebouncedSearch, historyPage, historyLimit]);

  React.useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  const loadParticipation = React.useCallback(async () => {
    setParticipationLoading(true);
    setParticipationError("");
    try {
      const payload = await listCurrentDrawCaptiveParticipation({
        search: participationDebouncedSearch,
        status: participationFilter,
        page: participationPage,
        limit: participationLimit,
      });
      setParticipationItems(Array.isArray(payload?.items) ? payload.items : []);
      setParticipationTotal(Number(payload?.total || 0));
      setCurrentDrawError("");
      setCurrentDraw(payload?.draw || null);
      setCurrentDrawPendingCount(Number(payload?.pending_authorizations || 0));
      setCurrentDrawDisabledCount(Number(payload?.disabled_count || 0));
    } catch (error) {
      setParticipationItems([]);
      setParticipationTotal(0);
      setCurrentDrawError(isDatabaseMigrationRequiredError(error) ? "migration" : "internal");
    } finally {
      setParticipationLoading(false);
    }
  }, [participationDebouncedSearch, participationFilter, participationPage, participationLimit]);

  React.useEffect(() => {
    if (tab === "participation") loadParticipation();
  }, [tab, loadParticipation]);

  async function handleReissueAndResend() {
    if (!currentDraw?.draw_id || reissueLoading) return;
    const confirmed = window.confirm(
      "Esta ação corrigirá os valores das autorizações abertas e realizará uma nova tentativa de WhatsApp somente para clientes autorizados. Nenhuma cobrança será realizada. Deseja continuar?"
    );
    if (!confirmed) return;

    setReissueLoading(true);
    setReissueError("");
    setReissueResult(null);
    try {
      const result = await reissueAndResendCaptivePreauths();
      setReissueResult(result);
      await loadCurrentDraw();
      if (tab === "history") await loadHistory();
      if (tab === "participation") await loadParticipation();
    } catch (error) {
      const message = String(error?.message || "");
      if (message.includes("confirmation_required")) setReissueError("Confirmação administrativa obrigatória.");
      else if (message.includes("captive_preauth_not_required")) setReissueError("O valor atual da cota não exige pré-autorização.");
      else setReissueError("Não foi possível reemitir e reenviar as confirmações pendentes.");
    } finally {
      setReissueLoading(false);
    }
  }

  async function toggleParticipation(row) {
    setUpdatingId(`${row.id}:participation`);
    setRowError("");
    try {
      const payload = await updateAdminCaptiveParticipation(row.id, !row.participation_active);
      if (payload?.item?.id) {
        setItems((current) => current.map((item) => (
          String(item.id) === String(payload.item.id) ? payload.item : item
        )));
      } else {
        await load();
      }
    } catch {
      setRowError("Não foi possível atualizar a participação.");
    } finally {
      setUpdatingId("");
    }
  }

  async function toggleAuthorizationMode(row) {
    const nextMode = row.authorization_mode !== true;
    setUpdatingId(`${row.id}:authorization-mode`);
    setRowError("");
    try {
      const payload = await updateAdminCaptiveAuthorizationMode(row.id, nextMode);
      if (payload?.item?.id) {
        setItems((current) => current.map((item) => (
          String(item.id) === String(payload.item.id) ? payload.item : item
        )));
      } else {
        await load();
      }
    } catch {
      setRowError("Não foi possível atualizar o modo de cobrança.");
    } finally {
      setUpdatingId("");
    }
  }

  async function togglePreauthNotifications(row) {
    const nextEnabled = row.preauth_notifications_enabled !== true;
    const captiveId = row.autopay_number_id || row.id;
    setUpdatingId(`${captiveId}:preauth-notifications`);
    setRowError("");
    try {
      const payload = await updateCaptivePreauthNotifications(captiveId, nextEnabled);
      if (payload?.item?.id) {
        setItems((current) => current.map((item) => (
          String(item.id) === String(payload.item.id) ? payload.item : item
        )));
      } else if (payload?.ok) {
        setItems((current) => current.map((item) => {
          const itemId = item.autopay_number_id || item.id;
          if (String(itemId) !== String(captiveId)) return item;
          return {
            ...item,
            preauth_notifications_enabled: payload.preauth_notifications_enabled === true,
            preauth_notifications_label: payload.preauth_notifications_label || (payload.preauth_notifications_enabled ? "Ativas" : "Pausadas"),
          };
        }));
      } else {
        await load();
      }
    } catch {
      setRowError("Não foi possível atualizar as notificações.");
    } finally {
      setUpdatingId("");
    }
  }

  async function toggleCurrentDrawParticipation(row) {
    const nextEnabled = row.enabled_current_draw !== true;
    const reason = window.prompt(
      nextEnabled
        ? "Informe o motivo da ativação neste sorteio:"
        : "Informe o motivo da desativação neste sorteio:"
    );
    if (reason == null) return;
    if (!String(reason).trim()) {
      setParticipationError("Informe um motivo para concluir a alteração.");
      return;
    }
    const confirmed = window.confirm(
      nextEnabled
        ? "Ativar este número somente no sorteio principal atual? Nenhuma cobrança será realizada."
        : "Desativar este número somente no sorteio principal atual? A confirmação aberta será encerrada e a reserva da rodada será liberada."
    );
    if (!confirmed || participationUpdatingId) return;

    const captiveId = row.autopay_number_id;
    setParticipationUpdatingId(captiveId);
    setParticipationError("");
    try {
      const payload = await updateCurrentDrawCaptiveParticipation(captiveId, nextEnabled, reason);
      const updatedItem = payload?.item;
      if (updatedItem?.autopay_number_id) {
        await loadParticipation();
      }
    } catch (error) {
      const message = String(error?.message || "");
      if (message.includes("participation_already_confirmed")) {
        setParticipationError("A participação já foi confirmada e não pode ser desativada nesta tela.");
      } else if (message.includes("captive_preauth_not_required")) {
        setParticipationError("Este sorteio utiliza o fluxo automático padrão. A ativação manual com pré-autorização não se aplica.");
      } else if (message.includes("participation_declined_by_customer")) {
        setParticipationError("A participação foi recusada pelo cliente e não pode ser reaberta por esta ação.");
      } else if (message.includes("number_not_available")) {
        setParticipationError("O número não está disponível para reserva neste sorteio.");
      } else {
        setParticipationError(`Não foi possível atualizar a participação (${message || "erro desconhecido"}).`);
      }
    } finally {
      setParticipationUpdatingId("");
    }
  }

  function openAdminAuthorization(row) {
    if (!row?.can_admin_authorize || authorizationLoadingId) return;
    setAuthorizationDialogItem(row);
    setAuthorizationError("");
    setAuthorizationMessage("");
  }

  function closeAdminAuthorization() {
    if (authorizationLoadingId) return;
    setAuthorizationDialogItem(null);
    setAuthorizationError("");
  }

  async function handleAdminAuthorization() {
    const group = authorizationDialogItem;
    if (!group?.authorization_id || !currentDraw?.draw_id || authorizationLoadingId) return;
    setAuthorizationLoadingId(group.group_key || group.authorization_id);
    setAuthorizationError("");
    try {
      const result = await authorizeCurrentDrawCaptiveParticipation(group.authorization_id, currentDraw.draw_id);
      await loadParticipation();
      setAuthorizationDialogItem(null);
      const confirmedNumbers = result?.captive_numbers || group.captive_numbers || [];
      const numbers = confirmedNumbers.join(" e ");
      const totalAmount = result?.total_amount_cents ?? group.total_amount_cents;
      setAuthorizationMessage(
        confirmedNumbers.length === 1
          ? `Cobrança única de ${formatAmountBRL(totalAmount)} autorizada. O número ${numbers} foi confirmado.`
          : `Cobrança única de ${formatAmountBRL(totalAmount)} autorizada. Os números ${numbers} foram confirmados.`
      );
    } catch (error) {
      const message = String(error?.message || "");
      if (message.includes("participation_declined_by_customer")) {
        setAuthorizationError("O cliente recusou esta participação. É necessário reabrir a autorização antes de confirmar administrativamente.");
      } else if (message.includes("payment_in_progress")) {
        setAuthorizationError("Já existe uma cobrança em processamento para esta participação.");
      } else if (message.includes("authorization_amount_outdated") || message.includes("authorization_amount_mismatch")) {
        setAuthorizationError("O grupo possui uma autorização com valor diferente do preço atual e precisa de revisão.");
      } else if (message.includes("captive_number_not_available_for_user")) {
        setAuthorizationError("O número cativo não está disponível para este usuário.");
      } else if (message.includes("authorization_expired")) {
        setAuthorizationError("O prazo desta autorização expirou.");
      } else if (message.includes("captive_preauth_not_required")) {
        setAuthorizationError("Este sorteio utiliza o fluxo automático padrão.");
      } else if (message.includes("payment_method_unavailable") || message.includes("authorization_charge_not_configured")) {
        setAuthorizationError("O cliente não possui cartão cadastrado.");
      } else if (message.includes("group_already_partially_or_fully_charged")) {
        setAuthorizationError("O grupo possui uma participação já cobrada e precisa de revisão.");
      } else if (message.includes("group_requires_review") || message.includes("group_changed")) {
        setAuthorizationError("O grupo foi alterado ou possui participações inconsistentes. Atualize e revise os números.");
      } else if (message.includes("payment_failed")) {
        setAuthorizationError(`A cobrança de ${formatAmountBRL(group.total_amount_cents)} não foi aprovada.`);
        await loadParticipation();
      } else if (message.includes("403") || message.includes("401")) {
        setAuthorizationError("Você não possui permissão para executar esta ação.");
      } else {
        setAuthorizationError(`Não foi possível autorizar a cobrança (${message || "erro desconhecido"}).`);
      }
    } finally {
      setAuthorizationLoadingId("");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyLimit));
  const participationTotalPages = Math.max(1, Math.ceil(participationTotal / participationLimit));
  const visiblePage = tab === "history" ? historyPage : tab === "participation" ? participationPage : page;
  const visibleTotalPages = tab === "history" ? historyTotalPages : tab === "participation" ? participationTotalPages : totalPages;
  const visiblePageLoading = tab === "history" ? historyLoading : tab === "participation" ? participationLoading : loading;
  const empty = !loading && !error && items.length === 0;
  const automaticButtonLabel = `Automático até ${formatShortAmount(policy.default_amount_cents)}`;
  const variableRuleLabel = policy.variable_price_rule_label || DEFAULT_CAPTIVE_POLICY.variable_price_rule_label;

  function renderNotificationHistory() {
    return (
      <Box>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", lg: "center" }}
          sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <TextField
            label="Busca por cliente, e-mail ou número"
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
            size="small"
            sx={{ minWidth: { lg: 300 } }}
          />
          <TextField
            label="Sorteio"
            type="number"
            value={historyDrawId}
            onChange={(event) => { setHistoryDrawId(event.target.value); setHistoryPage(1); }}
            size="small"
            inputProps={{ min: 1 }}
            sx={{ width: { lg: 140 } }}
          />
          <TextField
            select
            label="Status"
            value={historyStatus}
            onChange={(event) => { setHistoryStatus(event.target.value); setHistoryPage(1); }}
            size="small"
            sx={{ minWidth: { lg: 190 } }}
          >
            {HISTORY_STATUS_FILTERS.map(([value, label]) => <MenuItem key={value || "all"} value={value}>{label}</MenuItem>)}
          </TextField>
          <TextField
            select
            label="Tipo da tentativa"
            value={historyAttemptType}
            onChange={(event) => { setHistoryAttemptType(event.target.value); setHistoryPage(1); }}
            size="small"
            sx={{ minWidth: { lg: 190 } }}
          >
            {HISTORY_TYPE_FILTERS.map(([value, label]) => <MenuItem key={value || "all"} value={value}>{label}</MenuItem>)}
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 800 }}>
            {historyTotal} tentativa{historyTotal === 1 ? "" : "s"}
          </Typography>
        </Stack>
        <Alert severity="info" variant="outlined" sx={{ m: 2 }}>
          “Aceita pela Brevo” indica que o provedor aceitou a solicitação de envio. Não significa que o cliente confirmou a participação.
        </Alert>
        {historyError && <Alert severity="error" sx={{ mx: 2, mb: 2 }}>{historyError}</Alert>}
        {historyLoading ? (
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 3 }}>
            <CircularProgress size={22} />
            <Typography sx={{ color: "text.secondary" }}>Carregando histórico</Typography>
          </Stack>
        ) : historyItems.length === 0 ? (
          <Typography sx={{ p: 3, color: "text.secondary" }}>
            Nenhuma tentativa de mensagem encontrada para os filtros selecionados.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small" sx={{ minWidth: 1500 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Data e hora</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell>E-mail</TableCell>
                  <TableCell>Telefone</TableCell>
                  <TableCell>Número cativo</TableCell>
                  <TableCell>Sorteio</TableCell>
                  <TableCell>Valor informado</TableCell>
                  <TableCell>Template Brevo</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Status da mensagem</TableCell>
                  <TableCell>Motivo</TableCell>
                  <TableCell>Status da autorização</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historyItems.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{formatDate(row.created_at) || "-"}</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>{row.user_name || "-"}</TableCell>
                    <TableCell>{row.user_email || "-"}</TableCell>
                    <TableCell>{row.user_phone_masked || "-"}</TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>{row.captive_number}</TableCell>
                    <TableCell>#{row.draw_id} — {row.draw_title || "Sorteio"}</TableCell>
                    <TableCell>{formatAmountBRL(row.amount_cents)}</TableCell>
                    <TableCell>{row.template_id || "-"}</TableCell>
                    <TableCell>{attemptTypeLabel(row.attempt_type)}</TableCell>
                    <TableCell>
                      <StatusChip label={notificationStatusLabel(row.status)} tone={notificationStatusTone(row.status)} />
                    </TableCell>
                    <TableCell>{notificationReasonLabel(row.error_code)}</TableCell>
                    <TableCell>{authorizationStatusLabel(row.authorization_status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    );
  }

  function renderCurrentDrawParticipation() {
    if (participationLoading) {
      return (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 3 }}>
          <CircularProgress size={22} />
          <Typography sx={{ color: "text.secondary" }}>Carregando participações</Typography>
        </Stack>
      );
    }
    if (currentDrawError === "migration") {
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          As migrations 023 e 024 precisam ser aplicadas no banco antes de usar esta área.
        </Alert>
      );
    }
    if (currentDrawError === "internal") {
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          Não foi possível carregar a participação do sorteio atual.
        </Alert>
      );
    }
    if (!currentDraw?.draw_id) {
      return <Typography sx={{ p: 3, color: "text.secondary" }}>Nenhum sorteio principal aberto.</Typography>;
    }
    return (
      <Box>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 900 }}>Sorteio principal: #{currentDraw?.draw_id}</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Valor da cota: {formatAmountBRL(currentDraw?.amount_cents)}
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 800, color: "text.secondary" }}>
            Regra: {currentDraw?.preauth_required ? "pré-autorização obrigatória" : "fluxo automático padrão"}
          </Typography>
        </Stack>
        {currentDraw && !currentDraw.preauth_required && (
          <Alert severity="info" variant="outlined" sx={{ m: 2 }}>
            Este sorteio utiliza o fluxo automático padrão. A ativação manual com pré-autorização não se aplica.
          </Alert>
        )}
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          alignItems={{ xs: "stretch", md: "center" }}
          sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <TextField
            label="Busca por nome, e-mail ou número"
            value={participationSearch}
            onChange={(event) => setParticipationSearch(event.target.value)}
            size="small"
            sx={{ minWidth: { md: 340 } }}
          />
          <TextField
            select
            label="Participação"
            value={participationFilter}
            onChange={(event) => { setParticipationFilter(event.target.value); setParticipationPage(1); }}
            size="small"
            sx={{ minWidth: { md: 250 } }}
          >
            {PARTICIPATION_FILTERS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 800 }}>
            {participationTotal} cliente{participationTotal === 1 ? "" : "s"}
          </Typography>
        </Stack>
        {authorizationMessage && <Alert severity="success" sx={{ m: 2 }}>{authorizationMessage}</Alert>}
        {participationError && <Alert severity="error" sx={{ m: 2 }}>{participationError}</Alert>}
        {participationItems.length === 0 ? (
          <Typography sx={{ p: 3, color: "text.secondary" }}>Nenhum número cativo encontrado.</Typography>
        ) : (
          <TableContainer>
            <Table size="small" sx={{ minWidth: 1180 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Cliente</TableCell>
                  <TableCell>E-mail</TableCell>
                  <TableCell>Números cativos</TableCell>
                  <TableCell>Quantidade</TableCell>
                  <TableCell>Valor unitário</TableCell>
                  <TableCell>Valor total</TableCell>
                  <TableCell>Status do grupo</TableCell>
                  <TableCell>Participações</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {participationItems.map((group) => {
                  const [stateLabel, stateTone] = participationState(group);
                  const authorizationUpdating = authorizationLoadingId === (group.group_key || group.authorization_id);
                  return (
                    <TableRow key={group.group_key || `${group.draw_id}:${group.user_id}`} hover>
                      <TableCell sx={{ fontWeight: 800 }}>{group.user_name || "-"}</TableCell>
                      <TableCell>{group.user_email || "-"}</TableCell>
                      <TableCell sx={{ fontWeight: 900 }}>{(group.captive_numbers || []).join(", ") || "-"}</TableCell>
                      <TableCell>{group.quantity || 0}</TableCell>
                      <TableCell>{formatAmountBRL(group.unit_amount_cents)}</TableCell>
                      <TableCell sx={{ fontWeight: 900 }}>{formatAmountBRL(group.total_amount_cents)}</TableCell>
                      <TableCell><StatusChip label={stateLabel} tone={stateTone} /></TableCell>
                      <TableCell>
                        <Stack spacing={0.75} sx={{ minWidth: 280 }}>
                          {(group.items || []).map((item) => {
                            const [itemLabel, itemTone] = participationState(item);
                            const updating = participationUpdatingId === item.autopay_number_id;
                            const protectedParticipation =
                              item.payment_approved === true ||
                              item.payment_in_progress === true ||
                              ["authorized", "charged"].includes(item.authorization_status);
                            return (
                              <Stack
                                key={item.autopay_number_id}
                                direction="row"
                                spacing={1}
                                alignItems="center"
                                justifyContent="space-between"
                              >
                                <Typography variant="body2" sx={{ fontWeight: 900 }}>
                                  Nº {item.captive_number}
                                </Typography>
                                <StatusChip label={itemLabel} tone={itemTone} />
                                <Button
                                  variant="text"
                                  color={item.enabled_current_draw ? "error" : "success"}
                                  size="small"
                                  disabled={updating || authorizationUpdating || protectedParticipation || !currentDraw?.preauth_required}
                                  onClick={() => toggleCurrentDrawParticipation(item)}
                                >
                                  {updating
                                    ? "Atualizando..."
                                    : protectedParticipation
                                      ? "Confirmada"
                                      : item.enabled_current_draw ? "Desativar" : "Ativar"}
                                </Button>
                              </Stack>
                            );
                          })}
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Stack spacing={1} alignItems="flex-end" sx={{ minWidth: 210 }}>
                          {group.can_admin_authorize === true && (
                            <Button
                              variant="contained"
                              color="success"
                              size="small"
                              disabled={authorizationUpdating || Boolean(participationUpdatingId)}
                              startIcon={authorizationUpdating
                                ? <CircularProgress color="inherit" size={16} />
                                : <CreditCardRoundedIcon />}
                              onClick={() => openAdminAuthorization(group)}
                              sx={{ whiteSpace: "nowrap" }}
                            >
                              {authorizationUpdating ? "Autorizando..." : "Autorizar cobrança"}
                            </Button>
                          )}
                          {group.requires_review === true && (
                            <Typography variant="body2" sx={{ color: "error.main", fontWeight: 800 }}>
                              Revisão necessária
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ minHeight: 64 }}>
          <IconButton edge="start" color="inherit" onClick={() => navigate("/admin")} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Typography sx={{ ml: 1, fontWeight: 900 }}>CATIVOS</Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            startIcon={<RefreshRoundedIcon />}
            onClick={() => {
              loadCurrentDraw();
              if (tab === "history") loadHistory();
              else if (tab === "participation") loadParticipation();
              else load();
            }}
            variant="outlined"
            size="small"
          >
            Atualizar
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: { xs: 3, md: 4 } }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900 }}>Números Cativos</Typography>
            <Typography sx={{ color: "text.secondary", mt: 0.5 }}>
              Controle de participação dos clientes com números cativos.
            </Typography>
            <Alert severity="info" variant="outlined" sx={{ mt: 1.5 }}>
              Regra de valor variável: até {policy.default_amount_label} o cativo pode seguir no automático. Acima de {policy.default_amount_label}, todos os cativos exigem pré-autorização e só são cobrados após confirmação do cliente.
            </Alert>
          </Box>

          {(tab === "captives" || tab === "notifications") && (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, ...adminPanelPaperSx }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
              <TextField label="Busca" value={q} onChange={(e) => setQ(e.target.value)} size="small" sx={{ minWidth: { md: 360 } }} />
              <TextField
                select
                label="Filtro"
                value={status}
                onChange={(e) => { setStatus(e.target.value); setPage(1); }}
                size="small"
                sx={{ minWidth: { md: 220 } }}
              >
                {FILTERS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
              </TextField>
              <Box sx={{ flex: 1 }} />
              <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 800 }}>
                {total} registro{total === 1 ? "" : "s"}
              </Typography>
            </Stack>
          </Paper>
          )}

          {(tab === "captives" || tab === "notifications") && error && <Alert severity="error">{error}</Alert>}
          {(tab === "captives" || tab === "notifications") && rowError && <Alert severity="warning">{rowError}</Alert>}

          <Paper variant="outlined" sx={{ ...adminPanelPaperSx, overflow: "hidden" }}>
            <Tabs
              value={tab}
              onChange={(_, value) => setTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ px: 1 }}
            >
              <Tab value="captives" label="Cativos" />
              <Tab value="notifications" label="Notificações" />
              <Tab value="history" label="Histórico de mensagens" />
              <Tab value="participation" label="Participação no sorteio atual" />
            </Tabs>
          </Paper>

          <Paper variant="outlined" sx={{ ...adminPanelPaperSx, overflow: "hidden" }}>
            {tab === "history" ? renderNotificationHistory() : tab === "participation" ? renderCurrentDrawParticipation() : loading ? (
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 3 }}>
                <CircularProgress size={22} />
                <Typography sx={{ color: "text.secondary" }}>Carregando</Typography>
              </Stack>
            ) : empty ? (
              <Typography sx={{ p: 3, color: "text.secondary" }}>Nenhum cativo encontrado.</Typography>
            ) : tab === "captives" ? (
              <TableContainer>
                <Table size="small" sx={{ minWidth: 1180 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Cliente</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Telefone</TableCell>
                      <TableCell>Número Cativo</TableCell>
                      <TableCell>Participação</TableCell>
                      <TableCell>Modo de Cobrança</TableCell>
                      <TableCell>Autopay/Cartão</TableCell>
                      <TableCell>WhatsApp</TableCell>
                      <TableCell>Última tentativa</TableCell>
                      <TableCell align="right">Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((row) => {
                      const participationUpdating = updatingId === `${row.id}:participation`;
                      const modeUpdating = updatingId === `${row.id}:authorization-mode`;
                      const requiresPreauth = row.authorization_mode === true || row.requires_preauth === true;
                      return (
                        <TableRow key={row.id} hover>
                          <TableCell sx={{ fontWeight: 800 }}>{row.user_name || "-"}</TableCell>
                          <TableCell>{row.user_email || "-"}</TableCell>
                          <TableCell>{row.user_phone_masked || "-"}</TableCell>
                          <TableCell sx={{ fontWeight: 900 }}>{row.captive_number_label || row.captive_number}</TableCell>
                          <TableCell>
                            {row.participation_active ? <StatusChip label="Participando" tone="success" /> : <StatusChip label="Pausado" tone="error" />}
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5}>
                              {requiresPreauth
                                ? <StatusChip label={row.authorization_mode_label || policy.preauth_label} tone="warning" />
                                : <StatusChip label={row.authorization_mode_label || policy.automatic_label} tone="neutral" />}
                              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                                Regra variável: acima do valor padrão, exige autorização.
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            {row.card_status === "configured" ? <StatusChip label="Cartão configurado" tone="success" /> : <StatusChip label="Sem cartão" tone="warning" />}
                          </TableCell>
                          <TableCell>
                            {row.whatsapp_consent_status === "granted" ? <StatusChip label="WhatsApp autorizado" tone="success" /> : <StatusChip label="WhatsApp não autorizado" tone="warning" />}
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5}>
                              <LastRun row={row} />
                              {row.last_run_at && <Typography variant="caption" sx={{ color: "text.secondary" }}>{formatDate(row.last_run_at)}</Typography>}
                            </Stack>
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction={{ xs: "column", lg: "row" }} spacing={1} justifyContent="flex-end">
                              <Button
                                variant={row.participation_active ? "outlined" : "contained"}
                                color={row.participation_active ? "error" : "primary"}
                                size="small"
                                startIcon={participationUpdating ? <CircularProgress color="inherit" size={16} /> : row.participation_active ? <PauseCircleOutlineRoundedIcon /> : <PlayCircleOutlineRoundedIcon />}
                                disabled={participationUpdating || modeUpdating}
                                onClick={() => toggleParticipation(row)}
                                sx={{ whiteSpace: "nowrap" }}
                              >
                                {row.participation_active ? "Pausar participação" : "Ativar participação"}
                              </Button>
                              <Button
                                variant={requiresPreauth ? "outlined" : "contained"}
                                color={requiresPreauth ? "inherit" : "success"}
                                size="small"
                                startIcon={modeUpdating ? <CircularProgress color="inherit" size={16} /> : <SwapHorizRoundedIcon />}
                                disabled={participationUpdating || modeUpdating}
                                onClick={() => toggleAuthorizationMode(row)}
                                sx={{ whiteSpace: "nowrap" }}
                              >
                                {requiresPreauth ? automaticButtonLabel : "Pedir autorização sempre"}
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box>
                <Paper variant="outlined" sx={{ m: 2, p: 2, bgcolor: "rgba(255,255,255,0.02)" }}>
                  <Stack spacing={1.5}>
                    <Box>
                      <Typography sx={{ fontWeight: 900 }}>Reenvio de confirmações pendentes</Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                        Corrige o valor das pré-autorizações ainda pendentes deste sorteio e realiza uma nova tentativa de envio para clientes com WhatsApp autorizado.
                      </Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
                        Clientes sem permissão de WhatsApp continuarão podendo responder pelo painel da conta.
                      </Typography>
                    </Box>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                          Sorteio principal: {currentDraw?.draw_id ? `#${currentDraw.draw_id}` : "não identificado"}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Valor atual: {formatAmountBRL(currentDraw?.amount_cents)}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Autorizações pendentes: {currentDrawPendingCount}
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Cativos desabilitados neste sorteio: {currentDrawDisabledCount}
                        </Typography>
                      </Box>
                      <Button
                        variant="contained"
                        color="warning"
                        disabled={reissueLoading || !currentDraw?.draw_id || !currentDraw?.preauth_required}
                        onClick={handleReissueAndResend}
                        startIcon={reissueLoading ? <CircularProgress color="inherit" size={16} /> : null}
                        sx={{ whiteSpace: "nowrap" }}
                      >
                        {reissueLoading ? "Reemitindo..." : "Reemitir e reenviar pendentes"}
                      </Button>
                    </Stack>
                    {reissueError && <Alert severity="error" variant="outlined">{reissueError}</Alert>}
                    {reissueResult && (
                      <Alert severity={Number(reissueResult.failed || 0) > 0 ? "warning" : "success"} variant="outlined">
                        <Stack spacing={0.25}>
                          <Typography variant="body2">{Number(reissueResult.pending_found || 0)} autorizações pendentes encontradas</Typography>
                          <Typography variant="body2">{Number(reissueResult.failed_recoverable_found || 0)} falhas recuperáveis encontradas</Typography>
                          <Typography variant="body2">{Number(reissueResult.failed_recovered || 0)} falhas recuperadas</Typography>
                          <Typography variant="body2">{Number(reissueResult.amount_corrected || 0)} valores corrigidos</Typography>
                          <Typography variant="body2">{Number(reissueResult.sent || 0)} mensagens reenviadas</Typography>
                          <Typography variant="body2">{Number(reissueResult.skipped_consent || 0)} sem consentimento</Typography>
                          <Typography variant="body2">{Number(reissueResult.skipped_notifications_disabled || 0)} com notificações pausadas</Typography>
                          <Typography variant="body2">{Number(reissueResult.skipped_invalid_phone || 0)} com telefone inválido</Typography>
                          <Typography variant="body2">{Number(reissueResult.skipped_near_expiration || 0)} perto de expirar</Typography>
                          <Typography variant="body2">{Number(reissueResult.failed || 0)} falha de envio</Typography>
                        </Stack>
                      </Alert>
                    )}
                  </Stack>
                </Paper>
                <Alert severity="info" variant="outlined" sx={{ m: 2 }}>
                  Pausar notificações impede o envio da mensagem de pré-autorização. Em sorteios acima do valor padrão, isso não libera cobrança automática direta.
                </Alert>
                <TableContainer>
                <Table size="small" sx={{ minWidth: 1080 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Nome do cliente</TableCell>
                      <TableCell>E-mail</TableCell>
                      <TableCell>Telefone</TableCell>
                      <TableCell>Número cativo</TableCell>
                      <TableCell>Participação</TableCell>
                      <TableCell>Modo de cobrança</TableCell>
                      <TableCell>Notificações</TableCell>
                      <TableCell align="right">Ação</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {items.map((row) => {
                      const captiveId = row.autopay_number_id || row.id;
                      const notificationsUpdating = updatingId === `${captiveId}:preauth-notifications`;
                      const notificationsEnabled = row.preauth_notifications_enabled !== false;
                      const requiresPreauth = row.authorization_mode === true || row.requires_preauth === true;
                      return (
                        <TableRow key={row.id} hover>
                          <TableCell sx={{ fontWeight: 800 }}>{row.user_name || "-"}</TableCell>
                          <TableCell>{row.user_email || "-"}</TableCell>
                          <TableCell>{row.user_phone_masked || "-"}</TableCell>
                          <TableCell sx={{ fontWeight: 900 }}>{row.captive_number_label || row.captive_number}</TableCell>
                          <TableCell>
                            {row.participation_active ? <StatusChip label="Participando" tone="success" /> : <StatusChip label="Pausado" tone="error" />}
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5}>
                              {requiresPreauth
                                ? <StatusChip label={row.authorization_mode_label || policy.preauth_label} tone="warning" />
                                : <StatusChip label={row.authorization_mode_label || policy.automatic_label} tone="neutral" />}
                              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
                                {row.variable_price_rule_label || variableRuleLabel}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            {notificationsEnabled
                              ? <StatusChip label={row.preauth_notifications_label || "Ativas"} tone="success" />
                              : <StatusChip label="Pausadas - não cobrar direto" tone="warning" />}
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              variant={notificationsEnabled ? "outlined" : "contained"}
                              color={notificationsEnabled ? "warning" : "success"}
                              size="small"
                              startIcon={notificationsUpdating ? <CircularProgress color="inherit" size={16} /> : notificationsEnabled ? <PauseCircleOutlineRoundedIcon /> : <PlayCircleOutlineRoundedIcon />}
                              disabled={notificationsUpdating}
                              onClick={() => togglePreauthNotifications(row)}
                              sx={{ whiteSpace: "nowrap" }}
                            >
                              {notificationsEnabled ? "Pausar notificações" : "Ativar notificações"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              </Box>
            )}
          </Paper>

          <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
            <Button
              variant="outlined"
              disabled={visiblePage <= 1 || visiblePageLoading}
              onClick={() => {
                if (tab === "history") setHistoryPage((value) => Math.max(1, value - 1));
                else if (tab === "participation") setParticipationPage((value) => Math.max(1, value - 1));
                else setPage((value) => Math.max(1, value - 1));
              }}
            >
              Anterior
            </Button>
            <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 800 }}>
              Página {visiblePage} de {visibleTotalPages}
            </Typography>
            <Button
              variant="outlined"
              disabled={visiblePage >= visibleTotalPages || visiblePageLoading}
              onClick={() => {
                if (tab === "history") setHistoryPage((value) => value + 1);
                else if (tab === "participation") setParticipationPage((value) => value + 1);
                else setPage((value) => value + 1);
              }}
            >
              Próxima
            </Button>
          </Stack>
        </Stack>
      </Container>
      <Dialog
        open={Boolean(authorizationDialogItem)}
        onClose={closeAdminAuthorization}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Autorizar cobrança única?</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography>
              Você autorizará uma única cobrança de {formatAmountBRL(authorizationDialogItem?.total_amount_cents)} para os números cativos{" "}
              {(authorizationDialogItem?.captive_numbers || []).join(" e ")}.
            </Typography>
            <Box>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>Cliente</Typography>
              <Typography sx={{ fontWeight: 800 }}>{authorizationDialogItem?.user_name || "-"}</Typography>
              <Typography variant="body2">{authorizationDialogItem?.user_email || "-"}</Typography>
            </Box>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Números cativos</Typography>
                <Typography sx={{ fontWeight: 900 }}>{(authorizationDialogItem?.captive_numbers || []).join(", ") || "-"}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Sorteio atual</Typography>
                <Typography sx={{ fontWeight: 900 }}>{currentDraw?.draw_id ? `#${currentDraw.draw_id}` : "-"}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Quantidade</Typography>
                <Typography sx={{ fontWeight: 900 }}>
                  {authorizationDialogItem?.quantity || 0}
                </Typography>
              </Box>
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Valor unitário</Typography>
                <Typography sx={{ fontWeight: 900 }}>{formatAmountBRL(authorizationDialogItem?.unit_amount_cents)}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Valor total</Typography>
                <Typography sx={{ fontWeight: 900 }}>{formatAmountBRL(authorizationDialogItem?.total_amount_cents)}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Origem</Typography>
                <Typography sx={{ fontWeight: 900 }}>Autorização administrativa</Typography>
              </Box>
            </Stack>
            <Alert severity="warning" variant="outlined">
              Confirme somente se deseja cobrar o valor total uma única vez e confirmar todos os números deste grupo.
            </Alert>
            {authorizationError && <Alert severity="error">{authorizationError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeAdminAuthorization} disabled={Boolean(authorizationLoadingId)}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={authorizationLoadingId
              ? <CircularProgress color="inherit" size={16} />
              : <CreditCardRoundedIcon />}
            onClick={handleAdminAuthorization}
            disabled={Boolean(authorizationLoadingId)}
          >
            {authorizationLoadingId ? "Autorizando..." : "Autorizar cobrança"}
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}
