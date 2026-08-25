// src/LojaPedidosPage.jsx
//
// "Meus Pedidos" (/loja/pedidos) — lista os resgates reais do usuário
// (GET /api/store/redemptions). Somente leitura.
//
// Mostra o status factual de cada resgate, incluindo o número do pedido
// Tray quando existe. Nunca finge sucesso nem esconde um estado ambíguo
// (reconciliation_required) atrás de uma mensagem genérica.
//
// ACOMPANHAMENTO (Tray): a listagem NUNCA consulta a Tray — seria uma
// chamada externa por pedido. O cliente pede o acompanhamento de UM pedido
// e só então o backend faz um GET read-only. Os dois domínios ficam
// visualmente separados: RESGATE (NewStore) e ACOMPANHAMENTO (Tray).

import * as React from "react";
import { Link as RouterLink } from "react-router-dom";
import { Alert, Button, Chip, Container, Divider, Paper, Skeleton, Stack, Typography } from "@mui/material";
import ReceiptLongRoundedIcon from "@mui/icons-material/ReceiptLongRounded";
import RedeemRoundedIcon from "@mui/icons-material/RedeemRounded";
import LocalShippingRoundedIcon from "@mui/icons-material/LocalShippingRounded";

import { useAuth } from "./authContext";
import LojaShell from "./components/rewardStore/LojaShell";
import { formatNsCredits } from "./services/nscredits";
import {
  listMyRedemptions,
  describeRedemptionStatus,
  redemptionStatusSeverity,
  getMyRedemptionTrayStatus,
  describeLogisticsPhase,
  describeTrackingUnavailable,
} from "./services/redemptions";
import { describeApiError } from "./services/rewardStore";

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const SEVERITY_COLOR = {
  success: "primary.main",
  warning: "warning.main",
  info: "rgba(255,255,255,0.6)",
  default: "rgba(255,255,255,0.5)",
};

// A Tray devolve datas como texto ("2026-05-28", "2026-05-28 15:14:29").
// Reformatamos para pt-BR sem criar Date: um `new Date("2026-05-28")` seria
// interpretado como UTC e poderia mostrar o dia anterior no fuso do cliente.
function formatDateOnly(value) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value);
}

function formatTrayDateTime(value) {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(value));
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : formatDateOnly(value);
}

/** Uma linha do acompanhamento. Campo sem valor factual simplesmente não aparece. */
function TrackingLine({ label, children }) {
  if (children == null || children === "") return null;
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      <Typography variant="caption" sx={{ opacity: 0.55, fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.9, overflowWrap: "anywhere", wordBreak: "break-word" }}>
        {children}
      </Typography>
    </Stack>
  );
}

/**
 * ACOMPANHAMENTO — projeção ao vivo do que a Tray sabe sobre a entrega.
 *
 * Carrega só quando o cliente pede (nada de polling, nada de intervalo). O
 * loading é local: uma falha aqui nunca some com o pedido nem altera o
 * status do resgate.
 */
function TrackingBlock({ redemptionId }) {
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [opened, setOpened] = React.useState(false);

  const load = React.useCallback(async () => {
    setOpened(true);
    setLoading(true);
    setError("");
    try {
      setData(await getMyRedemptionTrayStatus(redemptionId));
    } catch (e) {
      setData(null);
      setError("Não foi possível atualizar o acompanhamento agora. Seu resgate continua registrado normalmente.");
    } finally {
      setLoading(false);
    }
  }, [redemptionId]);

  if (!opened) {
    return (
      <Button
        size="small"
        variant="outlined"
        onClick={load}
        startIcon={<LocalShippingRoundedIcon />}
        sx={{ borderRadius: 999, mt: 1.5 }}
      >
        ACOMPANHAR PEDIDO
      </Button>
    );
  }

  const logistics = data?.available ? data.logistics : null;
  const trackingUrl = logistics?.tracking_url;

  return (
    <Stack spacing={1} sx={{ mt: 1.5 }}>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
      <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 800, letterSpacing: 0.6 }}>
        ACOMPANHAMENTO
      </Typography>

      {loading ? (
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          Atualizando acompanhamento...
        </Typography>
      ) : error ? (
        <Typography variant="caption" sx={{ opacity: 0.75 }}>
          {error}
        </Typography>
      ) : logistics ? (
        <Stack spacing={0.5}>
          <Typography sx={{ fontWeight: 800 }}>
            {describeLogisticsPhase(logistics.phase, logistics.label)}
          </Typography>
          {logistics.hint && (
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              {logistics.hint}
            </Typography>
          )}
          <TrackingLine label="Forma de envio">{logistics.shipment_method}</TrackingLine>
          <TrackingLine label="Transportadora">{logistics.carrier}</TrackingLine>
          <TrackingLine label="Código de rastreamento">{logistics.tracking_code}</TrackingLine>
          <TrackingLine label="Enviado em">{formatDateOnly(logistics.shipped_at)}</TrackingLine>
          <TrackingLine label="Previsão de entrega">{formatDateOnly(logistics.estimated_delivery_at)}</TrackingLine>
          <TrackingLine label="Última atualização">{formatTrayDateTime(logistics.updated_at)}</TrackingLine>
        </Stack>
      ) : (
        <Typography variant="caption" sx={{ opacity: 0.75 }}>
          {describeTrackingUnavailable(data)}
        </Typography>
      )}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ pt: 0.5 }}>
        <Button size="small" variant="text" onClick={load} disabled={loading} sx={{ borderRadius: 999 }}>
          ATUALIZAR ACOMPANHAMENTO
        </Button>
        {trackingUrl && (
          <Button
            size="small"
            variant="outlined"
            component="a"
            href={trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={{ borderRadius: 999 }}
          >
            RASTREAR ENTREGA
          </Button>
        )}
      </Stack>
    </Stack>
  );
}

