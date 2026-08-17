// src/components/rewardStore/CartDrawer.jsx
//
// Drawer do carrinho da Loja de Prêmios.
//
// Mostra os itens, o total em NSCréditos, o saldo do cliente e o resultado da
// PRÉ-VALIDAÇÃO. O botão final NÃO fecha resgate — o fechamento é a Fase 5.

import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import RemoveRoundedIcon from "@mui/icons-material/RemoveRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ShoppingCartRoundedIcon from "@mui/icons-material/ShoppingCartRounded";

import { formatNsCredits } from "../../services/nscredits";
import { describeIssue, describeCartError } from "../../services/rewardCart";
import { useCart } from "./CartContext";

function Thumb({ src, alt }) {
  const [failed, setFailed] = React.useState(false);
  const sx = {
    width: 64,
    height: 64,
    flex: "0 0 64px",
    borderRadius: 1.5,
    overflow: "hidden",
    bgcolor: src && !failed ? "#fff" : "rgba(255,255,255,0.06)",
  };
  if (!src || failed) return <Box sx={sx} />;
  return (
    <Box sx={sx}>
      <Box
        component="img"
        src={src}
        alt={alt || ""}
        onError={() => setFailed(true)}
        sx={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </Box>
  );
}

function ItemIssues({ issues }) {
  if (!issues?.length) return null;
  return (
    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
      {issues.map((code) => (
        <Alert key={code} severity="warning" variant="outlined" sx={{ py: 0, px: 1 }}>
          <Typography variant="caption">{describeIssue(code)}</Typography>
        </Alert>
      ))}
    </Stack>
  );
}

export default function CartDrawer({ open, onClose, walletBalance }) {
  const { cart, busy, validation, updateItem, removeItem, validate, loading } = useCart();
  const [error, setError] = React.useState("");

  const issuesByItem = React.useMemo(() => {
    const map = {};
    (validation?.items || []).forEach((i) => {
      map[i.id] = i.issues || [];
    });
    return map;
  }, [validation]);

  async function run(action) {
    setError("");
    try {
      await action();
    } catch (e) {
      setError(describeCartError(e));
    }
  }

  const total = cart.totals?.nscredits ?? 0;
  const saldo = validation?.wallet?.balance ?? walletBalance;
  const temSaldo = typeof saldo === "number" ? saldo >= total : null;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 420 }, bgcolor: "background.paper" } }}
    >
      <Stack sx={{ height: "100%" }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 2, pb: 1 }}>
          <ShoppingCartRoundedIcon />
          <Typography sx={{ fontWeight: 900, flex: 1 }}>SEU CARRINHO</Typography>
          <IconButton onClick={onClose} aria-label="Fechar carrinho">
            <CloseRoundedIcon />
          </IconButton>
        </Stack>

        <Divider />

        <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
          {loading ? (
            <Stack alignItems="center" sx={{ py: 6 }}>
              <CircularProgress />
            </Stack>
          ) : cart.items.length === 0 ? (
            <Alert severity="info" variant="outlined">
              Seu carrinho está vazio.
            </Alert>
          ) : (
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}

              {cart.items.map((item) => (
                <Box key={item.id}>
                  <Stack direction="row" spacing={1.5}>
                    <Thumb src={item.image_url} alt={item.name} />

                    <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 800, lineHeight: 1.3 }}>{item.name}</Typography>
                      {item.variant_name && (
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          {item.variant_name}
                        </Typography>
                      )}

                      <Typography sx={{ fontWeight: 900, color: "secondary.main" }}>
                        {formatNsCredits(item.nscredits_unit_price)} NSCréditos
                      </Typography>

                      {item.price_changed && (
                        <Typography variant="caption" sx={{ color: "warning.main" }}>
                          Valor atualizado de {formatNsCredits(item.nscredits_unit_price_snapshot)} para{" "}
                          {formatNsCredits(item.nscredits_unit_price)} NSCréditos.
                        </Typography>
                      )}

                      <Stack direction="row" spacing={1} alignItems="center">
                        <IconButton
                          size="small"
                          disabled={busy || item.quantity <= 1}
                          aria-label={`Diminuir ${item.name}`}
                          onClick={() => run(() => updateItem(item.id, item.quantity - 1))}
                        >
                          <RemoveRoundedIcon fontSize="small" />
                        </IconButton>
                        <Typography sx={{ fontWeight: 800, minWidth: 20, textAlign: "center" }}>
                          {item.quantity}
                        </Typography>
                        <IconButton
                          size="small"
                          disabled={busy}
                          aria-label={`Aumentar ${item.name}`}
                          onClick={() => run(() => updateItem(item.id, item.quantity + 1))}
                        >
                          <AddRoundedIcon fontSize="small" />
                        </IconButton>

                        <Box sx={{ flex: 1 }} />

                        <Button
                          size="small"
                          color="inherit"
                          disabled={busy}
                          startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
                          onClick={() => run(() => removeItem(item.id))}
                        >
                          REMOVER
                        </Button>
                      </Stack>

                      <ItemIssues issues={issuesByItem[item.id]} />
                    </Stack>
                  </Stack>
                  <Divider sx={{ mt: 2 }} />
                </Box>
              ))}
            </Stack>
          )}
        </Box>

        {cart.items.length > 0 && (
          <Box sx={{ p: 2, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <Stack spacing={1}>
              <Stack direction="row" justifyContent="space-between">
                <Typography sx={{ fontWeight: 700, opacity: 0.75 }}>TOTAL</Typography>
                <Typography sx={{ fontWeight: 900, color: "secondary.main" }}>
                  {formatNsCredits(total)} NSCréditos
                </Typography>
              </Stack>

              <Stack direction="row" justifyContent="space-between">
                <Typography sx={{ fontWeight: 700, opacity: 0.75 }}>SALDO</Typography>
                <Typography sx={{ fontWeight: 800 }}>
                  {typeof saldo === "number" ? `${formatNsCredits(saldo)} NSCréditos` : "—"}
                </Typography>
              </Stack>

              {validation && !validation.valid && !validation.wallet?.sufficient && validation.wallet?.missing > 0 && (
                <Alert severity="warning" variant="outlined">
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                    Saldo insuficiente
                  </Typography>
                  <Typography variant="caption" component="div">
                    Você possui: {formatNsCredits(validation.wallet.balance)} NSCréditos
                  </Typography>
                  <Typography variant="caption" component="div">
                    Necessário: {formatNsCredits(validation.cart.total_nscredits)} NSCréditos
                  </Typography>
                  <Typography variant="caption" component="div" sx={{ fontWeight: 800 }}>
                    Faltam: {formatNsCredits(validation.wallet.missing)} NSCréditos
                  </Typography>
                </Alert>
              )}

              {validation?.valid && (
                <Alert severity="success" variant="outlined">
                  Carrinho pronto para revisão.
                </Alert>
              )}

              {validation && !validation.valid && validation.issues?.filter((c) => c !== "insufficient_nscredits").map((code) => (
                <Alert key={code} severity="warning" variant="outlined">
                  {describeIssue(code)}
                </Alert>
              ))}

              <Button
                variant="contained"
                fullWidth
                disabled={busy}
                startIcon={busy ? <CircularProgress size={16} /> : null}
                onClick={() => run(validate)}
                sx={{ bgcolor: "primary.main", color: "#0E0E0E", fontWeight: 900, borderRadius: 999 }}
              >
                VALIDAR CARRINHO
              </Button>

              {/* O fechamento do resgate é a Fase 5. Nada de checkout falso. */}
              <Button variant="outlined" fullWidth disabled sx={{ borderRadius: 999, fontWeight: 900 }}>
                CONTINUAR
              </Button>
              <Typography variant="caption" sx={{ opacity: 0.55, textAlign: "center" }}>
                {validation?.valid
                  ? "O fechamento do resgate será liberado em breve."
                  : "Valide o carrinho para conferir disponibilidade e saldo."}
              </Typography>

              {temSaldo === false && !validation && (
                <Chip size="small" label="Saldo pode ser insuficiente" sx={{ alignSelf: "center" }} />
              )}
            </Stack>
          </Box>
        )}
      </Stack>
    </Drawer>
  );
}
