// src/components/rewardStore/NsCreditsTab.jsx
//
// Aba NSCRÉDITOS do módulo LOJA DE PRÊMIOS NS.
//
// Busca clientes reais, mostra saldo e histórico, e permite ao admin
// adicionar/remover NSCréditos com motivo obrigatório.
//
// O saldo nunca é sobrescrito: o frontend envia uma OPERAÇÃO (credit/debit)
// e o backend recalcula. O preview do novo saldo aqui é apenas visual.

import * as React from "react";
import {
  Alert,
  Box,
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
  TextField,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import PersonSearchRoundedIcon from "@mui/icons-material/PersonSearchRounded";

import { adminPanelPaperSx, newStoreAdminColors } from "../../adminTheme";
import {
  searchNsCreditUsers,
  getNsCreditWallet,
  applyNsCreditAdjustment,
  newIdempotencyKey,
  parseNsCreditAmountInput,
  formatNsCredits,
  describeNsCreditError,
} from "../../services/nscredits";
import { formatDateTime } from "./shared";

const PAGE_LIMIT = 20;

function OperationChip({ operation }) {
  const isCredit = operation === "credit";
  return (
    <Chip
      size="small"
      label={isCredit ? "Crédito" : "Débito"}
      sx={{
        fontWeight: 800,
        ...(isCredit
          ? { bgcolor: newStoreAdminColors.greenStrong, color: "#061006" }
          : { bgcolor: "rgba(239,111,108,0.22)", color: "#FFD9D8" }),
      }}
    />
  );
}

/* ─────────────────────────── Modal ─────────────────────────── */

function AdjustmentDialog({ open, operation, user, balance, busy, onClose, onConfirm }) {
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setAmount("");
      setReason("");
      setConfirming(false);
    }
  }, [open]);

  if (!open || !user) return null;

  const isCredit = operation === "credit";
  const parsedAmount = parseNsCreditAmountInput(amount);
  const trimmedReason = reason.trim();
  const insufficient = !isCredit && parsedAmount !== null && parsedAmount > balance;
  const newBalance = parsedAmount === null ? null : isCredit ? balance + parsedAmount : balance - parsedAmount;
  const canConfirm = parsedAmount !== null && trimmedReason.length > 0 && !insufficient && !busy;

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 900 }}>
        {isCredit ? "Adicionar NSCréditos" : "Remover NSCréditos"}
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack spacing={0.25}>
            <Typography variant="caption" sx={{ opacity: 0.6, fontWeight: 700 }}>
              CLIENTE
            </Typography>
            <Typography sx={{ fontWeight: 800 }}>{user.name}</Typography>
            <Typography variant="caption" sx={{ opacity: 0.6 }}>
              {user.email} · ID #{user.id}
            </Typography>
          </Stack>

          <Stack spacing={0.25}>
            <Typography variant="caption" sx={{ opacity: 0.6, fontWeight: 700 }}>
              SALDO ATUAL
            </Typography>
            <Typography sx={{ fontWeight: 900, fontSize: 20 }}>
              {formatNsCredits(balance)} NSCréditos
            </Typography>
          </Stack>

          {confirming ? (
            <Alert severity={isCredit ? "success" : "warning"} variant="outlined">
              <Typography sx={{ fontWeight: 800 }}>
                Você está {isCredit ? "adicionando" : "removendo"} {formatNsCredits(parsedAmount)} NSCréditos{" "}
                {isCredit ? "para" : "de"} {user.name}.
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Motivo: {trimmedReason}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Novo saldo: {formatNsCredits(newBalance)} NSCréditos
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, fontWeight: 800 }}>
                Confirmar?
              </Typography>
            </Alert>
          ) : (
            <>
              <TextField
                autoFocus
                label="Quantidade"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                disabled={busy}
                error={amount.length > 0 && parsedAmount === null}
                helperText={
                  amount.length > 0 && parsedAmount === null
                    ? "Informe um número inteiro maior que zero."
                    : " "
                }
                inputProps={{ inputMode: "numeric", "aria-label": "Quantidade" }}
                fullWidth
              />

              <TextField
                label="Motivo"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 300))}
                disabled={busy}
                error={reason.length > 0 && trimmedReason.length === 0}
                helperText={`${trimmedReason.length}/300 · obrigatório`}
                inputProps={{ "aria-label": "Motivo" }}
                fullWidth
              />

              <Stack spacing={0.25}>
                <Typography variant="caption" sx={{ opacity: 0.6, fontWeight: 700 }}>
                  NOVO SALDO
                </Typography>
                <Typography
                  sx={{
                    fontWeight: 900,
                    fontSize: 20,
                    color: insufficient ? "error.main" : newStoreAdminColors.greenStrong,
                  }}
                >
                  {newBalance === null ? "—" : `${formatNsCredits(newBalance)} NSCréditos`}
                </Typography>
              </Stack>

              {insufficient && <Alert severity="error">Saldo insuficiente.</Alert>}
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={confirming ? () => setConfirming(false) : onClose} disabled={busy}>
          {confirming ? "VOLTAR" : "CANCELAR"}
        </Button>
        <Button
          variant="contained"
          disabled={!canConfirm}
          startIcon={busy ? <CircularProgress size={16} /> : null}
          onClick={() => {
            if (!confirming) {
              setConfirming(true);
              return;
            }
            onConfirm({ amount: parsedAmount, reason: trimmedReason });
          }}
        >
          {confirming ? "CONFIRMAR" : isCredit ? "CONFIRMAR CRÉDITO" : "CONFIRMAR DÉBITO"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─────────────────────────── Aba ─────────────────────────── */

export default function NsCreditsTab({ onNotify }) {
  const [q, setQ] = React.useState("");
  const [applied, setApplied] = React.useState({ q: "", page: 1 });
  const [users, setUsers] = React.useState([]);
  const [paging, setPaging] = React.useState({ page: 1, limit: PAGE_LIMIT, total: 0 });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const [selectedId, setSelectedId] = React.useState(null);
  const [detail, setDetail] = React.useState(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState("");

  const [dialog, setDialog] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const search = React.useCallback(async (filters) => {
    setLoading(true);
    setError("");
    try {
      const payload = await searchNsCreditUsers({ ...filters, limit: PAGE_LIMIT });
      setUsers(Array.isArray(payload?.items) ? payload.items : []);
      setPaging(payload?.paging || { page: filters.page, limit: PAGE_LIMIT, total: 0 });
    } catch (e) {
      setUsers([]);
      setError(describeNsCreditError(e, "Não foi possível buscar os clientes."));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    search(applied);
  }, [applied, search]);

  const loadDetail = React.useCallback(async (userId) => {
    setDetailLoading(true);
    setDetailError("");
    try {
      setDetail(await getNsCreditWallet(userId, { page: 1, limit: 50 }));
    } catch (e) {
      setDetail(null);
      setDetailError(describeNsCreditError(e, "Não foi possível carregar a carteira."));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function selectUser(user) {
    setSelectedId(user.id);
    loadDetail(user.id);
  }

  async function confirmAdjustment({ amount, reason }) {
    if (!dialog) return;
    setBusy(true);
    try {
      const out = await applyNsCreditAdjustment(dialog.user.id, {
        operation: dialog.operation,
        amount,
        reason,
        // Uma chave por operação confirmada: protege contra duplo envio.
        idempotencyKey: dialog.idempotencyKey,
      });

      const novoSaldo = out?.wallet?.balance;
      onNotify(
        out?.replayed
          ? "Essa movimentação já havia sido registrada."
          : `${dialog.operation === "credit" ? "Crédito" : "Débito"} registrado. Novo saldo: ${formatNsCredits(novoSaldo)} NSCréditos.`,
        out?.replayed ? "info" : "success"
      );

      setDialog(null);
      await loadDetail(dialog.user.id);
      // Mantém a lista sincronizada com o novo saldo.
      setUsers((current) =>
        current.map((u) => (u.id === dialog.user.id ? { ...u, balance: novoSaldo ?? u.balance } : u))
      );
    } catch (e) {
      onNotify(describeNsCreditError(e, "Não foi possível registrar a movimentação."), "error");
    } finally {
      setBusy(false);
    }
  }

  const totalPages = paging.total ? Math.max(1, Math.ceil(paging.total / paging.limit)) : 1;
  const balance = detail?.wallet?.balance ?? 0;

  return (
    <>
      <Box
        component="form"
        onSubmit={(e) => {
          e.preventDefault();
          setApplied({ q, page: 1 });
        }}
        sx={{ mb: 2 }}
      >
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <TextField
            size="small"
            fullWidth
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente por nome, e-mail, telefone ou ID"
            inputProps={{ "aria-label": "Buscar cliente" }}
          />
          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="contained" disabled={loading}>
              Buscar
            </Button>
            <Button
              variant="outlined"
              onClick={() => search(applied)}
              disabled={loading}
              startIcon={<RefreshRoundedIcon />}
            >
              Recarregar
            </Button>
          </Stack>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start">
        {/* Lista de clientes */}
        <Stack spacing={1} sx={{ width: { xs: "100%", md: 360 }, flexShrink: 0 }}>
          {loading ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress />
            </Stack>
          ) : users.length === 0 ? (
            <Alert severity="info" variant="outlined" icon={<PersonSearchRoundedIcon />}>
              Nenhum cliente encontrado.
            </Alert>
          ) : (
            users.map((u) => (
              <Paper
                key={u.id}
                variant="outlined"
                onClick={() => selectUser(u)}
                sx={{
                  p: 1.5,
                  cursor: "pointer",
                  ...adminPanelPaperSx,
                  borderColor:
                    selectedId === u.id ? newStoreAdminColors.borderStrong : "rgba(255,255,255,0.10)",
                  "&:hover": { borderColor: "rgba(103,194,58,0.45)" },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }}>{u.name}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.6, wordBreak: "break-all" }}>
                      {u.email} · ID #{u.id}
                    </Typography>
                  </Stack>
                  <Chip
                    size="small"
                    label={formatNsCredits(u.balance)}
                    sx={{ fontWeight: 900, bgcolor: "rgba(255,255,255,0.08)", flexShrink: 0 }}
                  />
                </Stack>
              </Paper>
            ))
          )}

          {paging.total > paging.limit && (
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ pt: 1 }}>
              <Button
                size="small"
                variant="outlined"
                disabled={loading || applied.page <= 1}
                onClick={() => setApplied((c) => ({ ...c, page: c.page - 1 }))}
              >
                Anterior
              </Button>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                {applied.page} / {totalPages} · {paging.total} clientes
              </Typography>
              <Button
                size="small"
                variant="outlined"
                disabled={loading || applied.page >= totalPages}
                onClick={() => setApplied((c) => ({ ...c, page: c.page + 1 }))}
              >
                Próxima
              </Button>
            </Stack>
          )}
        </Stack>

        {/* Carteira do cliente selecionado */}
        <Box sx={{ flex: 1, width: "100%", minWidth: 0 }}>
          {!selectedId ? (
            <Alert severity="info" variant="outlined">
              Selecione um cliente para ver o saldo e o histórico de NSCréditos.
            </Alert>
          ) : detailLoading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress />
            </Stack>
          ) : detailError ? (
            <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => loadDetail(selectedId)}>Tentar de novo</Button>}>
              {detailError}
            </Alert>
          ) : detail ? (
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, ...adminPanelPaperSx }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  justifyContent="space-between"
                  alignItems={{ sm: "center" }}
                >
                  <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: 18 }}>{detail.user.name}</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.6, wordBreak: "break-all" }}>
                      {detail.user.email} · ID #{detail.user.id}
                    </Typography>
                  </Stack>

                  <Stack spacing={0.25} sx={{ textAlign: { sm: "right" } }}>
                    <Typography variant="caption" sx={{ opacity: 0.6, fontWeight: 700 }}>
                      SALDO ATUAL
                    </Typography>
                    <Typography
                      sx={{ fontWeight: 900, fontSize: 26, color: newStoreAdminColors.greenStrong }}
                    >
                      {formatNsCredits(balance)} NSCréditos
                    </Typography>
                  </Stack>
                </Stack>

                <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="contained"
                    startIcon={<AddRoundedIcon />}
                    onClick={() =>
                      setDialog({ operation: "credit", user: detail.user, idempotencyKey: newIdempotencyKey() })
                    }
                  >
                    ADICIONAR CRÉDITOS
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<RemoveRoundedIcon />}
                    onClick={() =>
                      setDialog({ operation: "debit", user: detail.user, idempotencyKey: newIdempotencyKey() })
                    }
                  >
                    REMOVER CRÉDITOS
                  </Button>
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, ...adminPanelPaperSx }}>
                <Typography sx={{ fontWeight: 900, mb: 1.5 }}>Histórico</Typography>

                {detail.transactions.length === 0 ? (
                  <Typography variant="body2" sx={{ opacity: 0.6 }}>
                    Nenhuma movimentação registrada para este cliente.
                  </Typography>
                ) : (
                  <Stack divider={<Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />}>
                    {detail.transactions.map((t) => (
                      <Stack
                        key={t.id}
                        direction={{ xs: "column", sm: "row" }}
                        spacing={{ xs: 0.5, sm: 2 }}
                        justifyContent="space-between"
                        sx={{ py: 1.25 }}
                      >
                        <Stack spacing={0.4} sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            <OperationChip operation={t.operation} />
                            <Typography
                              sx={{
                                fontWeight: 900,
                                color: t.operation === "credit" ? newStoreAdminColors.greenStrong : "#EF6F6C",
                              }}
                            >
                              {t.operation === "credit" ? "+" : "−"} {formatNsCredits(t.amount)}
                            </Typography>
                            <Chip size="small" variant="outlined" label={t.source_type} sx={{ fontWeight: 700 }} />
                          </Stack>
                          {t.reason && <Typography variant="body2">{t.reason}</Typography>}
                          <Typography variant="caption" sx={{ opacity: 0.55 }}>
                            {formatDateTime(t.created_at)}
                          </Typography>
                        </Stack>

                        <Stack spacing={0.25} sx={{ textAlign: { sm: "right" }, flexShrink: 0 }}>
                          <Typography variant="caption" sx={{ opacity: 0.6 }}>
                            Saldo: {formatNsCredits(t.balance_after)}
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.4 }}>
                            antes: {formatNsCredits(t.balance_before)}
                          </Typography>
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Stack>
          ) : null}
        </Box>
      </Stack>

      <AdjustmentDialog
        open={Boolean(dialog)}
        operation={dialog?.operation}
        user={dialog?.user}
        balance={balance}
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={confirmAdjustment}
      />
    </>
  );
}