function RedemptionRow({ redemption }) {
  const severity = redemptionStatusSeverity(redemption.status);
  // A Tray só tem o que acompanhar depois que o pedido existe lá.
  const canTrack = redemption.status === "confirmed" && Boolean(redemption.tray_order_id);
  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: "rgba(255,255,255,0.10)" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: "center" }}>
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ opacity: 0.55 }}>
            Pedido #{String(redemption.id).slice(0, 8)} · {formatDateTime(redemption.created_at)}
          </Typography>
          <Typography sx={{ fontWeight: 900 }}>{formatNsCredits(redemption.credits_amount)} NSCréditos</Typography>
        </Stack>
        <Chip
          size="small"
          label={describeRedemptionStatus(redemption.status)}
          sx={{ fontWeight: 800, bgcolor: "rgba(255,255,255,0.08)", color: SEVERITY_COLOR[severity] }}
        />
      </Stack>
      {redemption.status === "confirmed" && redemption.tray_order_id && (
        <Typography variant="caption" sx={{ display: "block", mt: 1, opacity: 0.6 }}>
          Pedido #{redemption.tray_order_id}
        </Typography>
      )}
      {redemption.status === "reconciliation_required" && (
        <Typography variant="caption" sx={{ display: "block", mt: 1, opacity: 0.75 }}>
          Ainda estamos confirmando este resgate com certeza. Seus créditos ficam reservados até resolvermos — não tente resgatar de novo enquanto isso.
        </Typography>
      )}
      {(redemption.status === "blocked_tray_contract_pending" ||
        redemption.status === "blocked_tray_customer_unmapped" ||
        redemption.status === "compensated" ||
        redemption.status === "failed") && (
        <Typography variant="caption" sx={{ display: "block", mt: 1, opacity: 0.6 }}>
          Seus créditos foram devolvidos integralmente.
        </Typography>
      )}
      {canTrack && <TrackingBlock redemptionId={redemption.id} />}
    </Paper>
  );
}

function ListaConteudo() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await listMyRedemptions({ page: 1, limit: 50 });
      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (e) {
      setItems([]);
      setError(describeApiError(e, "Não foi possível carregar seus pedidos agora."));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (authLoading || !user) return;
    load();
  }, [authLoading, user, load]);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <Stack spacing={3}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ReceiptLongRoundedIcon sx={{ color: "primary.main" }} />
          <Typography sx={{ fontWeight: 900, fontSize: { xs: 24, md: 30 } }}>Meus Pedidos</Typography>
        </Stack>

        {authLoading ? null : !user ? (
          <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: "center", borderColor: "rgba(255,255,255,0.08)" }}>
            <Stack spacing={1.5} alignItems="center">
              <Typography sx={{ fontWeight: 800 }}>
                Entre na sua conta para consultar seus NSCréditos e resgatar prêmios.
              </Typography>
              <Button component={RouterLink} to="/login" variant="contained" sx={{ borderRadius: 999, px: 3, fontWeight: 900 }}>
                ENTRAR
              </Button>
            </Stack>
          </Paper>
        ) : error ? (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Tentar de novo</Button>}>
            {error}
          </Alert>
        ) : loading ? (
          <Stack spacing={1.5}>
            {[0, 1, 2].map((k) => (
              <Skeleton key={k} variant="rounded" height={78} sx={{ borderRadius: 3 }} />
            ))}
          </Stack>
        ) : items.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: "center", borderColor: "rgba(255,255,255,0.08)" }}>
            <Stack spacing={1} alignItems="center">
              <RedeemRoundedIcon sx={{ fontSize: 40, color: "rgba(255,255,255,0.25)" }} />
              <Typography sx={{ fontWeight: 800 }}>Você ainda não tem nenhum pedido.</Typography>
              <Button component={RouterLink} to="/loja" variant="outlined" sx={{ borderRadius: 999, mt: 1 }}>
                VER PRÊMIOS
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Stack spacing={1.5}>
            {items.map((r) => (
              <RedemptionRow key={r.id} redemption={r} />
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

export default function LojaPedidosPage() {
  return (
    <LojaShell>
      <ListaConteudo />
    </LojaShell>
  );
}
