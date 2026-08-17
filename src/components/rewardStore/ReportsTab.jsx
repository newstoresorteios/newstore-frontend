// src/components/rewardStore/ReportsTab.jsx
//
// Aba RELATÓRIOS do módulo LOJA DE PRÊMIOS NS.
//
// O backend de RESGATES ainda não existe — resgate, carrinho e pedido são
// etapas futuras. Por isso esta aba mostra apenas:
//   - os números factuais do catálogo curado (vindos do PostgreSQL);
//   - estados vazios honestos para tudo que depende de resgate.
//
// NÃO gera métrica fictícia em runtime.

import * as React from "react";
import { Alert, Box, CircularProgress, Paper, Stack, Typography } from "@mui/material";

import { adminPanelPaperSx, newStoreAdminColors } from "../../adminTheme";
import { getStoreStatus, describeApiError } from "../../services/rewardStore";
import { formatDateTime } from "./shared";

function Metric({ label, value, hint }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 150, ...adminPanelPaperSx }}>
      <Typography variant="caption" sx={{ color: "rgba(245,247,245,0.6)", fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 900, fontSize: 30, lineHeight: 1.2, color: newStoreAdminColors.greenStrong }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" sx={{ color: "rgba(245,247,245,0.45)" }}>
          {hint}
        </Typography>
      )}
    </Paper>
  );
}

/** Métrica que só existirá quando o módulo de resgate for implementado. */
function PendingMetric({ label }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: 1, minWidth: 150, ...adminPanelPaperSx, opacity: 0.6 }}>
      <Typography variant="caption" sx={{ color: "rgba(245,247,245,0.6)", fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography sx={{ fontWeight: 900, fontSize: 30, lineHeight: 1.2, color: "rgba(245,247,245,0.45)" }}>
        —
      </Typography>
      <Typography variant="caption" sx={{ color: "rgba(245,247,245,0.4)" }}>
        aguarda o módulo de resgate
      </Typography>
    </Paper>
  );
}

export default function ReportsTab({ reloadToken }) {
  const [status, setStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    getStoreStatus()
      .then((payload) => {
        if (alive) setStatus(payload);
      })
      .catch((e) => {
        if (alive) setError(describeApiError(e, "Não foi possível carregar os números da loja."));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [reloadToken]);

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const catalog = status?.catalog || {};

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1.5 }}>
          Catálogo da loja
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Metric label="Produtos na loja" value={catalog.total ?? 0} />
          <Metric label="Publicados" value={catalog.published ?? 0} hint="visíveis em /loja" />
          <Metric label="Despublicados" value={catalog.unpublished ?? 0} hint="ocultos, mantidos na Tray" />
          <Metric
            label="Última sincronização"
            value={catalog.last_synced_at ? "OK" : "—"}
            hint={formatDateTime(catalog.last_synced_at)}
          />
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1.5 }}>
          Resgates
        </Typography>

        <Alert severity="info" variant="outlined" sx={{ mb: 2 }}>
          Nenhum resgate registrado até o momento. O fluxo de resgate com NSCréditos ainda não
          foi implementado, portanto estes indicadores permanecem vazios.
        </Alert>

        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <PendingMetric label="Total de resgates" />
          <PendingMetric label="Clientes que resgataram" />
          <PendingMetric label="NSCréditos utilizados" />
          <PendingMetric label="Pendentes" />
          <PendingMetric label="Enviados" />
          <PendingMetric label="Entregues" />
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1.5 }}>
          Últimos resgates
        </Typography>
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center", ...adminPanelPaperSx }}>
          <Typography sx={{ color: "rgba(245,247,245,0.6)" }}>
            Nenhum resgate registrado até o momento.
          </Typography>
        </Paper>
      </Box>
    </Stack>
  );
}
