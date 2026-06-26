// src/AdminNotificationsPage.jsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  AppBar,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Container,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ThemeProvider,
  Toolbar,
  Typography,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import {
  createPushRule,
  estimateAudience,
  exportNotificationDispatchesCsv,
  getBrevoWhatsAppEvents,
  getNotificationHealth,
  getPushSummary,
  listInboundMessages,
  listNotificationDispatches,
  listNotificationTemplates,
  listPushLogs,
  listPushRules,
  manualSendNotification,
  manualSendSelectedNotification,
  searchNotificationRecipients,
  seedDefaultPushRules,
  syncBrevoWhatsAppTemplates,
  syncDispatchDeliveryStatus,
  updatePushRule,
  updateNotificationTemplate,
} from "./services/adminNotifications";
import { adminPanelPaperSx, adminTabsPaperSx, createNewStoreAdminTheme } from "./adminTheme";

const theme = createNewStoreAdminTheme();

const TAB_LABELS = ["Enviar mensagem", "Disparos", "Mensagens recebidas", "Templates", "Audiência futura", "Push"];

const DEFAULT_ADVANCED_PARAMS = {
  customer_name: "",
  prize_name: "",
  ticket_price: "",
  numbers: "",
  authorize_url: "",
  decline_url: "",
};

const AUDIENCE_FILTERS = [
  { value: "all_users", label: "Todos os usuários" },
  { value: "active_balance", label: "Saldo ativo" },
  { value: "specific_user", label: "Usuário específico" },
  { value: "specific_phone", label: "Telefone específico" },
];

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString("pt-BR");
}

const BREVO_EVENT_FILTER_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "sent", label: "sent" },
  { value: "delivered", label: "delivered" },
  { value: "read", label: "read" },
  { value: "failed", label: "failed" },
  { value: "rejected", label: "rejected" },
];

function statusChipColor(status) {
  const s = String(status || "").toLowerCase();
  if (s === "accepted" || s === "sent") return "success";
  if (s === "delivered") return "success";
  if (s === "read") return "info";
  if (s === "failed" || s === "rejected") return "error";
  if (s === "skipped") return "warning";
  if (s === "dry_run") return "info";
  if (s === "deduped") return "default";
  if (s === "pending") return "info";
  return "default";
}

function dispatchStatusLabel(row) {
  const status = String(row?.status || "").toLowerCase();
  if (status === "skipped" && isWhatsappConsentBlock(row)) return "Bloqueado por consentimento";
  if (status === "accepted") return "Aceito pela Brevo";
  if (status === "sent") return "Aceito pela Brevo";
  if (status === "delivered") return "Entregue";
  if (status === "read") return "Lido";
  if (status === "failed") return "Falhou";
  if (status === "rejected") return "Rejeitado";
  if (status === "skipped") return "Ignorado";
  return row?.status ?? "—";
}

const PUSH_SAFETY_REASON_LABELS = {
  safety_missing_occurred_at: "Bloqueado: data do evento ausente",
  safety_event_too_old: "Bloqueado: evento antigo",
  safety_missing_scan_id: "Bloqueado: scan_id ausente",
  safety_scan_event_limit_exceeded: "Bloqueado: limite por execucao excedido",
};

function pushSafetyReasonLabel(value) {
  const code = String(value || "").trim();
  return PUSH_SAFETY_REASON_LABELS[code] || code || "—";
}

function isPushSafetyBlock(row) {
  const status = String(row?.status || "").toLowerCase();
  const reason = String(row?.error_message || row?.reason || "").trim();
  return status === "skipped" && reason.startsWith("safety_");
}

const WHATSAPP_CONSENT_REASON_LABELS = {
  whatsapp_consent_missing: "Bloqueado: sem opt-in WhatsApp",
  whatsapp_consent_revoked: "Bloqueado: opt-out WhatsApp",
  whatsapp_consent_unknown: "Bloqueado: consentimento desconhecido",
  whatsapp_unlinked_phone_blocked: "Bloqueado: telefone sem usuario vinculado",
};

function whatsappConsentReasonLabel(value) {
  const code = String(value || "").trim();
  return WHATSAPP_CONSENT_REASON_LABELS[code] || code || "—";
}

function whatsappConsentStatusLabel(value, canSend = false) {
  const status = String(value || "unknown").toLowerCase();
  if (canSend === true || ["granted", "active", "opt_in", "allowed", "subscribed", "accepted"].includes(status)) {
    return "WhatsApp autorizado";
  }
  if (["revoked", "opt_out", "denied", "blocked", "unsubscribed"].includes(status)) return "Opt-out WhatsApp";
  if (status === "missing") return "Sem opt-in WhatsApp";
  return "Consentimento desconhecido";
}

function whatsappConsentChipColor(value, canSend = false) {
  const status = String(value || "unknown").toLowerCase();
  if (canSend === true || ["granted", "active", "opt_in", "allowed", "subscribed", "accepted"].includes(status)) {
    return "success";
  }
  if (["revoked", "opt_out", "denied", "blocked", "unsubscribed"].includes(status)) return "error";
  if (status === "missing") return "warning";
  return "default";
}

function recipientWhatsappCanSend(r) {
  return r?.whatsapp_can_send === true;
}

function isWhatsappConsentBlock(row) {
  const reason = String(row?.error_message || row?.error || row?.last_error || "").trim();
  return reason.startsWith("whatsapp_consent_") || reason === "whatsapp_unlinked_phone_blocked";
}

function pushStatusLabel(status, row = null) {
  const s = String(status || "").toLowerCase();
  if (isPushSafetyBlock(row)) return "Bloqueado por seguranca";
  if (s === "dry_run") return "Dry-run";
  if (s === "skipped") return "Ignorado";
  if (s === "deduped") return "Duplicado";
  if (s === "sent") return "Enviado";
  if (s === "failed") return "Falhou";
  if (s === "pending") return "Pendente";
  return status || "â€”";
}

function deliveryStatusLabel(value) {
  const s = String(value || "").toLowerCase();
  if (!s) return "—";
  if (s === "accepted" || s === "sent") return "Aceito pela Brevo";
  if (s === "delivered") return "Entregue";
  if (s === "read") return "Lido";
  if (s === "failed") return "Falhou";
  if (s === "rejected") return "Rejeitado";
  if (s === "pending") return "Pendente";
  return value;
}

function templateActiveLabel(row) {
  const active = row?.is_active ?? row?.active;
  if (active === true) return "Ativo/Aprovado";
  if (active === false) return "Inativo/Pendente";
  return "—";
}

function templateActiveColor(row) {
  const active = row?.is_active ?? row?.active;
  if (active === true) return "success";
  if (active === false) return "warning";
  return "default";
}

function canSyncDelivery(row) {
  const provider = String(row?.provider || "").toLowerCase();
  const channel = String(row?.channel || "").toLowerCase();
  const msgId = row?.provider_message_id ?? row?.providerMessageId;
  return provider === "brevo" && channel === "whatsapp" && Boolean(msgId) && row?.id != null;
}

function parseNotificationsError(err) {
  const msg = String(err?.message || err || "");
  if (WHATSAPP_CONSENT_REASON_LABELS[msg]) return WHATSAPP_CONSENT_REASON_LABELS[msg];
  if (msg.includes("brevo_ip_not_authorized")) {
    return "A Brevo bloqueou o IP do backend. Autorize o IP de saída do Render nas configurações da Brevo.";
  }
  return msg || "Erro desconhecido";
}

function boolLabel(v) {
  return v ? "Sim" : "Não";
}

function brevoModelOptionId(tpl) {
  const key = tpl.template_key ?? tpl.templateKey ?? "";
  const pid = tpl.provider_template_id ?? tpl.providerTemplateId ?? "";
  return `${key}::${pid}`;
}

function templateSelectOptionId(tpl) {
  if (tpl?.id != null) return `id:${tpl.id}`;
  return brevoModelOptionId(tpl);
}

function getTemplateDefaultMessage(tpl) {
  if (!tpl) return "";
  if (tpl.default_message) return String(tpl.default_message);
  let dp = tpl.default_params ?? tpl.defaultParams;
  if (typeof dp === "string" && dp.trim()) {
    try {
      dp = JSON.parse(dp);
    } catch {
      dp = null;
    }
  }
  if (dp && typeof dp === "object" && dp.message) return String(dp.message);
  return String(tpl.body_preview ?? tpl.bodyPreview ?? tpl.preview ?? tpl.preview_text ?? "");
}

function recipientDedupeKey(r) {
  if (r?.type === "user" && r.user_id != null) return `user:${r.user_id}`;
  return `phone:${String(r?.phone || "").replace(/\D/g, "")}`;
}

function mapRecipientToApi(r) {
  return {
    type: r.type,
    user_id: r.user_id ?? null,
    name: r.name ?? null,
    email: r.email ?? null,
    phone: r.phone ?? null,
  };
}

function mapSearchHitToRecipient(hit) {
  const canSend = hit.whatsapp_can_send === true;
  return {
    type: "user",
    user_id: hit.user_id ?? hit.userId ?? hit.id,
    name: hit.name ?? hit.full_name ?? hit.fullName ?? "Cliente",
    email: hit.email ?? null,
    phone: hit.phone ?? hit.whatsapp ?? hit.mobile ?? null,
    whatsapp_can_send: canSend,
    whatsapp_consent_status: hit.whatsapp_consent_status ?? "unknown",
    whatsapp_consent_category: hit.whatsapp_consent_category ?? null,
    whatsapp_consent_source: hit.whatsapp_consent_source ?? null,
  };
}

function formatAuditJson(value) {
  if (value == null || value === "") return "{}";
  let obj = value;
  if (typeof value === "string") {
    try {
      obj = JSON.parse(value);
    } catch {
      return value.trim() ? value : "{}";
    }
  }
  if (typeof obj === "object" && obj !== null && !Array.isArray(obj) && Object.keys(obj).length === 0) {
    return "{}";
  }
  try {
    return JSON.stringify(obj ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function AuditJsonBlock({ title, value }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      <Box component="pre" sx={{ fontSize: 11, overflow: "auto", m: 0, mt: 0.5 }}>
        {formatAuditJson(value)}
      </Box>
    </Box>
  );
}

function StatusCard({ label, value, ok }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, minWidth: 160, flex: 1 }}>
      <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography variant="h6" sx={{ fontWeight: 800, color: ok === true ? "success.main" : ok === false ? "error.main" : "text.primary" }}>
        {value}
      </Typography>
    </Paper>
  );
}

