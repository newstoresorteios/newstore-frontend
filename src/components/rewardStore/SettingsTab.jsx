// src/components/rewardStore/SettingsTab.jsx
//
// Aba CONFIGURAÇÕES do módulo LOJA DE PRÊMIOS NS.
//
// Escopo desta etapa (YAGNI): status factual da integração Tray, última
// sincronização e o comando de atualizar o catálogo curado.
// Nada de reservar estoque, alterar produto Tray ou configurar checkout.

import * as React from "react";
import { Alert, Box, Button, Chip, CircularProgress, Divider, Paper, Stack, Typography } from "@mui/material";
import SyncRoundedIcon from "@mui/icons-material/SyncRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

import { adminPanelPaperSx } from "../../adminTheme";
import { getStoreStatus, syncProducts, describeApiError } from "../../services/rewardStore";
import { formatDateTime } from "./shared";

function Row({ label, children }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={{ xs: 0.25, sm: 2 }}
      justifyContent="space-between"
      sx={{ py: 1 }}
    >
      <Typography variant="body2" sx={{ color: "rgba(245,247,245,0.65)", fontWeight: 700 }}>
        {label}
      </Typography>
      <Box sx={{ textAlign: { sm: "right" } }}>{children}</Box>
    </Stack>
  );
}

export default function SettingsTab({ onNotify, onSynced }) {
  const [status, setStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [syncing, setSyncing] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStatus(await getStoreStatus());
    } catch (e) {
      setStatus(null);
      setError(describeApiError(e, "Não foi possível carregar o status da integração."));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function handleSync() {
    setSyncing(true);
    try {
      const out = await syncProducts();
      onNotify(`Sincronização concluída: ${out?.succeeded ?? 0} ok, ${out?.failed ?? 0} com falha.`, "info");
      await load();
      if (onSynced) onSynced();
    } catch (e) {
      onNotify(describeApiError(e, "Não foi possível sincronizar com a Tray."), "error");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const tray = status?.tray || {};
  const catalog = status?.catalog || {};

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, ...adminPanelPaperSx }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1 }}>
          Integração Tray
        </Typography>

        <Row label="Status">
          <Chip
            size="small"
            label={tray.ok ? "Conectada" : "Indisponível"}
            color={tray.ok ? "success" : "error"}
            sx={{ fontWeight: 800 }}
          />
        </Row>
        <Divider />
        <Row label="Loja">
          <Typography variant="body2">{tray.api_host || "—"}</Typography>
        </Row>
        <Divider />
        <Row label="Modo de autenticação">
          <Typography variant="body2">{tray.auth_mode || "—"}</Typography>
        </Row>
        <Divider />
        <Row label="Token válido até">
          <Typography variant="body2">{tray.access_expires_at || "—"}</Typography>
        </Row>
        {tray.last_error && (
          <>
            <Divider />
            <Row label="Último erro">
              <Typography variant="body2" color="error">
                {tray.last_error}
              </Typography>
            </Row>
          </>
        )}

        <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
          Nesta etapa o catálogo da Tray é consultado somente para leitura. Publicar,
          despublicar e sincronizar não alteram produto, estoque, preço nem disponibilidade na Tray.
        </Alert>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, ...adminPanelPaperSx }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1 }}>
          Catálogo curado
        </Typography>

        <Row label="Produtos na loja">
          <Typography variant="body2">{catalog.total ?? 0}</Typography>
        </Row>
        <Divider />
        <Row label="Publicados em /loja">
          <Typography variant="body2">{catalog.published ?? 0}</Typography>
        </Row>
        <Divider />
        <Row label="Última sincronização">
          <Typography variant="body2">{formatDateTime(catalog.last_synced_at)}</Typography>
        </Row>

        <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
          <Button
            variant="contained"
            onClick={handleSync}
            disabled={syncing}
            startIcon={syncing ? <CircularProgress size={16} /> : <SyncRoundedIcon />}
          >
            ATUALIZAR COM A TRAY
          </Button>
          <Button variant="outlined" onClick={load} disabled={syncing} startIcon={<RefreshRoundedIcon />}>
            Recarregar status
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
