// src/AdminNotificationsPage.jsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Collapse,
  Container,
  CssBaseline,
  FormControl,
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
  createTheme,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import {
  estimateAudience,
  getNotificationHealth,
  listInboundMessages,
  listNotificationDispatches,
  listNotificationTemplates,
  manualSendNotification,
  sendTestWhatsApp,
} from "./services/adminNotifications";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#2E7D32" },
    background: { default: "#0E0E0E", paper: "#121212" },
    warning: { main: "#B58900" },
    success: { main: "#67C23A" },
    error: { main: "#E57373" },
    info: { main: "#64B5F6" },
  },
  shape: { borderRadius: 16 },
  typography: { fontFamily: ["Inter", "system-ui", "Segoe UI", "Roboto", "Arial"].join(",") },
});

const TAB_LABELS = ["Enviar teste", "Disparos", "Mensagens recebidas", "Templates", "Audiência futura"];

const DEFAULT_TEST_PARAMS = {
  customer_name: "Paulo",
  prize_name: "Teste New Store",
  ticket_price: "90,00",
  numbers: "07",
  authorize_url: "https://www.sorteionewstore.com.br/cativo/autorizar/teste",
  decline_url: "https://www.sorteionewstore.com.br/cativo/recusar/teste",
  message: "Teste da Central de Notificações",
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

function statusChipColor(status) {
  const s = String(status || "").toLowerCase();
  if (s === "sent") return "success";
  if (s === "failed") return "error";
  if (s === "skipped") return "warning";
  if (s === "pending") return "info";
  return "default";
}

function boolLabel(v) {
  return v ? "Sim" : "Não";
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
  const [expandedDispatch, setExpandedDispatch] = React.useState(null);
  const [expandedInbound, setExpandedInbound] = React.useState(null);

  const [testForm, setTestForm] = React.useState({
    phone: "",
    template_key: "GENERIC_TEST",
    template_id: "",
    ...DEFAULT_TEST_PARAMS,
  });
  const [testSending, setTestSending] = React.useState(false);
  const [testResult, setTestResult] = React.useState(null);
  const [testError, setTestError] = React.useState("");

  const [audienceFilter, setAudienceFilter] = React.useState("all_users");
  const [audienceUserId, setAudienceUserId] = React.useState("");
  const [audiencePhone, setAudiencePhone] = React.useState("");
  const [audienceEstimating, setAudienceEstimating] = React.useState(false);
  const [audienceEstimate, setAudienceEstimate] = React.useState(null);
  const [audienceEstimateError, setAudienceEstimateError] = React.useState("");
  const [manualSending, setManualSending] = React.useState(false);
  const [manualResult, setManualResult] = React.useState(null);
  const [manualError, setManualError] = React.useState("");

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

  const templateKeys = React.useMemo(() => {
    const keys = (templates || [])
      .map((t) => t.template_key ?? t.templateKey ?? t.key)
      .filter(Boolean);
    if (!keys.includes("GENERIC_TEST")) keys.unshift("GENERIC_TEST");
    return [...new Set(keys)];
  }, [templates]);

  const testMode = Boolean(health?.testMode);
  const allowReal = Boolean(health?.allowRealRecipients);
  const showTestAlert = testMode || !allowReal;

  const onSendTest = async () => {
    setTestSending(true);
    setTestError("");
    setTestResult(null);
    try {
      const res = await sendTestWhatsApp({
        phone: testForm.phone,
        template_key: testForm.template_key,
        template_id: testForm.template_id || null,
        params: {
          customer_name: testForm.customer_name,
          prize_name: testForm.prize_name,
          ticket_price: testForm.ticket_price,
          numbers: testForm.numbers,
          authorize_url: testForm.authorize_url,
          decline_url: testForm.decline_url,
          message: testForm.message,
        },
      });
      setTestResult(res);
    } catch (e) {
      setTestError(e?.message || "Falha ao enviar teste.");
    } finally {
      setTestSending(false);
      try {
        await loadDispatches();
      } catch (reloadErr) {
        console.warn("[adminNotifications] reload dispatches after test failed", reloadErr?.message);
      }
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

  const updateTestField = (name, value) => setTestForm((f) => ({ ...f, [name]: value }));

  const result = testResult?.result || testResult;
  const dispatch = testResult?.dispatch || testResult?.data?.dispatch;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <Toolbar sx={{ minHeight: 64 }}>
          <IconButton edge="start" color="inherit" onClick={() => nav("/admin")} aria-label="Voltar">
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <Typography sx={{ fontWeight: 900, ml: 1, flex: 1 }}>Central de Notificações</Typography>
          <IconButton color="inherit" onClick={loadAll} disabled={loading} aria-label="Recarregar">
            <RefreshRoundedIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>
          Central de Notificações
        </Typography>
        <Typography sx={{ opacity: 0.75, mb: 3, maxWidth: 900 }}>
          Monitore envios de WhatsApp/E-mail, visualize webhooks e teste mensagens antes de ativar disparos reais.
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

        <Paper variant="outlined" sx={{ borderRadius: 4, mb: 2 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
            {TAB_LABELS.map((label) => (
              <Tab key={label} label={label} />
            ))}
          </Tabs>
        </Paper>

        {tab === 0 && (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
              Enviar teste WhatsApp
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Telefone destino original"
                  name="phone"
                  value={testForm.phone}
                  onChange={(e) => updateTestField("phone", e.target.value)}
                  placeholder="5585999999999"
                  helperText="Em modo teste, o backend ignora este telefone e envia para o número de teste."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Template Key</InputLabel>
                  <Select
                    label="Template Key"
                    value={testForm.template_key}
                    onChange={(e) => updateTestField("template_key", e.target.value)}
                  >
                    {templateKeys.map((k) => (
                      <MenuItem key={k} value={k}>
                        {k}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Template ID (opcional)"
                  value={testForm.template_id}
                  onChange={(e) => updateTestField("template_id", e.target.value)}
                  placeholder="ID do template Brevo"
                  helperText="Se vazio, o backend tenta usar o template configurado no banco/env."
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Nome do cliente"
                  value={testForm.customer_name}
                  onChange={(e) => updateTestField("customer_name", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Prêmio/Campanha"
                  value={testForm.prize_name}
                  onChange={(e) => updateTestField("prize_name", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Valor da cota"
                  value={testForm.ticket_price}
                  onChange={(e) => updateTestField("ticket_price", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Números"
                  value={testForm.numbers}
                  onChange={(e) => updateTestField("numbers", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Link autorizar"
                  value={testForm.authorize_url}
                  onChange={(e) => updateTestField("authorize_url", e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Link recusar"
                  value={testForm.decline_url}
                  onChange={(e) => updateTestField("decline_url", e.target.value)}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Mensagem livre"
                  value={testForm.message}
                  onChange={(e) => updateTestField("message", e.target.value)}
                />
              </Grid>
            </Grid>
            <Button
              variant="contained"
              sx={{ mt: 2, borderRadius: 999 }}
              disabled={testSending}
              onClick={onSendTest}
            >
              {testSending ? "Enviando…" : "Enviar WhatsApp de teste"}
            </Button>
            {testError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {testError}
              </Alert>
            )}
            {testResult && (
              <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                  Resultado do envio
                </Typography>
                <Stack spacing={0.5}>
                  <Typography variant="body2">ok: {String(testResult.ok ?? testResult.success ?? "—")}</Typography>
                  <Typography variant="body2">dispatch.id: {dispatch?.id ?? "—"}</Typography>
                  <Typography variant="body2">dispatch.status: {dispatch?.status ?? "—"}</Typography>
                  <Typography variant="body2">result.statusCode: {result?.statusCode ?? "—"}</Typography>
                  <Typography variant="body2">result.messageId: {result?.messageId ?? "—"}</Typography>
                  <Typography variant="body2">result.recipient: {result?.recipient ?? "—"}</Typography>
                  <Typography variant="body2">
                    result.recipient_original: {result?.recipient_original ?? result?.recipientOriginal ?? "—"}
                  </Typography>
                  <Typography variant="body2">
                    result.recipient_forced: {String(result?.recipient_forced ?? result?.recipientForced ?? false)}
                  </Typography>
                  {result?.reason === "missing_template_id" && (
                    <Alert severity="error" sx={{ mt: 1 }}>
                      {result.message ||
                        "Template ID ausente. Configure BREVO_WHATSAPP_GENERIC_TEST_TEMPLATE_ID, preencha provider_template_id no banco ou informe template_id no formulário."}
                    </Alert>
                  )}
                  {(result?.reason || result?.error) && result?.reason !== "missing_template_id" && (
                    <Typography variant="body2" color="warning.main">
                      {result.reason || result.error}
                    </Typography>
                  )}
                </Stack>
                {(result?.recipient_forced || result?.recipientForced) && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    Envio redirecionado para o número de teste pelo backend.
                  </Alert>
                )}
              </Paper>
            )}
          </Paper>
        )}

        {tab === 1 && (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select
                  label="Status"
                  value={dispatchStatus}
                  onChange={(e) => setDispatchStatus(e.target.value)}
                >
                  <MenuItem value="">Todos</MenuItem>
                  <MenuItem value="sent">sent</MenuItem>
                  <MenuItem value="failed">failed</MenuItem>
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
            </Stack>
            {dispatchError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {dispatchError}
              </Alert>
            )}
            <Typography variant="body2" sx={{ mb: 1, opacity: 0.75 }}>
              Total carregado: {dispatches.length} | Exibindo: {visibleDispatches.length}
            </Typography>
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
                    <TableCell>Destinatário</TableCell>
                    <TableCell>Dest. original</TableCell>
                    <TableCell>Forçado?</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Tentativas</TableCell>
                    <TableCell>Provider Msg ID</TableCell>
                    <TableCell>Erro</TableCell>
                    <TableCell>Enviado em</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleDispatches.map((row, idx) => {
                    const id = row.id ?? `d-${idx}`;
                    const payload = row.payload ?? row.request_payload;
                    const response = row.response ?? row.provider_response;
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
                          <TableCell>{row.recipient ?? row.to ?? "—"}</TableCell>
                          <TableCell>{row.recipient_original ?? row.recipientOriginal ?? "—"}</TableCell>
                          <TableCell>{boolLabel(row.recipient_forced ?? row.recipientForced)}</TableCell>
                          <TableCell>
                            <Chip size="small" label={row.status ?? "—"} color={statusChipColor(row.status)} />
                          </TableCell>
                          <TableCell>{row.attempts ?? row.attempt_count ?? "—"}</TableCell>
                          <TableCell>{row.provider_message_id ?? row.providerMessageId ?? "—"}</TableCell>
                          <TableCell sx={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {row.error ?? row.last_error ?? "—"}
                          </TableCell>
                          <TableCell>{fmtDate(row.sent_at ?? row.sentAt)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={14} sx={{ py: 0, border: 0 }}>
                            <Collapse in={expandedDispatch === id}>
                              <Box sx={{ p: 2, bgcolor: "rgba(0,0,0,0.25)", borderRadius: 2, mb: 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 700 }}>Payload</Typography>
                                <Box component="pre" sx={{ fontSize: 11, overflow: "auto", m: 0, mt: 0.5 }}>
                                  {JSON.stringify(payload ?? null, null, 2)}
                                </Box>
                                <Typography variant="caption" sx={{ fontWeight: 700, mt: 1, display: "block" }}>
                                  Response
                                </Typography>
                                <Box component="pre" sx={{ fontSize: 11, overflow: "auto", m: 0, mt: 0.5 }}>
                                  {JSON.stringify(response ?? null, null, 2)}
                                </Box>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                  {visibleDispatches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={14} align="center" sx={{ opacity: 0.6, py: 3, whiteSpace: "normal" }}>
                        {dispatches.length > 0
                          ? "Nenhum disparo corresponde aos filtros selecionados. Limpe os filtros ou clique em Atualizar."
                          : "Nenhum disparo encontrado. Se você acabou de enviar um teste, clique em Atualizar. Caso continue vazio, verifique no Network se a API retornou rows/dispatches."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {tab === 2 && (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4 }}>
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
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              Os IDs dos templates da Brevo são configurados no banco ou nas variáveis de ambiente do backend.
            </Alert>
            <Button
              variant="outlined"
              startIcon={<RefreshRoundedIcon />}
              sx={{ mb: 2 }}
              disabled={loadingTemplates}
              onClick={() => loadTemplates()}
            >
              {loadingTemplates ? "Atualizando…" : "Atualizar templates"}
            </Button>
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
                    <TableCell>Descrição</TableCell>
                    <TableCell>Ativo</TableCell>
                    <TableCell>Preview</TableCell>
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
                      <TableCell>{row.description ?? "—"}</TableCell>
                      <TableCell>{boolLabel(row.active ?? row.is_active)}</TableCell>
                      <TableCell sx={{ maxWidth: 280, whiteSpace: "pre-wrap" }}>
                        {row.preview ?? row.preview_text ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {!templates.length && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ opacity: 0.6, py: 3, whiteSpace: "normal" }}>
                        Nenhum template carregado. Verifique se a tabela notification_templates possui registros ou
                        clique em sincronizar modelos da Brevo, se essa função estiver disponível.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        {tab === 4 && (
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 4 }}>
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
                <Button variant="outlined" disabled={manualSending} onClick={onManualSendTest}>
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
                <Typography variant="body2">ok: {String(manualResult.ok ?? manualResult.success ?? "—")}</Typography>
                {(manualResult.warning || manualResult.code) && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    {manualResult.warning || manualResult.code || "TEST_MODE_ACTIVE_REAL_RECIPIENTS_BLOCKED"}
                  </Alert>
                )}
                <Box component="pre" sx={{ fontSize: 11, mt: 1, overflow: "auto" }}>
                  {JSON.stringify(manualResult, null, 2)}
                </Box>
              </Paper>
            )}
          </Paper>
        )}
      </Container>
    </ThemeProvider>
  );
}
