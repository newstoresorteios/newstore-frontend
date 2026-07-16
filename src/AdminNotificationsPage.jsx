import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  AppBar,
  Box,
  Container,
  CssBaseline,
  IconButton,
  Paper,
  Tab,
  Tabs,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import AutoModeRoundedIcon from "@mui/icons-material/AutoModeRounded";
import TouchAppRoundedIcon from "@mui/icons-material/TouchAppRounded";
import NotificationsOverview from "./components/admin/notifications/NotificationsOverview";
import ManualNotificationComposer from "./components/admin/notifications/ManualNotificationComposer";
import NotificationCatalog from "./components/admin/notifications/NotificationCatalog";
import NotificationAutomations from "./components/admin/notifications/NotificationAutomations";
import NotificationHistory from "./components/admin/notifications/NotificationHistory";
import { adminPanelPaperSx, adminTabsPaperSx, createNewStoreAdminTheme } from "./adminTheme";

const theme = createNewStoreAdminTheme();

const TABS = [
  { value: "overview", label: "Visão geral" },
  { value: "send", label: "Enviar mensagem" },
  { value: "models", label: "Modelos" },
  { value: "automations", label: "Automações" },
  { value: "history", label: "Histórico" },
];

export default function AdminNotificationsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = React.useState("overview");
  const [composerChannel, setComposerChannel] = React.useState("");
  const [composerPreset, setComposerPreset] = React.useState(null);
  const [modelsChannel, setModelsChannel] = React.useState("whatsapp");
  const [modelsEvent, setModelsEvent] = React.useState("");
  const [historyFilters, setHistoryFilters] = React.useState({});

  const goTo = React.useCallback((target, options = {}) => {
    if (target === "send" && options.channel) {
      setComposerChannel(options.channel);
      setComposerPreset({ ...options });
    }
    if (target === "models" && options.channel) setModelsChannel(options.channel);
    if (target === "history") setHistoryFilters(options.event ? { event: options.event } : options.status ? { status: options.status } : {});
    setTab(target);
  }, []);

  const editAutomation = (event) => {
    setModelsChannel("push");
    setModelsEvent(event);
    setTab("models");
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <AppBar position="sticky" color="default" elevation={0}>
          <Toolbar sx={{ gap: 1.5 }}>
            <Tooltip title="Voltar ao painel administrativo">
              <IconButton edge="start" color="inherit" onClick={() => navigate(-1)} aria-label="Voltar">
                <ArrowBackIosNewRoundedIcon />
              </IconButton>
            </Tooltip>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" component="h1">Notificações</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                Gerencie mensagens automáticas e envios manuais por Push, WhatsApp e e-mail.
              </Typography>
            </Box>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 } }}>
          <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "block", sm: "none" }, mb: 2 }}>
            Gerencie mensagens automáticas e envios manuais por Push, WhatsApp e e-mail.
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2, mb: 2 }}>
            <Alert severity="info" icon={<AutoModeRoundedIcon />} sx={{ alignItems: "flex-start" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>Automático</Typography>
              <Typography variant="body2">A engine monitora sorteios e saldos sem ação do administrador.</Typography>
            </Alert>
            <Alert severity="warning" icon={<TouchAppRoundedIcon />} sx={{ alignItems: "flex-start" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>Manual</Typography>
              <Typography variant="body2">A mensagem só é enviada depois da prévia e da confirmação do administrador.</Typography>
            </Alert>
          </Box>

          <Paper variant="outlined" sx={adminTabsPaperSx}>
            <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" aria-label="Seções da central de notificações">
              {TABS.map((item) => <Tab key={item.value} value={item.value} label={item.label} />)}
            </Tabs>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, ...adminPanelPaperSx }}>
            {tab === "overview" && <NotificationsOverview onNavigate={goTo} />}
            {tab === "send" && <ManualNotificationComposer initialChannel={composerChannel} initialPreset={composerPreset} />}
            {tab === "models" && (
              <NotificationCatalog
                initialChannel={modelsChannel}
                focusEvent={modelsEvent}
                onUseTemplate={(template) => goTo("send", {
                  channel: "email",
                  templateKey: template?.template_key,
                  audience: "selected",
                })}
                onSendAll={(template) => goTo("send", {
                  channel: "email",
                  templateKey: template?.template_key,
                  audience: "all_with_email",
                })}
              />
            )}
            {tab === "automations" && <NotificationAutomations onEditRule={editAutomation} onViewHistory={(event) => goTo("history", { event })} />}
            {tab === "history" && <NotificationHistory initialFilters={historyFilters} />}
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
