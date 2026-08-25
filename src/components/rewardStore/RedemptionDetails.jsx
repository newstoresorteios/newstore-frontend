// src/components/rewardStore/RedemptionDetails.jsx
//
// Detalhe administrativo de UM resgate — modal, o mesmo padrão já usado
// pelas outras abas do módulo (NsCreditsTab), sem criar rota nova.
//
// SOMENTE LEITURA. Nada aqui altera resgate, saldo, ledger ou pedido Tray.
// O botão "Atualizar status" faz exclusivamente um GET no backend, que por
// sua vez faz GET /orders/:id na Tray.

import * as React from "react";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";

import { adminPanelPaperSx, newStoreAdminColors } from "../../adminTheme";
import {
  getRedemption,
  getRedemptionTrayOrder,
  describeRedemptionAdminError,
} from "../../services/redemptionsAdmin";
import RedemptionStatusBadge from "./RedemptionStatusBadge";
import RedemptionTimeline from "./RedemptionTimeline";
import { Thumb, formatDateTime, formatNsCredits } from "./shared";

function Section({ title, children, action }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, ...adminPanelPaperSx }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontWeight: 900 }}>{title}</Typography>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

function Row({ label, children }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={{ xs: 0.25, sm: 2 }}
      justifyContent="space-between"
      sx={{ py: 0.75 }}
    >
      <Typography variant="body2" sx={{ color: "rgba(245,247,245,0.65)", fontWeight: 700 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ textAlign: { sm: "right" }, wordBreak: "break-word" }}>
        {children}
      </Typography>
    </Stack>
  );
}

/** Endereço ESCOLHIDO NO RESGATE (snapshot), nunca o endereço atual do cliente. */
function AddressBlock({ address }) {
  if (!address) {
    return (
      <Typography variant="body2" sx={{ opacity: 0.6 }}>
        Nenhum endereço registrado neste resgate.
      </Typography>
    );
  }

  const linha2 = [address.neighborhood, address.city, address.state].filter(Boolean).join(" · ");
  return (
    <Stack spacing={0.4}>
      {address.recipient_name && <Typography sx={{ fontWeight: 800 }}>{address.recipient_name}</Typography>}
      <Typography variant="body2">
        {[address.street, address.number].filter(Boolean).join(", ")}
        {address.complement ? ` — ${address.complement}` : ""}
      </Typography>
      {linha2 && <Typography variant="body2">{linha2}</Typography>}
      {address.zipcode && (
        <Typography variant="body2" sx={{ opacity: 0.7 }}>
          CEP {address.zipcode}
          {address.country ? ` · ${address.country}` : ""}
        </Typography>
      )}
    </Stack>
  );
}

/** Impacto financeiro real, lido de coupon_balance_history. Nunca recalculado aqui. */
function LedgerBlock({ ledger }) {
  if (!ledger || !ledger.entries?.length) {
    return (
      <Typography variant="body2" sx={{ opacity: 0.6 }}>
        Nenhum lançamento de NSCréditos vinculado a este resgate.
      </Typography>
    );
  }

  return (
    <Stack spacing={1}>
      <Stack divider={<Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />}>
        {ledger.entries.map((entry) => (
          <Stack
            key={entry.id}
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 0.25, sm: 2 }}
            justifyContent="space-between"
            sx={{ py: 1 }}
          >
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Chip size="small" variant="outlined" label={entry.event_type} sx={{ fontWeight: 700 }} />
                <Typography
                  sx={{
                    fontWeight: 900,
                    color: entry.operation === "credit" ? newStoreAdminColors.greenStrong : "#EF6F6C",
                  }}
                >
                  {entry.operation === "credit" ? "+" : "−"} {formatNsCredits(Math.abs(entry.delta))}
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ opacity: 0.55 }}>
                {formatDateTime(entry.created_at)}
              </Typography>
            </Stack>
            <Stack spacing={0.25} sx={{ textAlign: { sm: "right" }, flexShrink: 0 }}>
              <Typography variant="caption" sx={{ opacity: 0.6 }}>
                Saldo: {formatNsCredits(entry.balance_after)}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.4 }}>
                antes: {formatNsCredits(entry.balance_before)}
              </Typography>
            </Stack>
          </Stack>
        ))}
      </Stack>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
      <Row label="Débito">{formatNsCredits(ledger.debit)} NSCréditos</Row>
      <Row label="Compensação">{formatNsCredits(ledger.compensation)} NSCréditos</Row>
      <Row label="Efeito líquido">{formatNsCredits(-ledger.net)} NSCréditos consumidos</Row>

      {!ledger.matches_expectation && (
        <Alert severity="warning" variant="outlined">
          O ledger deste resgate não bate com o esperado para o status atual. Nenhuma correção é feita
          pelo painel — este é um alerta para conferência manual.
        </Alert>
      )}
    </Stack>
  );
}