function centralActive(health) {
  if (health == null) return null;
  if (typeof health.active === "boolean") return health.active;
  if (typeof health.centralActive === "boolean") return health.centralActive;
  return Boolean(health.brevoWhatsappEnabled && health.hasBrevoApiKey);
}

export default function AdminNotificationsPage() {
  const nav = useNavigate();
  const [tab, setTab] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [health, setHealth] = React.useState(null);
  const [dispatches, setDispatches] = React.useState([]);
  const [inboundMessages, setInboundMessages] = React.useState([]);
  const [templates, setTemplates] = React.useState([]);

  const [loadingDispatches, setLoadingDispatches] = React.useState(false);
  const [loadingTemplates, setLoadingTemplates] = React.useState(false);
  const [loadingInbound, setLoadingInbound] = React.useState(false);
  const [dispatchError, setDispatchError] = React.useState("");
  const [templatesError, setTemplatesError] = React.useState("");
  const [inboundError, setInboundError] = React.useState("");

  const [dispatchStatus, setDispatchStatus] = React.useState("");
  const [dispatchChannel, setDispatchChannel] = React.useState("");
  const [dispatchProvider, setDispatchProvider] = React.useState("");
  const [exportingCsv, setExportingCsv] = React.useState(false);
  const [exportCsvMessage, setExportCsvMessage] = React.useState("");
  const [exportCsvError, setExportCsvError] = React.useState("");
  const [expandedDispatch, setExpandedDispatch] = React.useState(null);
  const [expandedInbound, setExpandedInbound] = React.useState(null);

  const [recipientSearch, setRecipientSearch] = React.useState("");
  const [recipientOptions, setRecipientOptions] = React.useState([]);
  const [recipientSearchLoading, setRecipientSearchLoading] = React.useState(false);
  const [selectedRecipients, setSelectedRecipients] = React.useState([]);
  const [showManualPhone, setShowManualPhone] = React.useState(false);
  const [manualPhone, setManualPhone] = React.useState("");
  const [selectedTemplateOptionId, setSelectedTemplateOptionId] = React.useState("");
  const [sendForm, setSendForm] = React.useState({
    template_key: "GENERIC_TEST",
    template_id: "",
    message: "",
    ...DEFAULT_ADVANCED_PARAMS,
  });
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const [useCustomRecipient, setUseCustomRecipient] = React.useState(false);
  const [sendSending, setSendSending] = React.useState(false);
  const [sendResult, setSendResult] = React.useState(null);
  const [sendError, setSendError] = React.useState("");

  const [editingTemplate, setEditingTemplate] = React.useState(null);
  const [templateEditForm, setTemplateEditForm] = React.useState(null);
  const [templateEditJsonError, setTemplateEditJsonError] = React.useState("");
  const [templateSaving, setTemplateSaving] = React.useState(false);
  const [templateSaveMessage, setTemplateSaveMessage] = React.useState("");
  const [templateSaveError, setTemplateSaveError] = React.useState("");

  const [audienceFilter, setAudienceFilter] = React.useState("all_users");
  const [audienceUserId, setAudienceUserId] = React.useState("");
  const [audiencePhone, setAudiencePhone] = React.useState("");
  const [audienceEstimating, setAudienceEstimating] = React.useState(false);
  const [audienceEstimate, setAudienceEstimate] = React.useState(null);
  const [audienceEstimateError, setAudienceEstimateError] = React.useState("");
  const [manualSending, setManualSending] = React.useState(false);
  const [manualResult, setManualResult] = React.useState(null);
  const [manualError, setManualError] = React.useState("");

  const [syncingBrevo, setSyncingBrevo] = React.useState(false);
  const [syncBrevoMessage, setSyncBrevoMessage] = React.useState("");
  const [syncBrevoError, setSyncBrevoError] = React.useState("");

  const [deliverySyncById, setDeliverySyncById] = React.useState({});

  const [brevoEventsPhone, setBrevoEventsPhone] = React.useState("");
  const [brevoEventsDays, setBrevoEventsDays] = React.useState(1);
  const [brevoEventsEvent, setBrevoEventsEvent] = React.useState("");
  const [brevoEvents, setBrevoEvents] = React.useState([]);
  const [brevoEventsLoading, setBrevoEventsLoading] = React.useState(false);
  const [brevoEventsError, setBrevoEventsError] = React.useState("");
  const [expandedBrevoEvent, setExpandedBrevoEvent] = React.useState(null);

  const [pushLogs, setPushLogs] = React.useState([]);
  const [pushSummary, setPushSummary] = React.useState(null);
  const [pushLoading, setPushLoading] = React.useState(false);
  const [pushError, setPushError] = React.useState("");
  const [pushPanel, setPushPanel] = React.useState("history");
  const [pushFilters, setPushFilters] = React.useState({
    q: "",
    status: "",
    event_key: "",
    user_id: "",
    page: 1,
    pageSize: 20,
  });
  const [pushTotal, setPushTotal] = React.useState(0);
  const [pushRules, setPushRules] = React.useState([]);
  const [pushRuleEvents, setPushRuleEvents] = React.useState([]);
  const [pushRulesLoading, setPushRulesLoading] = React.useState(false);
  const [pushRulesError, setPushRulesError] = React.useState("");
  const [pushRulesMessage, setPushRulesMessage] = React.useState("");
  const [editingPushRule, setEditingPushRule] = React.useState(null);
  const [pushRuleForm, setPushRuleForm] = React.useState({
    event_key: "",
    name: "",
    description: "",
    title_template: "",
    body_template: "",
    url_template: "/",
    category: "operational",
    is_active: false,
    threshold_value: "",
    cooldown_minutes: 1440,
  });

  const buildDispatchFilters = React.useCallback(() => {
    const params = { limit: 50 };
    if (dispatchStatus) params.status = dispatchStatus;
    if (dispatchChannel.trim()) params.channel = dispatchChannel.trim();
    if (dispatchProvider.trim()) params.provider = dispatchProvider.trim();
    return params;
  }, [dispatchStatus, dispatchChannel, dispatchProvider]);

  const loadDispatches = React.useCallback(async () => {
    setLoadingDispatches(true);
    setDispatchError("");
    try {
      const rows = await listNotificationDispatches(buildDispatchFilters());
      console.log("[AdminNotificationsPage] dispatches loaded", {
        count: rows.length,
        sample: rows[0] || null,
      });
      setDispatches(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error("[AdminNotificationsPage] dispatches error", err);
      setDispatches([]);
      setDispatchError(err?.message || "Erro ao carregar disparos");
    } finally {
      setLoadingDispatches(false);
    }
  }, [buildDispatchFilters]);

  const loadTemplates = React.useCallback(async () => {
    setLoadingTemplates(true);
    setTemplatesError("");
    try {
      const rows = await listNotificationTemplates();
      console.log("[AdminNotificationsPage] templates loaded", {
        count: rows.length,
        sample: rows[0] || null,
      });
      setTemplates(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error("[AdminNotificationsPage] templates error", err);
      setTemplates([]);
      setTemplatesError(err?.message || "Erro ao carregar templates");
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  const loadInbound = React.useCallback(async () => {
    setLoadingInbound(true);
    setInboundError("");
    try {
      const rows = await listInboundMessages({ limit: 50 });
      console.log("[AdminNotificationsPage] inbound loaded", {
        count: rows.length,
        sample: rows[0] || null,
      });
      setInboundMessages(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error("[AdminNotificationsPage] inbound error", err);
      setInboundMessages([]);
      setInboundError(err?.message || "Erro ao carregar mensagens recebidas");
    } finally {
      setLoadingInbound(false);
    }
  }, []);

  const loadPushData = React.useCallback(async (overrides = {}) => {
    setPushLoading(true);
    setPushError("");
    const nextFilters = { ...pushFilters, ...overrides };
    try {
      const [logsResult, summaryResult] = await Promise.all([
        listPushLogs(nextFilters),
        getPushSummary(),
      ]);
      setPushFilters(nextFilters);
      setPushLogs(Array.isArray(logsResult?.items) ? logsResult.items : []);
      setPushTotal(Number(logsResult?.total || 0));
      setPushSummary(summaryResult || null);
    } catch (err) {
      setPushLogs([]);
      setPushTotal(0);
      setPushError(parseNotificationsError(err));
    } finally {
      setPushLoading(false);
    }
  }, [pushFilters]);

  const loadPushRules = React.useCallback(async () => {
    setPushRulesLoading(true);
    setPushRulesError("");
    try {
      const data = await listPushRules();
      setPushRules(Array.isArray(data?.items) ? data.items : []);
      setPushRuleEvents(Array.isArray(data?.allowed_events) ? data.allowed_events : []);
    } catch (err) {
      setPushRules([]);
      setPushRulesError(parseNotificationsError(err));
    } finally {
      setPushRulesLoading(false);
    }
  }, []);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const h = await getNotificationHealth();
      setHealth(h);
    } catch (e) {
      setError(e?.message || "Falha ao carregar health da Central de Notificações.");
    }
    await Promise.allSettled([loadDispatches(), loadTemplates(), loadInbound()]);
    setLoading(false);
  }, [loadDispatches, loadTemplates, loadInbound]);

  const visibleDispatches = React.useMemo(() => {
    const status = dispatchStatus.trim();
    const channel = dispatchChannel.trim();
    const provider = dispatchProvider.trim();
    return dispatches.filter((row) => {
      if (status && row.status !== status) return false;
      if (channel && row.channel !== channel) return false;
      if (provider && row.provider !== provider) return false;
      return true;
    });
  }, [dispatches, dispatchStatus, dispatchChannel, dispatchProvider]);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  React.useEffect(() => {
    if (tab === 5 && !pushSummary && !pushLoading) {
      loadPushData();
    }
    if (tab === 5 && !pushRules.length && !pushRulesLoading) {
      loadPushRules();
    }
    // Carrega somente ao abrir a aba Push pela primeira vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const testMode = Boolean(health?.testMode);
  const allowReal = Boolean(health?.allowRealRecipients);
  const realWhatsappSendMode = allowReal && !testMode;
  const showTestAlert = testMode || !allowReal;
  const customRecipientsEnabled = Boolean(health?.adminTestCustomRecipientsEnabled);

  const selectedRecipientKeys = React.useMemo(
    () => new Set(selectedRecipients.map(recipientDedupeKey)),
    [selectedRecipients]
  );

  const filteredRecipientOptions = React.useMemo(
    () =>
      recipientOptions.filter((opt) => {
        const r = mapSearchHitToRecipient(opt);
        return !selectedRecipientKeys.has(recipientDedupeKey(r));
      }),
    [recipientOptions, selectedRecipientKeys]
  );

  React.useEffect(() => {
    const q = recipientSearch.trim();
    if (q.length < 2) {
      setRecipientOptions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setRecipientSearchLoading(true);
      try {
        const rows = await searchNotificationRecipients(q, 20);
        if (!cancelled) setRecipientOptions(Array.isArray(rows) ? rows : []);
      } catch {
        if (!cancelled) setRecipientOptions([]);
      } finally {
        if (!cancelled) setRecipientSearchLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [recipientSearch]);

  const updateSendField = (name, value) => setSendForm((f) => ({ ...f, [name]: value }));

  const addRecipient = (recipient) => {
    if (realWhatsappSendMode && !recipientWhatsappCanSend(recipient)) {
      setSendError("WhatsApp exige opt-in explicito do usuario. Este destinatario nao pode receber envio real.");
      return;
    }
    const key = recipientDedupeKey(recipient);
    setSelectedRecipients((prev) => {
      if (prev.some((r) => recipientDedupeKey(r) === key)) return prev;
      return [...prev, recipient];
    });
    setRecipientSearch("");
  };

  const removeRecipient = (key) => {
    setSelectedRecipients((prev) => prev.filter((r) => recipientDedupeKey(r) !== key));
  };

  const onAddManualPhone = () => {
    const phone = manualPhone.trim();
    if (!phone) return;
    if (realWhatsappSendMode) {
      setSendError("Telefone avulso nao possui consentimento auditavel. Use um usuario com opt-in WhatsApp.");
      return;
    }
    addRecipient({ type: "manual_phone", user_id: null, name: "Contato avulso", email: null, phone });
    setManualPhone("");
    setShowManualPhone(false);
  };

  const onSelectSendTemplate = (optionId) => {
    setSelectedTemplateOptionId(optionId);
    if (!optionId) return;
    const tpl = templates.find((t) => templateSelectOptionId(t) === optionId);
    if (!tpl) return;
    setSendForm((f) => ({
      ...f,
      template_key: tpl.template_key ?? tpl.templateKey ?? f.template_key,
      template_id: String(tpl.provider_template_id ?? tpl.providerTemplateId ?? ""),
      message: getTemplateDefaultMessage(tpl) || f.message,
    }));
  };

  const onSendMessage = async () => {
    setSendError("");
    setSendResult(null);

    if (!selectedRecipients.length) {
      setSendError("Selecione pelo menos um destinatário.");
      return;
    }

    const blockedRecipients = selectedRecipients.filter((r) => !recipientWhatsappCanSend(r));
    if (realWhatsappSendMode && blockedRecipients.length) {
      setSendError("WhatsApp exige opt-in explicito. Remova destinatarios sem consentimento antes de enviar.");
      return;
    }

    const templateId = sendForm.template_id?.trim();
    if (!templateId) {
      setSendError("Informe o Template ID ou selecione um template com provider_template_id.");
      return;
    }

    const message = sendForm.message?.trim();
    if (!message) {
      setSendError("Informe a mensagem principal.");
      return;
    }

    const params = {
      message,
      customer_name: sendForm.customer_name?.trim() || undefined,
      prize_name: sendForm.prize_name?.trim() || undefined,
      ticket_price: sendForm.ticket_price?.trim() || undefined,
      numbers: sendForm.numbers?.trim() || undefined,
      authorize_url: sendForm.authorize_url?.trim() || undefined,
      decline_url: sendForm.decline_url?.trim() || undefined,
    };

    const recipients = selectedRecipients.map((r) => {
      const mapped = mapRecipientToApi(r);
      if (!params.customer_name && r.name && r.type === "user") {
        return { ...mapped, name: r.name };
      }
      return mapped;
    });

    if (!params.customer_name && selectedRecipients.length === 1 && selectedRecipients[0].name) {
      params.customer_name = selectedRecipients[0].name;
    }

    setSendSending(true);
    try {
      const res = await manualSendSelectedNotification({
        channel: "whatsapp",
        provider: "brevo",
        template_key: sendForm.template_key,
        template_id: templateId,
        message,
        params,
        recipients,
        use_custom_recipient: useCustomRecipient,
        dry_run: false,
      });
      setSendResult(res);
    } catch (e) {
      setSendError(parseNotificationsError(e));
    } finally {
      setSendSending(false);
      try {
        await loadDispatches();
      } catch (reloadErr) {
        console.warn("[adminNotifications] reload dispatches after send failed", reloadErr?.message);
      }
    }
  };

  const openTemplateEditor = (row) => {
    let dp = row.default_params ?? row.defaultParams;
    if (dp && typeof dp === "object") {
      try {
        dp = JSON.stringify(dp, null, 2);
      } catch {
        dp = "{}";
      }
    } else if (!dp) {
      dp = "{}";
    }
    setEditingTemplate(row);
    setTemplateEditForm({
      template_key: row.template_key ?? row.templateKey ?? "",
      provider_template_id: row.provider_template_id ?? row.providerTemplateId ?? "",
      name: row.name ?? row.title ?? "",
      description: row.description ?? "",
      body_preview: row.body_preview ?? row.bodyPreview ?? row.preview ?? row.preview_text ?? "",
      default_message: row.default_message ?? "",
      default_params_json: typeof dp === "string" ? dp : "{}",
      language: row.language ?? row.locale ?? "",
      category: row.category ?? "",
      is_active: row.is_active ?? row.active ?? true,
    });
    setTemplateEditJsonError("");
    setTemplateSaveMessage("");
    setTemplateSaveError("");
  };

  const closeTemplateEditor = () => {
    setEditingTemplate(null);
    setTemplateEditForm(null);
    setTemplateEditJsonError("");
  };

  const onSaveTemplate = async () => {
    if (!editingTemplate?.id || !templateEditForm) return;
    let default_params;
    try {
      default_params = JSON.parse(templateEditForm.default_params_json || "{}");
      setTemplateEditJsonError("");
    } catch {
      setTemplateEditJsonError("JSON inválido em Default Params.");
      return;
    }
    setTemplateSaving(true);
    setTemplateSaveError("");
    setTemplateSaveMessage("");
    try {
      await updateNotificationTemplate(editingTemplate.id, {
        template_key: templateEditForm.template_key,
        provider_template_id: templateEditForm.provider_template_id || null,
        name: templateEditForm.name,
        description: templateEditForm.description,
        body_preview: templateEditForm.body_preview,
        default_message: templateEditForm.default_message,
        default_params,
        language: templateEditForm.language || null,
        category: templateEditForm.category || null,
        is_active: templateEditForm.is_active,
      });
      setTemplateSaveMessage("Template salvo com sucesso.");
      await loadTemplates();
      closeTemplateEditor();
    } catch (err) {
      setTemplateSaveError(parseNotificationsError(err));
    } finally {
      setTemplateSaving(false);
    }
  };

  const onEstimateAudience = async () => {
    setAudienceEstimating(true);
    setAudienceEstimateError("");
    setAudienceEstimate(null);
    try {
      const body = { filter: audienceFilter };
      if (audienceFilter === "specific_user" && audienceUserId) body.user_id = audienceUserId;
      if (audienceFilter === "specific_phone" && audiencePhone) body.phone = audiencePhone;
      const res = await estimateAudience(body);
      setAudienceEstimate(res);
    } catch (e) {
      setAudienceEstimateError(e?.message || "Falha ao estimar audiência.");
    } finally {
      setAudienceEstimating(false);
    }
  };

  const onManualSendTest = async () => {
    setManualSending(true);
    setManualError("");
    setManualResult(null);
    try {
      const body = {
        channel: "whatsapp",
        template_key: "GENERIC_TEST",
        template_id: null,
        filter: audienceFilter,
        params: {
          customer_name: "Paulo",
          prize_name: "Teste New Store",
          ticket_price: "90,00",
          numbers: "07",
          authorize_url: "https://www.sorteionewstore.com.br/cativo/autorizar/teste",
          decline_url: "https://www.sorteionewstore.com.br/cativo/recusar/teste",
          message: "Teste usando filtro da Central de Notificações",
        },
      };
      if (audienceFilter === "specific_user" && audienceUserId) body.user_id = audienceUserId;
      if (audienceFilter === "specific_phone" && audiencePhone) body.phone = audiencePhone;
      const res = await manualSendNotification(body);
      setManualResult(res);
      await loadDispatches();
    } catch (e) {
      setManualError(e?.message || "Falha no envio de teste com filtro.");
    } finally {
      setManualSending(false);
    }
  };

  const onSyncBrevoTemplates = async () => {
    setSyncingBrevo(true);
    setSyncBrevoError("");
    setSyncBrevoMessage("");
    try {
      const res = await syncBrevoWhatsAppTemplates();
      const found = res?.found ?? res?.models_found ?? res?.count_found ?? res?.total ?? 0;
      const synced = res?.synced ?? res?.synced_count ?? res?.upserted ?? 0;
      setSyncBrevoMessage(`Sincronização concluída. ${found} modelos encontrados, ${synced} sincronizados.`);
      await loadTemplates();
    } catch (err) {
      setSyncBrevoError(parseNotificationsError(err));
    } finally {
      setSyncingBrevo(false);
    }
  };

  const onSyncDispatchDelivery = async (dispatchId) => {
    setDeliverySyncById((s) => ({
      ...s,
      [dispatchId]: { loading: true, error: "", info: "", matched: null },
    }));
    try {
      const res = await syncDispatchDeliveryStatus(dispatchId);
      const matched = res?.matched_event ?? res?.matchedEvent ?? null;
      const statusUpdatedTo = res?.status_updated_to ?? res?.statusUpdatedTo ?? null;
      const syncMessage = res?.message ?? "";
      if (!matched) {
        setDeliverySyncById((s) => ({
          ...s,
          [dispatchId]: {
            loading: false,
            info: syncMessage || "Nenhum evento de entrega encontrado ainda para este messageId.",
            matched: null,
            statusUpdatedTo: null,
            message: syncMessage,
          },
        }));
      } else {
        setDeliverySyncById((s) => ({
          ...s,
          [dispatchId]: {
            loading: false,
            matched,
            statusUpdatedTo,
            message: syncMessage,
            info: "",
            error: "",
          },
        }));
      }
      await loadDispatches();
    } catch (err) {
      setDeliverySyncById((s) => ({
        ...s,
        [dispatchId]: { loading: false, error: parseNotificationsError(err), info: "", matched: null },
      }));
    }
  };

  const onExportDispatchesCsv = async () => {
    setExportingCsv(true);
    setExportCsvMessage("");
    setExportCsvError("");
    try {
      await exportNotificationDispatchesCsv(buildDispatchFilters());
      setExportCsvMessage("CSV exportado com sucesso.");
    } catch (err) {
      setExportCsvError("Erro ao exportar CSV.");
      console.error("[AdminNotificationsPage] export csv error", err);
    } finally {
      setExportingCsv(false);
    }
  };

  const onFetchBrevoEvents = async () => {
    setBrevoEventsLoading(true);
    setBrevoEventsError("");
    try {
      const params = { days: brevoEventsDays, limit: 50, offset: 0 };
      if (brevoEventsPhone.trim()) params.contactNumber = brevoEventsPhone.trim();
      if (brevoEventsEvent) params.event = brevoEventsEvent;
      const rows = await getBrevoWhatsAppEvents(params);
      setBrevoEvents(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setBrevoEvents([]);
      setBrevoEventsError(parseNotificationsError(err));
    } finally {
      setBrevoEventsLoading(false);
    }
  };

  function resetPushRuleForm() {
    setEditingPushRule(null);
    setPushRuleForm({
      event_key: "",
      name: "",
      description: "",
      title_template: "",
      body_template: "",
      url_template: "/",
      category: "operational",
      is_active: false,
      threshold_value: "",
      cooldown_minutes: 1440,
    });
  }

  function openPushRuleEditor(row) {
    setEditingPushRule(row || null);
    setPushRulesMessage("");
    setPushRulesError("");
    setPushRuleForm({
      event_key: row?.event_key || "",
      name: row?.name || "",
      description: row?.description || "",
      title_template: row?.title_template || "",
      body_template: row?.body_template || "",
      url_template: row?.url_template || "/",
      category: row?.category || "operational",
      is_active: row?.is_active === true,
      threshold_value: row?.threshold_value ?? "",
      cooldown_minutes: row?.cooldown_minutes ?? 1440,
    });
  }

  function updatePushRuleField(field, value) {
    setPushRuleForm((form) => ({ ...form, [field]: value }));
  }

  async function onSavePushRule() {
    setPushRulesLoading(true);
    setPushRulesError("");
    setPushRulesMessage("");
    const payload = {
      ...pushRuleForm,
      threshold_value: pushRuleForm.threshold_value === "" ? null : Number(pushRuleForm.threshold_value),
      cooldown_minutes: pushRuleForm.cooldown_minutes === "" ? null : Number(pushRuleForm.cooldown_minutes),
    };
    try {
      if (editingPushRule?.id) {
        await updatePushRule(editingPushRule.id, payload);
        setPushRulesMessage("Regra de Push atualizada.");
      } else {
        await createPushRule(payload);
        setPushRulesMessage("Regra de Push criada.");
      }
      resetPushRuleForm();
      await loadPushRules();
    } catch (err) {
      setPushRulesError(parseNotificationsError(err));
    } finally {
      setPushRulesLoading(false);
    }
  }

  async function onSeedPushRules() {
    setPushRulesLoading(true);
    setPushRulesError("");
    setPushRulesMessage("");
    try {
      const res = await seedDefaultPushRules();
      setPushRulesMessage(`Regras padrão criadas: ${res?.created_count ?? 0}.`);
      await loadPushRules();
    } catch (err) {
      setPushRulesError(parseNotificationsError(err));
    } finally {
      setPushRulesLoading(false);
    }
  }

  const sendSummary = sendResult?.summary ?? sendResult;
  const sendCampaign = sendResult?.campaign ?? sendSummary?.campaign;
  const sendDispatches = sendResult?.dispatches ?? sendSummary?.dispatches ?? [];
  const manualCampaign = manualResult?.campaign;
  const manualDispatch = manualResult?.dispatch;

  const DISPATCH_TABLE_COLS = 20;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Toolbar sx={{ minHeight: 64 }}>
          <IconButton edge="start" color="inherit" onClick={() => nav("/admin")} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Typography sx={{ fontWeight: 900, ml: 1, flex: 1 }}>Central de Comunicação</Typography>
          <IconButton color="inherit" onClick={loadAll} disabled={loading} aria-label="Recarregar">
            <RefreshRoundedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>
          Central de Comunicação
        </Typography>
        <Typography sx={{ opacity: 0.75, mb: 3, maxWidth: 900 }}>
          Envie mensagens controladas, gerencie templates locais, acompanhe disparos e monitore entregas. O backend
          pode redirecionar envios em modo teste conforme configuração.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading && !health && (
          <Typography sx={{ mb: 2, opacity: 0.7 }}>Carregando…</Typography>
        )}

        {health && (
          <>
            <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
              <StatusCard
                label="Central"
                value={centralActive(health) ? "Ativa" : "Inativa"}
                ok={centralActive(health)}
              />
              <StatusCard label="Modo teste" value={testMode ? "Ativo" : "Inativo"} ok={!testMode} />
              <StatusCard
                label="Envio real para clientes"
                value={allowReal ? "Liberado" : "Bloqueado"}
                ok={allowReal}
              />
              <StatusCard
                label="Brevo WhatsApp"
                value={health.brevoWhatsappEnabled ? "Ativo" : "Inativo"}
                ok={health.brevoWhatsappEnabled}
              />
              <StatusCard
                label="API Key configurada"
                value={boolLabel(health.hasBrevoApiKey)}
                ok={health.hasBrevoApiKey}
              />
              <StatusCard
                label="Número remetente"
                value={boolLabel(health.senderNumberConfigured)}
                ok={health.senderNumberConfigured}
              />
              <StatusCard
                label="Número de teste"
                value={boolLabel(health.testRecipientConfigured)}
                ok={health.testRecipientConfigured}
              />
              <StatusCard
                label="Consentimento WhatsApp"
                value={health.whatsappConsentRequired === false ? "Nao exigido" : "Obrigatorio"}
                ok={health.whatsappConsentRequired !== false}
              />
              <StatusCard
                label="Telefone avulso"
                value={health.whatsappAllowUnlinkedPhone ? "Liberado" : "Bloqueado"}
                ok={!health.whatsappAllowUnlinkedPhone}
              />
            </Stack>

            {showTestAlert && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Modo teste ativo: qualquer envio será redirecionado somente para o número de teste configurado no
                backend. Nenhum cliente real receberá mensagens nesta fase.
              </Alert>
            )}
            {!health.hasBrevoApiKey && (
              <Alert severity="error" sx={{ mb: 2 }}>
                BREVO_API_KEY não configurada no backend.
              </Alert>
            )}
            {!health.testRecipientConfigured && (
              <Alert severity="error" sx={{ mb: 2 }}>
                NOTIFICATION_TEST_WHATSAPP_TO não configurado. O envio de teste será bloqueado.
              </Alert>
            )}
            {health.genericTestTemplateEnvConfigured === false && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Template de teste não configurado. Preencha o campo Template ID no formulário, configure
                BREVO_WHATSAPP_GENERIC_TEST_TEMPLATE_ID no Render ou atualize provider_template_id do template
                GENERIC_TEST no banco.
              </Alert>
            )}
          </>
        )}

        <Paper variant="outlined" sx={adminTabsPaperSx}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
            {TAB_LABELS.map((label) => (
              <Tab key={label} label={label} />
            ))}
          </Tabs>
        </Paper>

        {tab === 0 && (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, ...adminPanelPaperSx }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.5 }}>
              Enviar mensagem
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.75, mb: 2, maxWidth: 720 }}>
              Envie mensagens controladas para clientes selecionados. Em modo teste, o backend pode redirecionar os
              envios conforme configuração.
            </Typography>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Para evitar bloqueios no WhatsApp, mensagens so podem ser enviadas para usuarios com opt-in explicito.
              Telefone cadastrado nao conta como autorizacao.
            </Alert>

            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
              Destinatários
            </Typography>
            <Autocomplete
              freeSolo
              options={filteredRecipientOptions}
              loading={recipientSearchLoading}
              inputValue={recipientSearch}
              onInputChange={(_, value) => setRecipientSearch(value)}
              getOptionLabel={(opt) =>
                typeof opt === "string"
                  ? opt
                  : opt.name ?? opt.full_name ?? opt.fullName ?? opt.phone ?? opt.email ?? ""
              }
              filterOptions={(x) => x}
              onChange={(_, value) => {
                if (!value || typeof value === "string") return;
                addRecipient(mapSearchHitToRecipient(value));
              }}
              renderOption={(props, opt) => (
                <li {...props} key={opt.user_id ?? opt.userId ?? opt.id ?? opt.phone}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {opt.name ?? opt.full_name ?? opt.fullName ?? "Cliente"}
                    </Typography>
                    <Typography variant="caption" sx={{ display: "block", opacity: 0.8 }}>
                      {opt.phone ?? opt.whatsapp ?? "—"} · {opt.email ?? "—"}
                    </Typography>
                    {(opt.balance != null || opt.saldo != null) && (
                      <Typography variant="caption" sx={{ display: "block", opacity: 0.7 }}>
                        Saldo: {opt.balance ?? opt.saldo}
                      </Typography>
                    )}
                    <Chip
                      size="small"
                      sx={{ mt: 0.5 }}
                      label={whatsappConsentStatusLabel(opt.whatsapp_consent_status, opt.whatsapp_can_send)}
                      color={whatsappConsentChipColor(opt.whatsapp_consent_status, opt.whatsapp_can_send)}
                    />
                  </Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Buscar por nome, telefone ou e-mail"
                  helperText="Digite pelo menos 2 caracteres para buscar clientes."
                />
              )}
              sx={{ mb: 1 }}
            />
            <Button size="small" sx={{ mb: 1 }} onClick={() => setShowManualPhone((v) => !v)}>
              {showManualPhone ? "Cancelar telefone avulso" : "Adicionar telefone avulso"}
            </Button>
            {showManualPhone && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Telefone"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="5585999999999"
                />
                <Button variant="outlined" onClick={onAddManualPhone}>
                  Adicionar
                </Button>
              </Stack>
            )}
            {selectedRecipients.length > 0 && (
              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                {selectedRecipients.map((r) => {
                  const key = recipientDedupeKey(r);
                  const label =
                    r.type === "manual_phone"
                      ? `${r.name}: ${r.phone}`
                      : `${r.name}${r.phone ? ` (${r.phone})` : ""}`;
                  const consentLabel = r.type === "manual_phone"
                    ? "Telefone avulso"
                    : whatsappConsentStatusLabel(r.whatsapp_consent_status, r.whatsapp_can_send);
                  return (
                    <Chip
                      key={key}
                      label={`${label} · ${consentLabel}`}
                      color={r.type === "manual_phone" ? "warning" : whatsappConsentChipColor(r.whatsapp_consent_status, r.whatsapp_can_send)}
                      onDelete={() => removeRecipient(key)}
                    />
                  );
                })}
              </Stack>
            )}

            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Template</InputLabel>
                  <Select
                    label="Template"
                    value={selectedTemplateOptionId}
                    onChange={(e) => onSelectSendTemplate(e.target.value)}
                  >
                    <MenuItem value="">
                      <em>Selecione um template</em>
                    </MenuItem>
                    {templates.map((tpl) => {
                      const oid = templateSelectOptionId(tpl);
                      const name = tpl.name ?? tpl.title ?? tpl.template_key ?? tpl.templateKey ?? oid;
                      const pid = tpl.provider_template_id ?? tpl.providerTemplateId ?? "—";
                      return (
                        <MenuItem key={oid} value={oid}>
                          {name} · {pid}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Template Key"
                  value={sendForm.template_key}
                  onChange={(e) => updateSendField("template_key", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Template ID (Brevo)"
                  value={sendForm.template_id}
                  onChange={(e) => updateSendField("template_id", e.target.value)}
                  helperText="Preenchido automaticamente ao selecionar um template."
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  label="Mensagem"
                  value={sendForm.message}
                  onChange={(e) => updateSendField("message", e.target.value)}
                  helperText="Para WhatsApp via Brevo, o template precisa possuir um parâmetro como {{ params.message }} para que este texto seja enviado."
                />
              </Grid>
            </Grid>

            <Button
              size="small"
              startIcon={advancedOpen ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
              onClick={() => setAdvancedOpen((v) => !v)}
              sx={{ mt: 2 }}
            >
              Parâmetros avançados
            </Button>
            <Collapse in={advancedOpen}>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Nome do cliente"
                    value={sendForm.customer_name}
                    onChange={(e) => updateSendField("customer_name", e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Prêmio/Campanha"
                    value={sendForm.prize_name}
                    onChange={(e) => updateSendField("prize_name", e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Valor da cota"
                    value={sendForm.ticket_price}
                    onChange={(e) => updateSendField("ticket_price", e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Números"
                    value={sendForm.numbers}
                    onChange={(e) => updateSendField("numbers", e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Link autorizar"
                    value={sendForm.authorize_url}
                    onChange={(e) => updateSendField("authorize_url", e.target.value)}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Link recusar"
                    value={sendForm.decline_url}
                    onChange={(e) => updateSendField("decline_url", e.target.value)}
                  />
                </Grid>
              </Grid>
            </Collapse>

            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={useCustomRecipient}
                    disabled={!customRecipientsEnabled}
                    onChange={(e) => setUseCustomRecipient(e.target.checked)}
                  />
                }
                label="Enviar para o número selecionado/digitado neste teste"
              />
              {!customRecipientsEnabled && (
                <Typography variant="caption" sx={{ display: "block", opacity: 0.75, ml: 4 }}>
                  Backend configurado para redirecionar envios para o número de teste.
                </Typography>
              )}
              <Typography variant="caption" sx={{ display: "block", opacity: 0.65, ml: 4, mt: 0.5 }}>
                Campanhas e envios em massa continuam controlados pelo backend.
              </Typography>
            </Box>

            <Button
              variant="contained"
              sx={{ mt: 2, borderRadius: 999 }}
              disabled={sendSending}
              onClick={onSendMessage}
            >
              {sendSending ? "Enviando…" : "Enviar mensagem"}
            </Button>
            {sendError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {sendError}
              </Alert>
            )}
            {sendResult && (
              <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                  Resultado do envio
                </Typography>
                <Stack spacing={0.5}>
                  <Typography variant="body2">ok: {String(sendResult.ok ?? sendResult.success ?? "—")}</Typography>
                  <Typography variant="body2">
                    campaign_id: {sendCampaign?.id ?? sendResult.campaign_id ?? sendResult.campaignId ?? "—"}
                  </Typography>
                  <Typography variant="body2">
                    total solicitado:{" "}
                    {sendSummary?.requested_count ?? sendSummary?.requestedCount ?? sendResult.requested_count ?? "—"}
                  </Typography>
                  <Typography variant="body2">
                    aceitos pela Brevo:{" "}
                    {sendSummary?.accepted_count ?? sendSummary?.acceptedCount ?? sendResult.accepted_count ?? "—"}
                  </Typography>
                  <Typography variant="body2">
                    falhas: {sendSummary?.failed_count ?? sendSummary?.failedCount ?? sendResult.failed_count ?? "—"}
                  </Typography>
                  <Typography variant="body2">
                    ignorados: {sendSummary?.skipped_count ?? sendSummary?.skippedCount ?? sendResult.skipped_count ?? "—"}
                  </Typography>
                  <Typography variant="body2">
                    redirecionados (modo teste):{" "}
                    {sendSummary?.forced_count ?? sendSummary?.forcedCount ?? sendResult.forced_count ?? "—"}
                  </Typography>
                  {(sendResult.warning ?? sendSummary?.warning) && (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      {sendResult.warning ?? sendSummary?.warning}
                    </Alert>
                  )}
                </Stack>
                <Alert severity="info" sx={{ mt: 1 }}>
                  Accepted significa que a Brevo aceitou o envio. A entrega real é confirmada pelos eventos da Brevo.
                </Alert>
                {Array.isArray(sendDispatches) && sendDispatches.length > 0 && (
                  <TableContainer sx={{ mt: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>dispatch_id</TableCell>
                          <TableCell>recipient</TableCell>
                          <TableCell>original</TableCell>
                          <TableCell>forçado?</TableCell>
                          <TableCell>modo</TableCell>
                          <TableCell>status</TableCell>
                          <TableCell>provider_message_id</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sendDispatches.map((d, idx) => (
                          <TableRow key={d.id ?? idx}>
                            <TableCell>{d.id ?? "—"}</TableCell>
                            <TableCell>{d.recipient ?? d.to ?? "—"}</TableCell>
                            <TableCell>{d.recipient_original ?? d.recipientOriginal ?? "—"}</TableCell>
                            <TableCell>{boolLabel(d.recipient_forced ?? d.recipientForced)}</TableCell>
                            <TableCell>{d.recipient_mode ?? d.recipientMode ?? "—"}</TableCell>
                            <TableCell>{d.status ?? "—"}</TableCell>
                            <TableCell>{d.provider_message_id ?? d.providerMessageId ?? "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Paper>
            )}
          </Paper>
        )}

        {tab === 1 && (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, ...adminPanelPaperSx }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={dispatchStatus}
                  onChange={(e) => setDispatchStatus(e.target.value)}
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="accepted">accepted</MenuItem>
                  <MenuItem value="sent">sent</MenuItem>
                  <MenuItem value="delivered">delivered</MenuItem>
                  <MenuItem value="read">read</MenuItem>
                  <MenuItem value="failed">failed</MenuItem>
                  <MenuItem value="rejected">rejected</MenuItem>
                  <MenuItem value="skipped">skipped</MenuItem>
                  <MenuItem value="pending">pending</MenuItem>
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="Canal"
                value={dispatchChannel}
                onChange={(e) => setDispatchChannel(e.target.value)}
              />
              <TextField
                size="small"
                label="Provider"
                value={dispatchProvider}
                onChange={(e) => setDispatchProvider(e.target.value)}
              />
              <Button
                variant="outlined"
                startIcon={<RefreshRoundedIcon />}
                disabled={loadingDispatches}
                onClick={() => loadDispatches()}
              >
                {loadingDispatches ? "Atualizando…" : "Atualizar"}
              </Button>
              <Button
                variant="outlined"
                disabled={exportingCsv || loadingDispatches}
                onClick={onExportDispatchesCsv}
              >
                {exportingCsv ? "Exportando…" : "Exportar CSV"}
              </Button>
            </Stack>
            {exportCsvMessage && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {exportCsvMessage}
              </Alert>
            )}
            {exportCsvError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {exportCsvError}
              </Alert>
            )}
            {dispatchError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {dispatchError}
              </Alert>
            )}
            <Typography variant="body2" sx={{ mb: 1, opacity: 0.75 }}>
              Total carregado: {dispatches.length} | Exibindo: {visibleDispatches.length}
            </Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              Accepted/sent significa que a Brevo aceitou o envio. A entrega real depende dos eventos da Brevo.
            </Alert>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell>Data</TableCell>
                    <TableCell>Evento</TableCell>
                    <TableCell>Canal</TableCell>
                    <TableCell>Provider</TableCell>
                    <TableCell>Template</TableCell>
                    <TableCell>Campanha</TableCell>
                    <TableCell>Destinatário</TableCell>
                    <TableCell>Dest. original</TableCell>
                    <TableCell>Forçado?</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Provider Status</TableCell>
                    <TableCell>Delivery Status</TableCell>
                    <TableCell>Delivery Checked At</TableCell>
                    <TableCell>Delivery Confirmed At</TableCell>
                    <TableCell>Tentativas</TableCell>
                    <TableCell>Provider Msg ID</TableCell>
                    <TableCell>Erro</TableCell>
                    <TableCell>Enviado em</TableCell>
                    <TableCell>Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleDispatches.map((row, idx) => {
                    const id = row.id != null ? String(row.id) : `d-${idx}`;
                    const syncState = deliverySyncById[id] || {};
                    return (
                      <React.Fragment key={id}>
                        <TableRow hover>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => setExpandedDispatch(expandedDispatch === id ? null : id)}
                              aria-label="Expandir detalhes"
                            >
                              {expandedDispatch === id ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                            </IconButton>
                          </TableCell>
                          <TableCell>{fmtDate(row.created_at ?? row.createdAt ?? row.sent_at)}</TableCell>
                          <TableCell>{row.event ?? row.event_type ?? "—"}</TableCell>
                          <TableCell>{row.channel ?? "—"}</TableCell>
                          <TableCell>{row.provider ?? "—"}</TableCell>
                          <TableCell>{row.template_key ?? row.templateKey ?? row.template ?? "—"}</TableCell>
                          <TableCell>{row.campaign_id ?? row.campaignId ?? "—"}</TableCell>
                          <TableCell>{row.recipient ?? row.to ?? "—"}</TableCell>
                          <TableCell>{row.recipient_original ?? row.recipientOriginal ?? "—"}</TableCell>
                          <TableCell>{boolLabel(row.recipient_forced ?? row.recipientForced)}</TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={dispatchStatusLabel(row)}
                              color={statusChipColor(row.status)}
                            />
                          </TableCell>
                          <TableCell>{row.provider_status ?? row.providerStatus ?? "—"}</TableCell>
                          <TableCell>
                            {deliveryStatusLabel(row.delivery_status ?? row.deliveryStatus)}
                          </TableCell>
                          <TableCell>
                            {fmtDate(row.delivery_checked_at ?? row.deliveryCheckedAt)}
                          </TableCell>
                          <TableCell>
                            {fmtDate(row.delivery_confirmed_at ?? row.deliveryConfirmedAt)}
                          </TableCell>
                          <TableCell>{row.attempts ?? row.attempt_count ?? "—"}</TableCell>
                          <TableCell>{row.provider_message_id ?? row.providerMessageId ?? "—"}</TableCell>
                          <TableCell sx={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {whatsappConsentReasonLabel(row.error_message ?? row.error ?? row.last_error)}
                          </TableCell>
                          <TableCell>{fmtDate(row.sent_at ?? row.sentAt)}</TableCell>
                          <TableCell sx={{ minWidth: 140 }}>
                            {canSyncDelivery(row) ? (
                              <Stack spacing={0.5}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  disabled={syncState.loading}
                                  onClick={() => onSyncDispatchDelivery(id)}
                                >
                                  {syncState.loading ? "…" : "Atualizar entrega"}
                                </Button>
                                {syncState.matched && (
                                  <Stack spacing={0.25}>
                                    <Typography variant="caption" sx={{ display: "block" }}>
                                      event: {syncState.matched.event ?? syncState.matched.name ?? "—"}
                                    </Typography>
                                    <Typography variant="caption" sx={{ display: "block" }}>
                                      date: {fmtDate(syncState.matched.date ?? syncState.matched.timestamp)}
                                    </Typography>
                                    {(syncState.matched.reason || syncState.matched.error) && (
                                      <Typography variant="caption" sx={{ display: "block" }}>
                                        reason: {syncState.matched.reason || syncState.matched.error}
                                      </Typography>
                                    )}
                                    {syncState.statusUpdatedTo && (
                                      <Typography variant="caption" sx={{ display: "block" }}>
                                        status_updated_to: {syncState.statusUpdatedTo}
                                      </Typography>
                                    )}
                                    {syncState.message && (
                                      <Typography variant="caption" sx={{ display: "block" }}>
                                        message: {syncState.message}
                                      </Typography>
                                    )}
                                  </Stack>
                                )}
                                {syncState.info && (
                                  <Typography variant="caption" color="text.secondary">
                                    {syncState.info}
                                  </Typography>
                                )}
                                {syncState.error && (
                                  <Typography variant="caption" color="error.main">
                                    {syncState.error}
                                  </Typography>
                                )}
                              </Stack>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={DISPATCH_TABLE_COLS} sx={{ py: 0, border: 0 }}>
                            <Collapse in={expandedDispatch === id}>
                              <Box sx={{ p: 2, bgcolor: "rgba(0,0,0,0.25)", borderRadius: 2, mb: 1 }}>
                                <AuditJsonBlock
                                  title="Delivery Event"
                                  value={row.delivery_event ?? row.deliveryEvent}
                                />
                                <AuditJsonBlock
                                  title="Delivery Events Raw"
                                  value={row.delivery_events_raw ?? row.deliveryEventsRaw}
                                />
                                <AuditJsonBlock title="Response" value={row.response ?? row.provider_response} />
                                <AuditJsonBlock
                                  title="Message Snapshot"
                                  value={row.message_snapshot ?? row.messageSnapshot}
                                />
                                <AuditJsonBlock
                                  title="Recipient Snapshot"
                                  value={row.recipient_snapshot ?? row.recipientSnapshot}
                                />
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                  {visibleDispatches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={DISPATCH_TABLE_COLS} align="center" sx={{ opacity: 0.6, py: 3, whiteSpace: "normal" }}>
                        {dispatches.length > 0
                          ? "Nenhum disparo corresponde aos filtros selecionados. Limpe os filtros ou clique em Atualizar."
                          : "Nenhum disparo encontrado. Se você acabou de enviar um teste, clique em Atualizar. Caso continue vazio, verifique no Network se a API retornou rows/dispatches."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Paper variant="outlined" sx={{ mt: 3, p: 2, borderRadius: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
                Consultar eventos Brevo
              </Typography>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
                <TextField
                  size="small"
                  label="Número WhatsApp"
                  value={brevoEventsPhone}
                  onChange={(e) => setBrevoEventsPhone(e.target.value)}
                  placeholder="5585999498149"
                  helperText="Vazio = número de teste do backend"
                  sx={{ minWidth: 220 }}
                />
                <TextField
                  size="small"
                  type="number"
                  label="Dias"
                  value={brevoEventsDays}
                  onChange={(e) => setBrevoEventsDays(Math.max(1, Number(e.target.value) || 1))}
                  inputProps={{ min: 1 }}
                  sx={{ width: 100 }}
                />
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Evento</InputLabel>
                  <Select
                    label="Evento"
                    value={brevoEventsEvent}
                    onChange={(e) => setBrevoEventsEvent(e.target.value)}
                  >
                    {BREVO_EVENT_FILTER_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value || "all"} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button variant="contained" disabled={brevoEventsLoading} onClick={onFetchBrevoEvents}>
                  {brevoEventsLoading ? "Consultando…" : "Consultar eventos Brevo"}
                </Button>
              </Stack>
              {brevoEventsError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {brevoEventsError}
                </Alert>
              )}
              <Typography variant="body2" sx={{ mb: 1, opacity: 0.75 }}>
                Eventos carregados: {brevoEvents.length}
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell />
                      <TableCell>Data</TableCell>
                      <TableCell>Evento</TableCell>
                      <TableCell>Message ID</TableCell>
                      <TableCell>Número</TableCell>
                      <TableCell>Motivo/Erro</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {brevoEvents.map((ev, idx) => {
                      const eid = ev.id ?? ev.messageId ?? `ev-${idx}`;
                      return (
                        <React.Fragment key={eid}>
                          <TableRow hover>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => setExpandedBrevoEvent(expandedBrevoEvent === eid ? null : eid)}
                              >
                                {expandedBrevoEvent === eid ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                              </IconButton>
                            </TableCell>
                            <TableCell>{fmtDate(ev.date ?? ev.timestamp ?? ev.created_at)}</TableCell>
                            <TableCell>{ev.event ?? ev.name ?? ev.type ?? "—"}</TableCell>
                            <TableCell>{ev.messageId ?? ev.message_id ?? ev.id ?? "—"}</TableCell>
                            <TableCell>
                              {ev.contactNumber ?? ev.contact_number ?? ev.phone ?? ev.number ?? ev.to ?? "—"}
                            </TableCell>
                            <TableCell>{ev.reason ?? ev.error ?? ev.description ?? "—"}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell colSpan={6} sx={{ py: 0, border: 0 }}>
                              <Collapse in={expandedBrevoEvent === eid}>
                                <Box
                                  component="pre"
                                  sx={{ fontSize: 11, p: 2, bgcolor: "rgba(0,0,0,0.25)", borderRadius: 2, overflow: "auto" }}
                                >
                                  {JSON.stringify(ev, null, 2)}
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      );
                    })}
                    {brevoEvents.length === 0 && !brevoEventsLoading && (
                      <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ opacity: 0.6, py: 2 }}>
                          Não há eventos da Brevo para esse número/período.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Paper>
        )}

        {tab === 2 && (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, ...adminPanelPaperSx }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Esta aba apenas monitora mensagens recebidas via webhook. Respostas automáticas serão implementadas em uma
              fase futura.
            </Alert>
            <Button
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              sx={{ mb: 2 }}
              disabled={loadingInbound}
              onClick={() => loadInbound()}
            >
              {loadingInbound ? "Atualizando…" : "Atualizar"}
            </Button>
            {inboundError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {inboundError}
              </Alert>
            )}
            <Typography variant="body2" sx={{ mb: 1, opacity: 0.75 }}>
              Mensagens carregadas: {inboundMessages.length}
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell>Data</TableCell>
                    <TableCell>Provider</TableCell>
                    <TableCell>Canal</TableCell>
                    <TableCell>Evento</TableCell>
                    <TableCell>From</TableCell>
                    <TableCell>To</TableCell>
                    <TableCell>Texto</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {inboundMessages.map((row, idx) => {
                    const id = row.id ?? `i-${idx}`;
                    const raw = row.payload ?? row.raw ?? row;
                    return (
                      <React.Fragment key={id}>
                        <TableRow hover>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => setExpandedInbound(expandedInbound === id ? null : id)}
                            >
                              {expandedInbound === id ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />}
                            </IconButton>
                          </TableCell>
                          <TableCell>{fmtDate(row.created_at ?? row.received_at)}</TableCell>
                          <TableCell>{row.provider ?? "—"}</TableCell>
                          <TableCell>{row.channel ?? "—"}</TableCell>
                          <TableCell>{row.event ?? row.event_type ?? "—"}</TableCell>
                          <TableCell>{row.from ?? row.sender ?? "—"}</TableCell>
                          <TableCell>{row.to ?? row.recipient ?? "—"}</TableCell>
                          <TableCell sx={{ maxWidth: 240 }}>{row.text ?? row.body ?? row.message ?? "—"}</TableCell>
                          <TableCell>
                            <Chip size="small" label={row.status ?? "—"} color={statusChipColor(row.status)} />
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={9} sx={{ py: 0, border: 0 }}>
                            <Collapse in={expandedInbound === id}>
                              <Box component="pre" sx={{ fontSize: 11, p: 2, bgcolor: "rgba(0,0,0,0.25)", borderRadius: 2, overflow: "auto" }}>
                                {JSON.stringify(raw, null, 2)}
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                  {inboundMessages.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ opacity: 0.6, py: 3, whiteSpace: "normal" }}>
                        Nenhuma mensagem recebida ainda. Esta aba só será preenchida após configurar o webhook inbound
                        da Brevo e receber uma mensagem.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {tab === 3 && (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, ...adminPanelPaperSx }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Sincronize os modelos WhatsApp da Brevo para atualizar provider_template_id. Edite aqui o modelo local
              usado pelo sistema — alterações não substituem o template aprovado na Brevo.
            </Alert>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Alterações nesta tela ajustam o modelo local usado pelo sistema. Para alterar o conteúdo aprovado do
              WhatsApp, edite o template na Brevo.
            </Alert>
            {templateSaveMessage && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setTemplateSaveMessage("")}>
                {templateSaveMessage}
              </Alert>
            )}
            <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mb: 2 }}>
              <Button
                variant="contained"
                disabled={syncingBrevo}
                onClick={onSyncBrevoTemplates}
              >
                {syncingBrevo ? "Sincronizando…" : "Sincronizar modelos da Brevo"}
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshRoundedIcon />}
                disabled={loadingTemplates}
                onClick={() => loadTemplates()}
              >
                {loadingTemplates ? "Atualizando…" : "Atualizar lista"}
              </Button>
            </Stack>
            {syncBrevoMessage && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {syncBrevoMessage}
              </Alert>
            )}
            {syncBrevoError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {syncBrevoError}
              </Alert>
            )}
            {templatesError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {templatesError}
              </Alert>
            )}
            <Typography variant="body2" sx={{ mb: 1, opacity: 0.75 }}>
              Templates carregados: {templates.length}
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Template Key</TableCell>
                    <TableCell>Canal</TableCell>
                    <TableCell>Provider</TableCell>
                    <TableCell>Provider Template ID</TableCell>
                    <TableCell>Nome</TableCell>
                    <TableCell>Ativo</TableCell>
                    <TableCell>Preview</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.map((row, idx) => (
                    <TableRow key={row.id ?? row.template_key ?? idx} hover>
                      <TableCell>{row.template_key ?? row.templateKey ?? "—"}</TableCell>
                      <TableCell>{row.channel ?? "—"}</TableCell>
                      <TableCell>{row.provider ?? "—"}</TableCell>
                      <TableCell>{row.provider_template_id ?? row.providerTemplateId ?? "—"}</TableCell>
                      <TableCell>{row.name ?? row.title ?? "—"}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={templateActiveLabel(row)}
                          color={templateActiveColor(row)}
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280, whiteSpace: "pre-wrap" }}>
                        {row.body_preview ?? row.bodyPreview ?? row.preview ?? row.preview_text ?? "—"}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={row.id == null}
                          onClick={() => openTemplateEditor(row)}
                        >
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!templates.length && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ opacity: 0.6, py: 3, whiteSpace: "normal" }}>
                        Nenhum template carregado. Verifique se a tabela notification_templates possui registros ou
                        clique em sincronizar modelos da Brevo.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {tab === 4 && (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, ...adminPanelPaperSx }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
              Simular audiência (sem envio real para clientes)
            </Typography>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Simulação apenas. Mesmo que você escolha todos os clientes, o backend está em modo teste e enviará
              somente para o número de teste.
            </Alert>
            <Stack spacing={2} sx={{ maxWidth: 480 }}>
              <FormControl fullWidth>
                <InputLabel>Filtro</InputLabel>
                <Select
                  label="Filtro"
                  value={audienceFilter}
                  onChange={(e) => setAudienceFilter(e.target.value)}
                >
                  {AUDIENCE_FILTERS.map((f) => (
                    <MenuItem key={f.value} value={f.value}>
                      {f.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {audienceFilter === "specific_user" && (
                <TextField
                  fullWidth
                  label="user_id"
                  value={audienceUserId}
                  onChange={(e) => setAudienceUserId(e.target.value)}
                />
              )}
              {audienceFilter === "specific_phone" && (
                <TextField
                  fullWidth
                  label="phone"
                  value={audiencePhone}
                  onChange={(e) => setAudiencePhone(e.target.value)}
                  placeholder="5585999999999"
                />
              )}
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <Button variant="contained" disabled={audienceEstimating} onClick={onEstimateAudience}>
                  {audienceEstimating ? "Estimando…" : "Estimar audiência"}
                </Button>
                <Button
                  variant="outlined"
                  disabled={
                    manualSending ||
                    (realWhatsappSendMode && Number(audienceEstimate?.allowed_by_whatsapp_consent || 0) <= 0)
                  }
                  onClick={onManualSendTest}
                >
                  {manualSending ? "Enviando…" : "Enviar teste com este filtro"}
                </Button>
              </Stack>
            </Stack>
            {audienceEstimateError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {audienceEstimateError}
              </Alert>
            )}
            {audienceEstimate && (
              <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                  Estimativa
                </Typography>
                <Typography variant="body2">estimated_count: {audienceEstimate.estimated_count ?? "—"}</Typography>
                <Typography variant="body2">total_candidates: {audienceEstimate.total_candidates ?? "—"}</Typography>
                <Typography variant="body2">
                  autorizados_whatsapp: {audienceEstimate.allowed_by_whatsapp_consent ?? "—"}
                </Typography>
                <Typography variant="body2">
                  bloqueados_sem_opt_in_whatsapp: {audienceEstimate.blocked_by_whatsapp_consent ?? "—"}
                </Typography>
                <Typography variant="body2">filter: {audienceEstimate.filter ?? audienceFilter}</Typography>
                <Typography variant="body2">test_mode: {String(audienceEstimate.test_mode ?? testMode)}</Typography>
                <Typography variant="body2">
                  allow_real_recipients: {String(audienceEstimate.allow_real_recipients ?? allowReal)}
                </Typography>
                <Typography variant="body2">message: {audienceEstimate.message ?? "—"}</Typography>
              </Paper>
            )}
            {manualError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {manualError}
              </Alert>
            )}
            {manualResult && (
              <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                  Resultado do envio com filtro
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Em modo teste, a campanha é registrada para auditoria, mas apenas um envio é feito para o número de
                  teste. Nenhum cliente real recebe mensagem nesta fase.
                </Alert>
                <Stack spacing={0.5}>
                  <Typography variant="body2">campaign.id: {manualCampaign?.id ?? "—"}</Typography>
                  <Typography variant="body2">
                    campaign.audience_filter: {manualCampaign?.audience_filter ?? manualCampaign?.audienceFilter ?? "—"}
                  </Typography>
                  <Typography variant="body2">
                    campaign.estimated_count: {manualCampaign?.estimated_count ?? manualCampaign?.estimatedCount ?? "—"}
                  </Typography>
                  <Typography variant="body2">campaign.status: {manualCampaign?.status ?? "—"}</Typography>
                  <Typography variant="body2">dispatch.id: {manualDispatch?.id ?? manualResult?.dispatch_id ?? "—"}</Typography>
                  <Typography variant="body2">warning: {manualResult?.warning ?? manualResult?.code ?? "—"}</Typography>
                </Stack>
                {(manualResult.warning || manualResult.code) && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    {manualResult.warning || manualResult.code || "TEST_MODE_ACTIVE_REAL_RECIPIENTS_BLOCKED"}
                  </Alert>
                )}
              </Paper>
            )}
          </Paper>
        )}

        {tab === 5 && (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4, ...adminPanelPaperSx }}>
            <Tabs
              value={pushPanel}
              onChange={(_, value) => setPushPanel(value)}
              sx={{ mb: 2 }}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab value="history" label="Histórico de Push" />
              <Tab value="rules" label="Regras automáticas" />
            </Tabs>

            {pushPanel === "history" && (
              <>
            <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Histórico de Push
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.72 }}>
                  Visualização somente leitura dos Push registrados pelo backend/engine.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                startIcon={<RefreshRoundedIcon />}
                disabled={pushLoading}
                onClick={() => loadPushData()}
              >
                {pushLoading ? "Atualizando…" : "Atualizar"}
              </Button>
            </Stack>

            <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mb: 2 }}>
              <StatusCard label="Total" value={pushSummary?.total_dispatches ?? "—"} />
              <StatusCard label="Enviados" value={pushSummary?.sent ?? "—"} ok />
              <StatusCard label="Falhas" value={pushSummary?.failed ?? "—"} ok={Number(pushSummary?.failed || 0) === 0} />
              <StatusCard label="Pendentes" value={pushSummary?.pending ?? "—"} />
              <StatusCard label="Dispositivos ativos" value={pushSummary?.active_devices ?? "—"} />
              <StatusCard label="Usuários com Push ativo" value={pushSummary?.active_subscribers ?? "—"} />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
              <TextField
                size="small"
                label="Buscar"
                value={pushFilters.q}
                onChange={(e) => setPushFilters((f) => ({ ...f, q: e.target.value }))}
                placeholder="Nome, e-mail, ID, evento ou título"
                sx={{ minWidth: 260 }}
              />
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={pushFilters.status}
                  onChange={(e) => setPushFilters((f) => ({ ...f, status: e.target.value }))}
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="sent">sent</MenuItem>
                  <MenuItem value="failed">failed</MenuItem>
                  <MenuItem value="pending">pending</MenuItem>
                  <MenuItem value="dry_run">dry_run</MenuItem>
                  <MenuItem value="skipped">skipped</MenuItem>
                  <MenuItem value="deduped">deduped</MenuItem>
                </Select>
              </FormControl>
              <TextField
                size="small"
                label="event_key"
                value={pushFilters.event_key}
                onChange={(e) => setPushFilters((f) => ({ ...f, event_key: e.target.value }))}
              />
              <TextField
                size="small"
                label="user_id"
                value={pushFilters.user_id}
                onChange={(e) => setPushFilters((f) => ({ ...f, user_id: e.target.value }))}
                sx={{ width: 120 }}
              />
              <Button
                variant="contained"
                disabled={pushLoading}
                onClick={() => loadPushData({ page: 1 })}
              >
                Filtrar
              </Button>
            </Stack>

            {pushError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {pushError}
              </Alert>
            )}
            {!pushError && pushLogs.length === 0 && !pushLoading && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Nenhum registro de Push encontrado para os filtros atuais.
              </Alert>
            )}
            <Typography variant="body2" sx={{ mb: 1, opacity: 0.75 }}>
              Total: {pushTotal} | Página {pushFilters.page} | Exibindo: {pushLogs.length}
            </Typography>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Usuário</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Evento</TableCell>
                    <TableCell>Origem</TableCell>
                    <TableCell>Scan ID</TableCell>
                    <TableCell>Data do evento</TableCell>
                    <TableCell>Referência</TableCell>
                    <TableCell>Título</TableCell>
                    <TableCell>Mensagem</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Dispositivo</TableCell>
                    <TableCell>Erro</TableCell>
                    <TableCell>Enviado em</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pushLogs.map((row, idx) => (
                    <TableRow key={row.id ?? idx} hover>
                      <TableCell>{fmtDate(row.created_at)}</TableCell>
                      <TableCell>
                        {row.user_id ?? "—"}
                        {row.user_name ? ` · ${row.user_name}` : ""}
                      </TableCell>
                      <TableCell>{row.user_email ?? "—"}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace" }}>
                          {row.event_key ?? "—"}
                        </Typography>
                        {row.category && (
                          <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            {row.category}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{row.source || "—"}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace" }}>
                          {row.scan_id || "—"}
                        </Typography>
                      </TableCell>
                      <TableCell>{fmtDate(row.occurred_at)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace" }}>
                          {row.reference_key || "—"}
                        </Typography>
                        {row.reference_type && (
                          <Typography variant="caption" sx={{ opacity: 0.7 }}>
                            {row.reference_type}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 180 }}>{row.title ?? "—"}</TableCell>
                      <TableCell sx={{ maxWidth: 260, whiteSpace: "normal" }}>{row.body ?? "—"}</TableCell>
                      <TableCell>
                        <Chip size="small" label={pushStatusLabel(row.status, row)} color={statusChipColor(row.status)} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 180 }}>
                        <Typography variant="body2">{row.device_label || row.subscription_id || "—"}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          ativo: {boolLabel(row.subscription_active)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {pushSafetyReasonLabel(row.error_message)}
                      </TableCell>
                      <TableCell>{fmtDate(row.sent_at)}</TableCell>
                    </TableRow>
                  ))}
                  {pushLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={14} align="center" sx={{ opacity: 0.6, py: 3 }}>
                        {pushLoading ? "Carregando histórico de Push…" : "Sem registros."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                disabled={pushLoading || pushFilters.page <= 1}
                onClick={() => loadPushData({ page: Math.max(1, Number(pushFilters.page || 1) - 1) })}
              >
                Anterior
              </Button>
              <Button
                variant="outlined"
                disabled={
                  pushLoading ||
                  Number(pushFilters.page || 1) * Number(pushFilters.pageSize || 20) >= Number(pushTotal || 0)
                }
                onClick={() => loadPushData({ page: Number(pushFilters.page || 1) + 1 })}
              >
                Próxima
              </Button>
            </Stack>
              </>
            )}

            {pushPanel === "rules" && (
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                      Regras automáticas de Push
                    </Typography>
                    <Typography variant="body2" sx={{ opacity: 0.72 }}>
                      Configure mensagens que o backend/engine poderá usar futuramente. Salvar não dispara Push.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Button variant="outlined" disabled={pushRulesLoading} onClick={() => loadPushRules()}>
                      {pushRulesLoading ? "Atualizando…" : "Atualizar"}
                    </Button>
                    <Button variant="outlined" disabled={pushRulesLoading} onClick={onSeedPushRules}>
                      Criar regras padrão
                    </Button>
                    <Button variant="contained" disabled={pushRulesLoading} onClick={() => openPushRuleEditor(null)}>
                      Adicionar regra
                    </Button>
                  </Stack>
                </Stack>

                {pushRulesError && <Alert severity="error">{pushRulesError}</Alert>}
                {pushRulesMessage && <Alert severity="success">{pushRulesMessage}</Alert>}

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2 }}>
                    {editingPushRule?.id ? "Editar regra" : "Nova regra"}
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth size="small" disabled={Boolean(editingPushRule?.id)}>
                        <InputLabel>Evento</InputLabel>
                        <Select
                          label="Evento"
                          value={pushRuleForm.event_key}
                          onChange={(e) => updatePushRuleField("event_key", e.target.value)}
                        >
                          <MenuItem value="">
                            <em>Selecione</em>
                          </MenuItem>
                          {pushRuleEvents.map((eventKey) => (
                            <MenuItem key={eventKey} value={eventKey}>
                              {eventKey}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth size="small" label="Nome" value={pushRuleForm.name} onChange={(e) => updatePushRuleField("name", e.target.value)} />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth size="small" label="Descrição" value={pushRuleForm.description} onChange={(e) => updatePushRuleField("description", e.target.value)} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth size="small" label="Título" value={pushRuleForm.title_template} onChange={(e) => updatePushRuleField("title_template", e.target.value)} helperText={`${String(pushRuleForm.title_template || "").length}/100`} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth size="small" label="URL" value={pushRuleForm.url_template} onChange={(e) => updatePushRuleField("url_template", e.target.value)} helperText="Use caminhos internos começando com /" />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth multiline minRows={3} label="Mensagem" value={pushRuleForm.body_template} onChange={(e) => updatePushRuleField("body_template", e.target.value)} helperText={`${String(pushRuleForm.body_template || "").length}/260`} />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Categoria</InputLabel>
                        <Select label="Categoria" value={pushRuleForm.category} onChange={(e) => updatePushRuleField("category", e.target.value)}>
                          <MenuItem value="operational">operational</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField fullWidth size="small" type="number" label="Threshold" value={pushRuleForm.threshold_value} onChange={(e) => updatePushRuleField("threshold_value", e.target.value)} />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField fullWidth size="small" type="number" label="Cooldown em minutos" value={pushRuleForm.cooldown_minutes} onChange={(e) => updatePushRuleField("cooldown_minutes", e.target.value)} />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={<Checkbox checked={pushRuleForm.is_active} onChange={(e) => updatePushRuleField("is_active", e.target.checked)} />}
                        label="Regra ativa"
                      />
                    </Grid>
                  </Grid>
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Button variant="contained" disabled={pushRulesLoading} onClick={onSavePushRule}>
                      Salvar regra
                    </Button>
                    <Button variant="text" disabled={pushRulesLoading} onClick={resetPushRuleForm}>
                      Limpar formulário
                    </Button>
                  </Stack>
                </Paper>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Evento</TableCell>
                        <TableCell>Nome</TableCell>
                        <TableCell>Título</TableCell>
                        <TableCell>Mensagem</TableCell>
                        <TableCell>URL</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Threshold</TableCell>
                        <TableCell>Cooldown</TableCell>
                        <TableCell>Atualizada em</TableCell>
                        <TableCell align="right">Ações</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pushRules.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell sx={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace" }}>{row.event_key}</TableCell>
                          <TableCell>{row.name}</TableCell>
                          <TableCell sx={{ maxWidth: 180 }}>{row.title_template}</TableCell>
                          <TableCell sx={{ maxWidth: 260, whiteSpace: "normal" }}>{row.body_template}</TableCell>
                          <TableCell>{row.url_template || "—"}</TableCell>
                          <TableCell><Chip size="small" label={row.is_active ? "Ativa" : "Inativa"} color={row.is_active ? "success" : "default"} /></TableCell>
                          <TableCell>{row.threshold_value ?? "—"}</TableCell>
                          <TableCell>{row.cooldown_minutes ?? "—"}</TableCell>
                          <TableCell>{fmtDate(row.updated_at)}</TableCell>
                          <TableCell align="right"><Button size="small" variant="outlined" onClick={() => openPushRuleEditor(row)}>Editar</Button></TableCell>
                        </TableRow>
                      ))}
                      {pushRules.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} align="center" sx={{ opacity: 0.6, py: 3 }}>
                            Nenhuma regra cadastrada. Use “Criar regras padrão” ou adicione uma regra.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            )}
          </Paper>
        )}

        <Dialog open={Boolean(editingTemplate && templateEditForm)} onClose={closeTemplateEditor} maxWidth="md" fullWidth>
          <DialogTitle>Editar template local</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2, mt: 1 }}>
              Alterações nesta tela ajustam o modelo local usado pelo sistema. Para alterar o conteúdo aprovado do
              WhatsApp, edite o template na Brevo.
            </Alert>
            {templateSaveError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {templateSaveError}
              </Alert>
            )}
            {templateEditForm && (
              <Stack spacing={2} sx={{ pt: 1 }}>
                <TextField
                  fullWidth
                  label="Template Key"
                  value={templateEditForm.template_key}
                  onChange={(e) => setTemplateEditForm((f) => ({ ...f, template_key: e.target.value }))}
                />
                <TextField
                  fullWidth
                  label="Provider Template ID"
                  value={templateEditForm.provider_template_id}
                  onChange={(e) => setTemplateEditForm((f) => ({ ...f, provider_template_id: e.target.value }))}
                />
                <TextField
                  fullWidth
                  label="Nome"
                  value={templateEditForm.name}
                  onChange={(e) => setTemplateEditForm((f) => ({ ...f, name: e.target.value }))}
                />
                <TextField
                  fullWidth
                  label="Descrição"
                  value={templateEditForm.description}
                  onChange={(e) => setTemplateEditForm((f) => ({ ...f, description: e.target.value }))}
                />
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Preview / Corpo local"
                  value={templateEditForm.body_preview}
                  onChange={(e) => setTemplateEditForm((f) => ({ ...f, body_preview: e.target.value }))}
                />
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Mensagem padrão"
                  value={templateEditForm.default_message}
                  onChange={(e) => setTemplateEditForm((f) => ({ ...f, default_message: e.target.value }))}
                />
                <TextField
                  fullWidth
                  multiline
                  minRows={6}
                  label="Default Params JSON"
                  value={templateEditForm.default_params_json}
                  onChange={(e) => {
                    setTemplateEditForm((f) => ({ ...f, default_params_json: e.target.value }));
                    setTemplateEditJsonError("");
                  }}
                  error={Boolean(templateEditJsonError)}
                  helperText={templateEditJsonError || "JSON com parâmetros padrão do template."}
                />
                <TextField
                  fullWidth
                  label="Idioma"
                  value={templateEditForm.language}
                  onChange={(e) => setTemplateEditForm((f) => ({ ...f, language: e.target.value }))}
                />
                <TextField
                  fullWidth
                  label="Categoria"
                  value={templateEditForm.category}
                  onChange={(e) => setTemplateEditForm((f) => ({ ...f, category: e.target.value }))}
                />
                <FormControl fullWidth>
                  <InputLabel>Ativo</InputLabel>
                  <Select
                    label="Ativo"
                    value={templateEditForm.is_active ? "true" : "false"}
                    onChange={(e) =>
                      setTemplateEditForm((f) => ({ ...f, is_active: e.target.value === "true" }))
                    }
                  >
                    <MenuItem value="true">Sim</MenuItem>
                    <MenuItem value="false">Não</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeTemplateEditor}>Cancelar</Button>
            <Button variant="contained" disabled={templateSaving} onClick={onSaveTemplate}>
              {templateSaving ? "Salvando…" : "Salvar template"}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </ThemeProvider>
  );
}
