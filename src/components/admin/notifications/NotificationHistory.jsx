import * as React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {
  exportNotificationDispatchesCsv,
  getBrevoWhatsAppEvents,
  listInboundMessages,
  listNotificationDispatches,
  listPushLogs,
} from "../../../services/adminNotifications";
import NotificationStatusChip, { normalizeNotificationStatus } from "./NotificationStatusChip";
import { CHANNEL_LABELS, formatDate, friendlyError, sourceLabel } from "./notificationUi";

const EMPTY_FILTERS = {
  channel: "",
  origin: "",
  status: "",
  event: "",
  template: "",
  user: "",
  from: "",
  to: "",
};

function rawError(row) {
  const value = row.error_message || row.error || row.last_error || row.reason || "";
  const status = row.provider_status || row.status_code;
  if (String(value).includes("push_subscription_gone_or_expired") && Number(status) === 410) return "push_subscription_gone_or_expired:410";
  return String(value || "");
}

function originOf(row) {
  const value = String(row.origin || row.source || row.campaign_source || row.campaign_origin || "").toLowerCase();
  const event = String(row.event || row.event_key || row.event_type || "").toLowerCase();
  if (value.includes("manual") || event.includes("manual")) return "manual";
  if (value.includes("test") || value === "dry_run" || row.status === "dry_run") return "test";
  return "automatic";
}

function channelOf(row) {
  if (row.__kind === "inbound") return "inbound";
  return String(row.channel || (row.__kind === "push" ? "push" : row.__kind === "brevo" ? "whatsapp" : "")).toLowerCase();
}

function statusLabel(row) {
  const error = rawError(row);
  if (error.includes("no_active_push_recipients")) return "Sem destinatários";
  if (error.includes("rule_inactive_or_not_found")) return "Regra inativa";
  if (error.includes("push_subscription_gone_or_expired") || Number(row.provider_status) === 410) return "Subscription expirada";
  const status = normalizeNotificationStatus(row.delivery_status || row.provider_status || row.status || row.event);
  const labels = { sent: "Enviado", accepted: row.provider === "brevo" ? "Aceito pela Brevo" : "Aceito pelo provedor", delivered: "Entregue", read: "Lido", failed: "Falhou", skipped: "Ignorado", pending: "Pendente" };
  return labels[status] || row.delivery_status || row.provider_status || row.status || row.event || "-";
}

function timestamp(row) {
  return row.created_at || row.createdAt || row.date || row.timestamp || row.sent_at || row.received_at;
}

function normalizeRows(kind, response) {
  let rows = [];
  if (Array.isArray(response)) rows = response;
  else rows = response?.rows || response?.items || response?.logs || response?.events || response?.messages || [];
  return rows.map((row, index) => ({ ...row, __kind: kind, __key: `${kind}-${row.id || row.dispatch_id || row.message_id || index}` }));
}

