// src/components/rewardStore/ReportsTab.jsx
//
// Aba RELATÓRIOS do módulo LOJA DE PRÊMIOS NS.
//
// Números REAIS de GET /api/admin/store/reports (PostgreSQL). Nenhum
// placeholder de "módulo ainda não implementado": quando não há dado, o
// valor é 0 — nunca "—".
//
// REGRA CRÍTICA: "NSCréditos resgatados" conta SOMENTE resgates confirmados.
// Uma tentativa compensada teve débito + compensação no ledger (efeito
// líquido zero) e aparece apenas no card de compensados.
//
// Estados de entrega (pendente/enviado/entregue) NÃO existem aqui: a
// logística é administrada pela Tray, não pela NewStore.

import * as React from "react";
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from "@mui/material";

import { adminPanelPaperSx, newStoreAdminColors } from "../../adminTheme";
import { getStoreReports, describeRedemptionAdminError } from "../../services/redemptionsAdmin";
import RedemptionStatusBadge from "./RedemptionStatusBadge";
import { formatDateTime, formatNsCredits } from "./shared";

const RECENT_LIMIT = 10;

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

export default function ReportsTab({ reloadToken, onOpenRedemption }) {
  const [report, setReport] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(await getStoreReports({ recentLimit: RECENT_LIMIT }));
    } catch (e) {
      setReport(null);
      setError(describeRedemptionAdminError(e, "Não foi possível carregar os números da loja."));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load, reloadToken]);

  if (loading) {
    return (
      <Stack alignItems="center" sx={{ py: 6 }}>
        <CircularProgress />
      </Stack>
    );
  }

  const catalog = report?.statuses || [];
  const catalogStats = report?.catalog || {};
  const r = report?.redemptions || {};
  const recent = report?.recent || [];
  const num = (value) => Number(value ?? 0).toLocaleString("pt-BR");

  return (
    <Stack spacing={3}>
      {error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={load}>
              Tentar de novo
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1.5 }}>
          Catálogo da loja
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Metric label="Produtos na loja" value={num(catalogStats.total)} />
          <Metric label="Publicados" value={num(catalogStats.published)} hint="visíveis em /loja" />
          <Metric label="Despublicados" value={num(catalogStats.unpublished)} hint="ocultos, mantidos na Tray" />
          <Metric
            label="Última sincronização"
            value={catalogStats.last_synced_at ? "OK" : "—"}
            hint={formatDateTime(catalogStats.last_synced_at)}
          />
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1.5 }}>
          Resgates
        </Typography>

        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Metric
            label="Resgates confirmados"
            value={num(r.confirmed_redemptions)}
            hint={`${num(r.total_attempts)} tentativas no total`}
          />
          <Metric label="Clientes que resgataram" value={num(r.unique_customers)} hint="clientes distintos, só confirmados" />
          <Metric
            label="NSCréditos resgatados"
            value={num(r.credits_redeemed)}
            hint="somente resgates confirmados"
          />
          <Metric label="Pedidos Tray" value={num(r.tray_orders_created)} hint="pedidos criados na Tray" />
          <Metric
            label="Em verificação"
            value={num(r.reconciliation_required)}
            hint="requer conciliação manual"
          />
          <Metric
            label="Compensados / falhos"
            value={num(Number(r.compensated ?? 0) + Number(r.failed ?? 0) + Number(r.blocked ?? 0))}
            hint={`${num(r.credits_compensated)} NSCréditos devolvidos`}
          />
        </Stack>

        <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
          A logística (separação, envio e entrega) é administrada pela Tray. A NewStore administra o
          resgate: créditos, pedido e conciliação.
        </Alert>
      </Box>

      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1.5 }}>
          Últimos resgates
        </Typography>

        {recent.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 3, textAlign: "center", ...adminPanelPaperSx }}>
            <Typography sx={{ color: "rgba(245,247,245,0.6)" }}>Nenhum resgate encontrado.</Typography>
          </Paper>
        ) : (
          <Stack spacing={1}>
            {recent.map((item) => (
              <Paper key={item.id} variant="outlined" sx={{ p: 1.5, ...adminPanelPaperSx }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={{ xs: 1, sm: 2 }}
                  alignItems={{ sm: "center" }}
                  justifyContent="space-between"
                >
                  <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }}>{item.user.name}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.6, wordBreak: "break-all" }}>
                      {formatDateTime(item.created_at)} · {item.user.email}
                    </Typography>
                  </Stack>

                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography sx={{ fontWeight: 900 }}>{formatNsCredits(item.credits_amount)}</Typography>
                    <RedemptionStatusBadge status={item.status} catalog={catalog} />
                    <Typography variant="caption" sx={{ opacity: 0.7 }}>
                      {item.tray_order_id ? `Tray #${item.tray_order_id}` : "sem pedido Tray"}
                    </Typography>
                    {onOpenRedemption && (
                      <Button size="small" variant="outlined" onClick={() => onOpenRedemption(item.id)}>
                        Ver detalhes
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