/** Pedido na Tray — SOMENTE consulta. O painel nunca altera nada lá. */
function TrayBlock({ trayOrderId, tray, loading, error, onRefresh }) {
  if (!trayOrderId) {
    return (
      <Typography variant="body2" sx={{ opacity: 0.6 }}>
        Este resgate ainda não gerou pedido na Tray.
      </Typography>
    );
  }

  const order = tray?.order || null;
  return (
    <Stack spacing={1}>
      <Row label="Pedido Tray">#{trayOrderId}</Row>

      {loading && (
        <Stack alignItems="center" sx={{ py: 2 }}>
          <CircularProgress size={22} />
        </Stack>
      )}

      {error && <Alert severity="warning">{error}</Alert>}

      {order && (
        <>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
          {/* Status COMERCIAL cru da Tray — útil para a operação, nunca
              mostrado ao cliente (ele vê só a fase logística normalizada). */}
          <Row label="Status na Tray">{order.status || "—"}</Row>
          <Row label="Pagamento">{order.payment_method || "—"}</Row>
          <Row label="Origem">{order.point_sale || "—"}</Row>
          <Row label="Envio">{order.shipment || "—"}</Row>
          <Row label="Valor do envio">{order.shipment_value || "—"}</Row>
          <Row label="Total">{order.total || "—"}</Row>
          <Row label="Criado em">{order.created_at || "—"}</Row>
          <Row label="Atualizado em">{order.updated_at || "—"}</Row>

          {order.logistics && (
            <>
              <Divider sx={{ borderColor: "rgba(255,255,255,0.08)", my: 1 }} />
              <Typography variant="caption" sx={{ opacity: 0.5, fontWeight: 800, letterSpacing: 0.6 }}>
                LOGÍSTICA TRAY
              </Typography>
              <Row label="Situação">{order.logistics.label}</Row>
              {/* Campo sem valor factual é omitido — nunca "Transportadora: —". */}
              {order.logistics.shipment_method && (
                <Row label="Forma de envio">{order.logistics.shipment_method}</Row>
              )}
              {order.logistics.carrier && <Row label="Transportadora">{order.logistics.carrier}</Row>}
              {order.logistics.tracking_code && (
                <Row label="Rastreamento">{order.logistics.tracking_code}</Row>
              )}
              {order.logistics.shipped_at && <Row label="Enviado em">{order.logistics.shipped_at}</Row>}
              {order.logistics.estimated_delivery_at && (
                <Row label="Previsão de entrega">{order.logistics.estimated_delivery_at}</Row>
              )}
              {order.logistics.tracking_url && (
                <Row label="Link de rastreio">
                  <Button
                    size="small"
                    variant="text"
                    component="a"
                    href={order.logistics.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ p: 0, minWidth: 0 }}
                  >
                    abrir
                  </Button>
                </Row>
              )}
            </>
          )}
        </>
      )}

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ pt: 1 }}>
        <Button size="small" variant="outlined" onClick={onRefresh} disabled={loading} startIcon={<RefreshRoundedIcon />}>
          Atualizar status
        </Button>
        {tray?.fetched_at && (
          <Typography variant="caption" sx={{ opacity: 0.6 }}>
            Última consulta: {new Date(tray.fetched_at).toLocaleTimeString("pt-BR")}
          </Typography>
        )}
      </Stack>

      <Typography variant="caption" sx={{ opacity: 0.5 }}>
        Consulta somente leitura. A logística (separação, envio e entrega) é administrada pela Tray.
      </Typography>
    </Stack>
  );
}