export default function NotificationHistory({ initialFilters = {} }) {
  const [rows, setRows] = React.useState([]);
  const [filters, setFilters] = React.useState({ ...EMPTY_FILTERS, ...initialFilters });
  const [loading, setLoading] = React.useState(true);
  const [errors, setErrors] = React.useState([]);
  const [exporting, setExporting] = React.useState(false);
  const [exportMessage, setExportMessage] = React.useState("");

  React.useEffect(() => { setFilters((current) => ({ ...current, ...initialFilters })); }, [initialFilters]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErrors([]);
    const results = await Promise.allSettled([
      listNotificationDispatches({ limit: 500 }),
      listPushLogs({ page: 1, pageSize: 200 }),
      listInboundMessages({ limit: 200 }),
      getBrevoWhatsAppEvents({ limit: 200 }),
    ]);
    const kinds = ["dispatch", "push", "inbound", "brevo"];
    const labels = ["Disparos", "Push", "Mensagens recebidas", "Eventos Brevo"];
    const combined = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") combined.push(...normalizeRows(kinds[index], result.value));
      else setErrors((items) => [...items, `${labels[index]}: ${friendlyError(result.reason)}`]);
    });
    combined.sort((a, b) => new Date(timestamp(b) || 0) - new Date(timestamp(a) || 0));
    setRows(combined);
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((row) => {
    const channel = channelOf(row);
    const origin = originOf(row);
    const status = String(row.delivery_status || row.provider_status || row.status || row.event || "").toLowerCase();
    const error = rawError(row).toLowerCase();
    const event = String(row.event || row.event_key || row.event_type || "").toLowerCase();
    const template = String(row.template_key || row.template || row.provider_template_id || "").toLowerCase();
    const user = [row.user_id, row.user_name, row.name, row.user_email, row.email, row.recipient, row.contactNumber, row.phone].join(" ").toLowerCase();
    const date = timestamp(row) ? new Date(timestamp(row)) : null;
    if (filters.channel && channel !== filters.channel) return false;
    if (filters.origin && origin !== filters.origin) return false;
    if (filters.status && !status.includes(filters.status) && !error.includes(filters.status) && !statusLabel(row).toLowerCase().includes(filters.status)) return false;
    if (filters.event && !event.includes(filters.event.toLowerCase())) return false;
    if (filters.template && !template.includes(filters.template.toLowerCase())) return false;
    if (filters.user && !user.includes(filters.user.toLowerCase())) return false;
    if (filters.from && (!date || date < new Date(`${filters.from}T00:00:00`))) return false;
    if (filters.to && (!date || date > new Date(`${filters.to}T23:59:59.999`))) return false;
    return true;
  });

  const exportCsv = async () => {
    setExporting(true);
    setExportMessage("");
    try {
      await exportNotificationDispatchesCsv({ status: filters.status, channel: filters.channel === "inbound" ? "" : filters.channel, from: filters.from, to: filters.to });
      setExportMessage("CSV de disparos exportado.");
    } catch (error) {
      setExportMessage(friendlyError(error, "Não foi possível exportar o CSV."));
    } finally {
      setExporting(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>Histórico unificado</Typography>
          <Typography variant="body2" color="text.secondary">Envios automáticos, manuais, testes, Push por dispositivo e mensagens recebidas.</Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" startIcon={loading ? <CircularProgress size={16} /> : <RefreshRoundedIcon />} onClick={load} disabled={loading}>Atualizar</Button>
          <Button variant="contained" startIcon={exporting ? <CircularProgress size={16} /> : <DownloadRoundedIcon />} onClick={exportCsv} disabled={exporting}>Exportar CSV</Button>
        </Stack>
      </Stack>
      {errors.map((error) => <Alert severity="warning" key={error}>{error}</Alert>)}
      {exportMessage && <Alert severity={exportMessage.includes("exportado") ? "success" : "error"}>{exportMessage}</Alert>}
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1.5 }}>
          <FormControl size="small"><InputLabel>Canal</InputLabel><Select label="Canal" value={filters.channel} onChange={(event) => setFilters((value) => ({ ...value, channel: event.target.value }))}><MenuItem value="">Todos</MenuItem><MenuItem value="push">Push</MenuItem><MenuItem value="whatsapp">WhatsApp</MenuItem><MenuItem value="email">E-mail</MenuItem><MenuItem value="inbound">Mensagens recebidas</MenuItem></Select></FormControl>
          <FormControl size="small"><InputLabel>Origem</InputLabel><Select label="Origem" value={filters.origin} onChange={(event) => setFilters((value) => ({ ...value, origin: event.target.value }))}><MenuItem value="">Todas</MenuItem><MenuItem value="automatic">Automático</MenuItem><MenuItem value="manual">Manual</MenuItem><MenuItem value="test">Teste</MenuItem></Select></FormControl>
          <FormControl size="small"><InputLabel>Status</InputLabel><Select label="Status" value={filters.status} onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))}><MenuItem value="">Todos</MenuItem><MenuItem value="sent">Enviado</MenuItem><MenuItem value="accepted">Aceito</MenuItem><MenuItem value="delivered">Entregue</MenuItem><MenuItem value="read">Lido</MenuItem><MenuItem value="failed">Falhou</MenuItem><MenuItem value="skipped">Ignorado</MenuItem><MenuItem value="410">Subscription expirada</MenuItem></Select></FormControl>
          <TextField size="small" label="Evento" value={filters.event} onChange={(event) => setFilters((value) => ({ ...value, event: event.target.value }))} />
          <TextField size="small" label="Template" value={filters.template} onChange={(event) => setFilters((value) => ({ ...value, template: event.target.value }))} />
          <TextField size="small" label="Usuário" value={filters.user} onChange={(event) => setFilters((value) => ({ ...value, user: event.target.value }))} />
          <TextField size="small" label="Data inicial" type="date" InputLabelProps={{ shrink: true }} value={filters.from} onChange={(event) => setFilters((value) => ({ ...value, from: event.target.value }))} />
          <TextField size="small" label="Data final" type="date" InputLabelProps={{ shrink: true }} value={filters.to} onChange={(event) => setFilters((value) => ({ ...value, to: event.target.value }))} />
        </Box>
        <Button size="small" variant="text" onClick={() => setFilters(EMPTY_FILTERS)} sx={{ mt: 1 }}>Limpar filtros</Button>
      </Paper>
      <Typography variant="body2" color="text.secondary">{filtered.length} registro(s)</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 1380 }}>
          <TableHead><TableRow><TableCell>Data</TableCell><TableCell>Canal</TableCell><TableCell>Origem</TableCell><TableCell>Evento/modelo</TableCell><TableCell>Usuário</TableCell><TableCell>E-mail/telefone</TableCell><TableCell>Status</TableCell><TableCell>Dispositivo</TableCell><TableCell>Erro</TableCell><TableCell>Enviado em</TableCell><TableCell>Entregue em</TableCell></TableRow></TableHead>
          <TableBody>
            {filtered.map((row) => {
              const error = rawError(row);
              const technicalStatus = row.delivery_status || row.provider_status || row.status || row.event;
              return (
                <TableRow hover key={row.__key}>
                  <TableCell>{formatDate(timestamp(row))}</TableCell>
                  <TableCell>{CHANNEL_LABELS[channelOf(row)] || channelOf(row) || "-"}</TableCell>
                  <TableCell>{sourceLabel(originOf(row))}</TableCell>
                  <TableCell><Typography variant="body2">{row.event || row.event_key || row.event_type || row.template_key || row.template || "-"}</Typography>{(row.template_key || row.provider_template_id) && <Typography variant="caption" color="text.secondary">{row.template_key || `Template ${row.provider_template_id}`}</Typography>}</TableCell>
                  <TableCell>{row.user_name || row.name || row.user_id || "-"}</TableCell>
                  <TableCell>{row.user_email || row.email || row.recipient || row.contactNumber || row.phone || "-"}</TableCell>
                  <TableCell><NotificationStatusChip status={technicalStatus} label={statusLabel(row)} technical={String(technicalStatus || "")} /></TableCell>
                  <TableCell>{row.device_label || row.subscription_id || row.device || "-"}</TableCell>
                  <TableCell sx={{ maxWidth: 260 }}>
                    {error ? <Tooltip title={error}><Box><Typography variant="body2" sx={{ whiteSpace: "normal" }}>{friendlyError(error)}</Typography><Typography variant="caption" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>{error}</Typography></Box></Tooltip> : "-"}
                  </TableCell>
                  <TableCell>{formatDate(row.sent_at || row.sentAt)}</TableCell>
                  <TableCell>{formatDate(row.delivered_at || row.delivery_confirmed_at || row.read_at)}</TableCell>
                </TableRow>
              );
            })}
            {!filtered.length && <TableRow><TableCell colSpan={11} align="center" sx={{ py: 5 }}>{loading ? "Carregando histórico..." : "Nenhum registro encontrado para os filtros."}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
}
