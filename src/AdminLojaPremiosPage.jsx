// src/AdminLojaPremiosPage.jsx
//
// Módulo LOJA DE PRÊMIOS NS — vive DENTRO do painel /admin.
//
// Segue o mesmo padrão de navegação dos demais módulos administrativos
// (AdminCaptivesPage, AdminNotificationsPage, ...): o AdminDashboard navega
// para uma sub-rota de /admin e a página abre com AppBar + abas.
//
// Não existe painel administrativo separado em /loja/admin.
// A única rota pública da Loja é /loja.

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
  Snackbar,
  Tab,
  Tabs,
  ThemeProvider,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";

import { adminTabsPaperSx, createNewStoreAdminTheme } from "./adminTheme";
import TrayProductsTab from "./components/rewardStore/TrayProductsTab";
import PublishedProductsTab from "./components/rewardStore/PublishedProductsTab";
import NsCreditsTab from "./components/rewardStore/NsCreditsTab";
import ReportsTab from "./components/rewardStore/ReportsTab";
import SettingsTab from "./components/rewardStore/SettingsTab";

const theme = createNewStoreAdminTheme();

export default function AdminLojaPremiosPage() {
  const navigate = useNavigate();
  const [tab, setTab] = React.useState(0);
  const [toast, setToast] = React.useState(null);
  // Incrementado quando algo muda o catálogo, para as abas já montadas recarregarem.
  const [reloadToken, setReloadToken] = React.useState(0);
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const notify = React.useCallback((message, severity = "info") => {
    setToast({ message, severity });
  }, []);

  const refreshCatalog = React.useCallback(() => {
    setReloadToken((n) => n + 1);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", overflowX: "hidden" }}>
        <AppBar position="sticky" elevation={0}>
          <Toolbar sx={{ gap: 1 }}>
            <IconButton edge="start" onClick={() => navigate("/admin")} aria-label="Voltar">
              <ArrowBackIosNewRoundedIcon fontSize="small" />
            </IconButton>
            <Typography sx={{ fontWeight: 900, flex: 1 }}>NEWSTORE</Typography>
            <Typography variant="body2" sx={{ color: "rgba(245,247,245,0.7)" }}>
              Administração da Loja
            </Typography>
          </Toolbar>
        </AppBar>

        <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 } }}>
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>
            Loja de Prêmios NS
          </Typography>

          <Paper variant="outlined" sx={adminTabsPaperSx}>
            {/* Trocar de aba não refaz requests: cada aba guarda seu próprio estado. */}
            <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
              <Tab label="Produtos Tray" />
              <Tab label="Publicados" />
              <Tab label="NSCréditos" />
              <Tab label="Relatórios" />
              <Tab label="Configurações" />
            </Tabs>
          </Paper>

          <Box sx={{ display: tab === 0 ? "block" : "none" }}>
            <TrayProductsTab isMobile={isMobile} onNotify={notify} onPublished={refreshCatalog} />
          </Box>
          <Box sx={{ display: tab === 1 ? "block" : "none" }}>
            <PublishedProductsTab onNotify={notify} reloadToken={reloadToken} />
          </Box>
          {tab === 2 && <NsCreditsTab onNotify={notify} />}
          {tab === 3 && <ReportsTab reloadToken={reloadToken} />}
          {tab === 4 && <SettingsTab onNotify={notify} onSynced={refreshCatalog} />}
        </Container>

        <Snackbar
          open={Boolean(toast)}
          autoHideDuration={5000}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          {toast ? (
            <Alert severity={toast.severity} variant="filled" onClose={() => setToast(null)}>
              {toast.message}
            </Alert>
          ) : undefined}
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}
