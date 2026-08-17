import * as React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import {
  getNotificationHealth,
  getPushSummary,
  listNotificationDispatches,
} from "../../../services/adminNotifications";
import NotificationStatusChip from "./NotificationStatusChip";
import { formatDate, friendlyError } from "./notificationUi";

function state(enabled, configured) {
  if (!enabled) return "disabled";
  return configured ? "configured" : "attention";
}

function OverviewCard({ title, description, status, value, action }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, minHeight: 176, display: "flex", flexDirection: "column" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>{title}</Typography>
        <NotificationStatusChip status={status} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, flex: 1 }}>{description}</Typography>
      <Typography variant="body1" sx={{ fontWeight: 800, mt: 2 }}>{value}</Typography>
      {action && (
        <Button size="small" variant="text" onClick={action.onClick} startIcon={action.icon} sx={{ mt: 1, alignSelf: "flex-start" }}>
          {action.label}
        </Button>
      )}
    </Paper>
  );
}

function yesNo(value) {
  return value ? "Sim" : "Não";
}

export default function NotificationsOverview({ onNavigate }) {
  const [health, setHealth] = React.useState(null);
  const [summary, setSummary] = React.useState(null);
  const [dispatches, setDispatches] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [errors, setErrors] = React.useState([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErrors([]);
    const [healthResult, summaryResult, dispatchResult] = await Promise.allSettled([
      getNotificationHealth(),
      getPushSummary(),
      listNotificationDispatches({ limit: 25 }),
    ]);
    if (healthResult.status === "fulfilled") setHealth(healthResult.value);
    else setErrors((items) => [...items, `Status das integrações: ${friendlyError(healthResult.reason)}`]);
    if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
    else setErrors((items) => [...items, `Resumo Push: ${friendlyError(summaryResult.reason)}`]);
    if (dispatchResult.status === "fulfilled") setDispatches(dispatchResult.value || []);
    else setErrors((items) => [...items, `Últimos envios: ${friendlyError(dispatchResult.reason)}`]);
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const whatsapp = health?.manual_channels?.whatsapp;
  const push = health?.manual_channels?.push;
  const email = health?.manual_channels?.email;
  const lastSend = dispatches.find((row) => row.sent_at || row.created_at);
  const lastError = dispatches.find((row) => row.error_message || row.error || String(row.status).toLowerCase() === "failed");
  const engineEnabled = health?.notificationCenterEnabled ?? health?.active ?? health?.centralActive ?? Boolean(health?.brevoWhatsappEnabled && health?.hasBrevoApiKey);
  const activeDevices = summary?.active_devices ?? summary?.active_subscriptions ?? health?.active_subscriptions;
  const activeUsers = summary?.active_subscribers ?? summary?.eligible_users ?? health?.eligible_users;

  const cards = [
    {
      title: "Engine automática",
      description: "Analisa sorteios e saldos a cada 10 minutos.",
      status: health ? (engineEnabled ? "online" : "disabled") : "unavailable",
      value: health ? (engineEnabled ? "Monitoramento ativo" : "Monitoramento desativado") : "Status indisponível",
      action: { label: "Ver automações", icon: <SettingsRoundedIcon />, onClick: () => onNavigate("automations") },
    },
    {
      title: "Push",
      description: "Envia para dispositivos que ativaram as notificações.",
      status: health ? state(push?.enabled, push?.vapid_configured) : "unavailable",
      value: push?.vapid_configured ? "VAPID configurado" : "VAPID não configurado",
      action: push?.enabled && push?.vapid_configured ? { label: "Enviar Push", icon: <SendRoundedIcon />, onClick: () => onNavigate("send", { channel: "push" }) } : null,
    },
    {
      title: "WhatsApp Brevo",
      description: "Utiliza templates aprovados da Brevo.",
      status: health ? state(whatsapp?.enabled, whatsapp?.brevo_configured) : "unavailable",
      value: whatsapp?.brevo_configured ? "Brevo configurada" : "Brevo não configurada",
      action: whatsapp?.enabled && whatsapp?.brevo_configured ? { label: "Enviar WhatsApp", icon: <SendRoundedIcon />, onClick: () => onNavigate("send", { channel: "whatsapp" }) } : null,
    },
    {
      title: "E-mail SMTP",
      description: "Utiliza o SMTP configurado no backend.",
      status: health ? state(email?.enabled, email?.smtp_configured) : "unavailable",
      value: email?.smtp_configured ? "SMTP configurado" : "SMTP não configurado",
      action: email?.enabled && email?.smtp_configured ? { label: "Enviar e-mail", icon: <SendRoundedIcon />, onClick: () => onNavigate("send", { channel: "email" }) } : null,
    },
    {
      title: "Subscriptions ativas",
      description: "Dispositivos atualmente elegíveis para receber Push.",
      status: activeDevices == null ? "unavailable" : Number(activeDevices) > 0 ? "online" : "empty",
      value: activeDevices == null ? "Não foi possível verificar" : `${activeDevices} dispositivo(s)`,
    },
    {
      title: "Usuários elegíveis",
      description: "Usuários com ao menos um dispositivo Push ativo.",
      status: activeUsers == null ? "unavailable" : Number(activeUsers) > 0 ? "online" : "empty",
      value: activeUsers == null ? "Não foi possível verificar" : `${activeUsers} usuário(s)`,
    },
    {
      title: "Último envio",
      description: "Registro mais recente no histórico unificado.",
      status: lastSend ? "sent" : dispatches.length ? "attention" : "empty",
      value: lastSend ? formatDate(lastSend.sent_at || lastSend.created_at) : "Nenhum envio encontrado",
      action: { label: "Ver histórico", onClick: () => onNavigate("history") },
    },
    {
      title: "Último erro",
      description: "Falha mais recente registrada pelos canais.",
      status: lastError ? "error" : dispatches.length ? "online" : "unavailable",
      value: lastError ? friendlyError(lastError.error_message || lastError.error) : dispatches.length ? "Nenhum erro recente" : "Não foi possível verificar",
      action: { label: "Ver histórico", onClick: () => onNavigate("history", { status: "failed" }) },
    },
  ];

  const legacyDetails = health ? [
    ["Modo de teste", health.testMode ? "Ativo" : "Inativo"],
    ["Envio real para clientes", health.allowRealRecipients ? "Liberado" : "Bloqueado"],
    ["Remetente WhatsApp", yesNo(health.senderNumberConfigured)],
    ["Destinatário de teste", yesNo(health.testRecipientConfigured)],
    ["Template genérico", yesNo(health.genericTestTemplateEnvConfigured)],
    ["Destinatários personalizados de teste", yesNo(health.adminTestCustomRecipientsEnabled)],
    ["Lista de destinatários de teste", yesNo(health.adminTestAllowedRecipientsConfigured)],
    ["Consentimento WhatsApp obrigatório", yesNo(health.whatsappConsentRequired !== false)],
    ["Telefone sem usuário vinculado", health.whatsappAllowUnlinkedPhone ? "Permitido" : "Bloqueado"],
    ["Template de pré-autorização", yesNo(health.captive_preauth_template_configured)],
    ["Identificador do template de pré-autorização", health.captive_preauth_template_id || "Não informado"],
    ["Confirmação de pré-autorização", yesNo(health.captive_confirmation_public_url_configured)],
    ["Modo de pré-autorização", health.captive_preauth_template_mode || "Não informado"],
  ] : [];

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>Estado das notificações</Typography>
          <Typography variant="body2" color="text.secondary">Integrações manuais e monitoramento automático, apresentados separadamente.</Typography>
        </Box>
        <Button variant="outlined" startIcon={loading ? <CircularProgress size={16} /> : <RefreshRoundedIcon />} onClick={load} disabled={loading}>
          Atualizar
        </Button>
      </Stack>

      {errors.map((message) => <Alert severity="warning" key={message}>{message}</Alert>)}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        {cards.map((card) => <OverviewCard key={card.title} {...card} />)}
      </Box>

      {health && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1.5 }}>Detalhes operacionais preservados</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 1.5 }}>
            {legacyDetails.map(([label, value]) => (
              <Box key={label}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{value}</Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </Stack>
  );
}
