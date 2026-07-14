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
import EditRoundedIcon from "@mui/icons-material/EditRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import {
  getNotificationCatalog,
  listNotificationDispatches,
  listPushRules,
} from "../../../services/adminNotifications";
import NotificationStatusChip from "./NotificationStatusChip";
import { formatDate, friendlyError, templateKey } from "./notificationUi";

const GROUPS = [
  {
    title: "Sorteio principal",
    events: ["NEW_DRAW_PUBLISHED", "DRAW_REMAINING_NUMBERS_75", "DRAW_REMAINING_NUMBERS_50", "DRAW_REMAINING_NUMBERS_20", "DRAW_REMAINING_NUMBERS_10"],
  },
  {
    title: "Sorteio adicional",
    events: ["DRAW_REMAINING_NUMBERS_75", "DRAW_REMAINING_NUMBERS_50", "DRAW_REMAINING_NUMBERS_20", "DRAW_REMAINING_NUMBERS_10"],
    additional: true,
  },
  {
    title: "Saldo",
    events: ["BALANCE_EXPIRING_30_DAYS", "BALANCE_EXPIRING_15_DAYS", "BALANCE_EXPIRING_10_DAYS", "BALANCE_EXPIRING_7_DAYS", "BALANCE_EXPIRED"],
  },
  { title: "Resultado", events: ["WINNER_DEFINED"] },
];

const EVENT_NAMES = {
  NEW_DRAW_PUBLISHED: "Novo sorteio publicado",
  DRAW_REMAINING_NUMBERS_75: "75 números restantes",
  DRAW_REMAINING_NUMBERS_50: "50 números restantes",
  DRAW_REMAINING_NUMBERS_20: "20 números restantes",
  DRAW_REMAINING_NUMBERS_10: "10 números restantes",
  WINNER_DEFINED: "Ganhador definido",
  BALANCE_EXPIRING_30_DAYS: "Saldo vence em 30 dias",
  BALANCE_EXPIRING_15_DAYS: "Saldo vence em 15 dias",
  BALANCE_EXPIRING_10_DAYS: "Saldo vence em 10 dias",
  BALANCE_EXPIRING_7_DAYS: "Saldo vence em 7 dias",
  BALANCE_EXPIRED: "Saldo expirado",
};

const EVENT_DESCRIPTIONS = {
  NEW_DRAW_PUBLISHED: "Avisa quando um novo sorteio se torna disponível.",
  WINNER_DEFINED: "Comunica a publicação do resultado e do ganhador.",
  BALANCE_EXPIRED: "Informa que o prazo de uso do saldo terminou.",
};

const WHATSAPP_TEMPLATES = {
  DRAW_REMAINING_NUMBERS_50: "25",
  DRAW_REMAINING_NUMBERS_10: "26",
  BALANCE_EXPIRING_15_DAYS: "27",
};

function eventDescription(event) {
  if (EVENT_DESCRIPTIONS[event]) return EVENT_DESCRIPTIONS[event];
  if (event.startsWith("DRAW_REMAINING")) return "Avisa automaticamente quando o sorteio alcança este limite de números restantes.";
  if (event.startsWith("BALANCE_EXPIRING")) return "Lembra o cliente antes do vencimento do saldo.";
  return "Evento monitorado pela engine de notificações.";
}

export default function NotificationAutomations({ onEditRule, onViewHistory }) {
  const [rules, setRules] = React.useState([]);
  const [templates, setTemplates] = React.useState([]);
  const [dispatches, setDispatches] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [errors, setErrors] = React.useState([]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErrors([]);
    const [rulesResult, catalogResult, historyResult] = await Promise.allSettled([
      listPushRules(),
      getNotificationCatalog(),
      listNotificationDispatches({ limit: 200 }),
    ]);
    if (rulesResult.status === "fulfilled") {
      const value = rulesResult.value;
      setRules(Array.isArray(value) ? value : value?.rows || value?.items || value?.rules || []);
    } else setErrors((items) => [...items, `Regras Push: ${friendlyError(rulesResult.reason)}`]);
    if (catalogResult.status === "fulfilled") setTemplates(catalogResult.value?.channels?.whatsapp?.templates || []);
    else setErrors((items) => [...items, `Templates WhatsApp: ${friendlyError(catalogResult.reason)}`]);
    if (historyResult.status === "fulfilled") setDispatches(historyResult.value || []);
    else setErrors((items) => [...items, `Últimos disparos: ${friendlyError(historyResult.reason)}`]);
    setLoading(false);
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const findRule = (event) => rules.find((rule) => rule.event_key === event);
  const lastDispatch = (event) => dispatches.find((row) => (row.event || row.event_key || row.event_type) === event);
  const whatsappTemplate = (event) => {
    const id = WHATSAPP_TEMPLATES[event];
    if (!id) return null;
    return templates.find((template) => String(template.provider_template_id) === id) || { provider_template_id: id, template_key: `Template ${id}` };
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>Automações existentes</Typography>
          <Typography variant="body2" color="text.secondary">A engine monitora estes eventos. Esta tela não fabrica nem executa eventos.</Typography>
        </Box>
        <Button variant="outlined" startIcon={loading ? <CircularProgress size={16} /> : <RefreshRoundedIcon />} onClick={load} disabled={loading}>Atualizar</Button>
      </Stack>
      <Alert severity="info">Editar uma regra afeta somente eventos futuros. Nenhuma notificação é enviada ao salvar.</Alert>
      {errors.map((error) => <Alert severity="warning" key={error}>{error}</Alert>)}
      {GROUPS.map((group) => (
        <Box component="section" key={`${group.title}-${group.additional ? "additional" : "main"}`}>
          <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1 }}>{group.title}</Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
            {group.events.map((event) => {
              const rule = findRule(event);
              const whatsapp = whatsappTemplate(event);
              const last = lastDispatch(event);
              const active = rule?.is_active !== false && Boolean(rule || whatsapp);
              return (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }} key={`${group.title}-${event}`}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>{EVENT_NAMES[event]}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", overflowWrap: "anywhere" }}>{event}</Typography>
                    </Box>
                    <NotificationStatusChip status={active ? "active" : "inactive"} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ my: 1.5 }}>{eventDescription(event)}</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <NotificationStatusChip status={rule ? "configured" : "disabled"} label={rule ? "Push" : "Push sem regra"} />
                    {whatsapp && <NotificationStatusChip status={whatsapp.is_active === false ? "disabled" : "configured"} label="WhatsApp" />}
                  </Stack>
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant="caption" color="text.secondary">Modelo</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{rule ? templateKey(rule) : "Sem regra Push"}{whatsapp ? ` · WhatsApp ${whatsapp.provider_template_id}` : ""}</Typography>
                    <Typography variant="caption" color="text.secondary">Último disparo: {formatDate(rule?.last_triggered_at || last?.sent_at || last?.created_at)}</Typography>
                  </Box>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
                    <Button size="small" variant="outlined" startIcon={<EditRoundedIcon />} onClick={() => onEditRule(event)}>Editar regra</Button>
                    <Button size="small" variant="text" startIcon={<HistoryRoundedIcon />} onClick={() => onViewHistory(event)}>Ver histórico</Button>
                  </Stack>
                </Paper>
              );
            })}
          </Box>
        </Box>
      ))}
      {!loading && !rules.length && <Alert severity="warning">As regras Push não puderam ser associadas. Os eventos conhecidos permanecem listados para consulta.</Alert>}
    </Stack>
  );
}