export default function RedemptionDetails({ redemptionId, catalog = [], onClose }) {
  const [detail, setDetail] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [tray, setTray] = React.useState(null);
  const [trayLoading, setTrayLoading] = React.useState(false);
  const [trayError, setTrayError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDetail(await getRedemption(redemptionId));
    } catch (e) {
      setDetail(null);
      setError(describeRedemptionAdminError(e, "Não foi possível carregar o resgate."));
    } finally {
      setLoading(false);
    }
  }, [redemptionId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const loadTray = React.useCallback(async () => {
    setTrayLoading(true);
    setTrayError("");
    try {
      setTray(await getRedemptionTrayOrder(redemptionId));
    } catch (e) {
      setTray(null);
      setTrayError(describeRedemptionAdminError(e, "Não foi possível consultar o pedido na Tray."));
    } finally {
      setTrayLoading(false);
    }
  }, [redemptionId]);

  const redemption = detail?.redemption || null;

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle sx={{ fontWeight: 900 }}>Resgate</DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 6 }}>
            <CircularProgress />
          </Stack>
        ) : error ? (
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
        ) : detail ? (
          <Stack spacing={2}>
            <Section title="Resgate">
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
                <RedemptionStatusBadge status={redemption.status} statusInfo={redemption.status_info} catalog={catalog} />
                <Typography variant="caption" sx={{ opacity: 0.6, wordBreak: "break-all" }}>
                  ID {redemption.id}
                </Typography>
              </Stack>
              <Row label="NSCréditos">{formatNsCredits(redemption.credits_amount)}</Row>
              <Row label="Pedido Tray">{redemption.tray_order_id ? `#${redemption.tray_order_id}` : "—"}</Row>
              <Row label="Criado em">{formatDateTime(redemption.created_at)}</Row>
              <Row label="Atualizado em">{formatDateTime(redemption.updated_at)}</Row>
              {redemption.failure_reason && <Row label="Motivo">{redemption.failure_reason}</Row>}
            </Section>

            <Section title="Cliente">
              <Row label="Nome">{detail.user.name}</Row>
              <Row label="E-mail">{detail.user.email}</Row>
              <Row label="ID">#{detail.user.id}</Row>
            </Section>

            <Section title="Itens">
              {detail.items.length === 0 ? (
                <Typography variant="body2" sx={{ opacity: 0.6 }}>
                  Nenhum item registrado neste resgate.
                </Typography>
              ) : (
                <Stack divider={<Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />}>
                  {detail.items.map((item) => (
                    <Stack key={item.id} direction="row" spacing={1.5} alignItems="center" sx={{ py: 1.25 }}>
                      <Thumb src={item.image_url} alt={item.product_name} />
                      <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontWeight: 800 }}>{item.product_name}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.6 }}>
                          Tray #{item.tray_product_id}
                          {item.tray_variant_id ? ` · variação #${item.tray_variant_id}` : ""}
                          {item.variant_name ? ` · ${item.variant_name}` : ""}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.6 }}>
                          {item.quantity} × {formatNsCredits(item.nscredits_unit_price)} NSCréditos
                        </Typography>
                      </Stack>
                      <Typography sx={{ fontWeight: 900, flexShrink: 0 }}>
                        {formatNsCredits(item.nscredits_total)}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              )}
            </Section>

            <Section title="Endereço do resgate">
              <AddressBlock address={detail.address} />
            </Section>

            <Section title="Histórico do resgate">
              <RedemptionTimeline events={detail.events} catalog={catalog} />
            </Section>

            <Section title="NSCréditos (ledger)">
              <LedgerBlock ledger={detail.ledger} />
            </Section>

            <Section title="Pedido na Tray">
              <TrayBlock
                trayOrderId={redemption.tray_order_id}
                tray={tray}
                loading={trayLoading}
                error={trayError}
                onRefresh={loadTray}
              />
            </Section>
          </Stack>
        ) : null}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>FECHAR</Button>
      </DialogActions>
    </Dialog>
  );
}
