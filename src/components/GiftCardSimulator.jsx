// src/components/GiftCardSimulator.jsx
import * as React from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  InputAdornment,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Tooltip,
  Chip,
  Button,
} from "@mui/material";

/* ===================== Helpers ===================== */
const brl = (v) =>
  (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

// Aceita "6799.99" ou "6.799,99"
const parseBRL = (s) => {
  if (typeof s === "number") return s;
  if (!s) return 0;
  const cleaned = String(s).trim().replace(/\s+/g, "");
  // Remove separador de milhar e normaliza decimal
  const n = cleaned.replace(/\./g, "").replace(",", ".");
  const v = Number.parseFloat(n);
  return Number.isFinite(v) ? v : 0;
};

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/* ===================== Regras da Tabela (anexo) ===================== */
const GIFT_RULES = [
  { min: 50,   max: 250,  minPurchase: 1500 },
  { min: 251,  max: 600,  minPurchase: 3500 },
  { min: 601,  max: 800,  minPurchase: 5500 },
  { min: 801,  max: 1000, minPurchase: 7500 },
  { min: 1101, max: 2100, minPurchase: 15000 },
  { min: 2101, max: 3100, minPurchase: 22500 },
  { min: 3101, max: 4200, minPurchase: 30000 },
];

function findRuleForGiftUse(valueToUse) {
  return GIFT_RULES.find((r) => valueToUse >= r.min && valueToUse <= r.max) || null;
}

/* ===================== Componente ===================== */
export default function GiftCardSimulator({
  creditPriceDefault = 6799.99,
  pixPriceDefault = 5779.99,
  giftBalanceDefault = 0, // passe o saldo do usuário logado; se não tiver, deixa 0
}) {
  // Inputs SEM formatação automática (string crua)
  const [creditInput, setCreditInput] = React.useState(String(creditPriceDefault));
  const [pixInput, setPixInput] = React.useState(String(pixPriceDefault));
  const [giftBalanceInput, setGiftBalanceInput] = React.useState(String(giftBalanceDefault));
  const [giftUseInput, setGiftUseInput] = React.useState(String(Math.min(giftBalanceDefault, 800)));
  const [mode, setMode] = React.useState("both"); // "both" | "pix" | "credit"

  // Valores numéricos derivados (não alteram o que o usuário digitou)
  const creditPrice = parseBRL(creditInput);
  const pixPrice = parseBRL(pixInput);
  const giftBalance = parseBRL(giftBalanceInput);

  // Valor aplicado (cálculo clamped para não passar do saldo)
  const giftUse = clamp(parseBRL(giftUseInput), 0, Math.max(0, giftBalance));

  const rule = findRuleForGiftUse(giftUse);
  const minTxt = rule
    ? `Para usar ${brl(giftUse)}, a compra deve ser superior a ${brl(rule.minPurchase)}.`
    : "";

  // Crédito
  const eligibleCredit = !!rule && creditPrice >= rule.minPurchase && giftUse > 0;
  const finalCredit = eligibleCredit ? creditPrice - giftUse : creditPrice;
  const monthly12 = finalCredit / 12;

  // Pix
  const eligiblePix = !!rule && pixPrice >= rule.minPurchase && giftUse > 0;
  const finalPix = eligiblePix ? pixPrice - giftUse : pixPrice;

  const gapWarning =
    giftUse > 0 && !rule
      ? "O valor aplicado não se encaixa em nenhuma faixa da tabela. Ajuste para uma das faixas."
      : null;

  return (
    <Card elevation={6} sx={{ borderRadius: 3 }}>
      <CardHeader
        title="💳 Simulador de Uso do Cartão Presente"
        // subheader removido conforme solicitado
        sx={{ pb: 0 }}
      />
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={mode}
              onChange={(_, v) => v && setMode(v)}
            >
              <ToggleButton value="both">PIX & CRÉDITO</ToggleButton>
              <ToggleButton value="pix">SOMENTE PIX</ToggleButton>
              <ToggleButton value="credit">SOMENTE CRÉDITO</ToggleButton>
            </ToggleButtonGroup>
          </Grid>

          <Grid item xs={12} md={4}>
            <Stack spacing={2}>
              <TextField
                label="Preço no CRÉDITO"
                value={creditInput}
                onChange={(e) => setCreditInput(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                  inputMode: "decimal",
                }}
                placeholder="6799.99 ou 6.799,99"
                fullWidth
              />

              <TextField
                label="Preço à vista (PIX)"
                value={pixInput}
                onChange={(e) => setPixInput(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                  inputMode: "decimal",
                }}
                placeholder="5779.99 ou 5.779,99"
                fullWidth
              />

              <Divider />

              <TextField
                label="Saldo do Cartão Presente"
                value={giftBalanceInput}
                onChange={(e) => setGiftBalanceInput(e.target.value)}
                InputProps={{
                  startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                  inputMode: "decimal",
                }}
                helperText="Saldo total disponível."
                placeholder="0"
                fullWidth
              />

              <Stack direction="row" spacing={1} alignItems="center">
                <TextField
                  label="Quanto deseja usar AGORA"
                  value={giftUseInput}
                  onChange={(e) => setGiftUseInput(e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                    inputMode: "decimal",
                  }}
                  placeholder="Ex.: 800"
                  fullWidth
                />
                <Button
                  variant="outlined"
                  onClick={() => setGiftUseInput(String(giftBalance))}
                >
                  Máx
                </Button>
              </Stack>

              {gapWarning && <Alert severity="warning">{gapWarning}</Alert>}

              {rule && (
                <Alert severity="info">
                  {minTxt}{" "}
                  <Tooltip title="Regra aplicada conforme a tabela do anexo">
                    <Chip size="small" label={`${brl(rule.min)} – ${brl(rule.max)}`} />
                  </Tooltip>
                </Alert>
              )}
            </Stack>
          </Grid>

          <Grid item xs={12} md={8}>
            <Stack spacing={2}>
              {(mode === "both" || mode === "credit") && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="h6">Compra no CRÉDITO</Typography>
                  <Typography>
                    Valor no crédito: <b>{brl(creditPrice)}</b>
                  </Typography>
                  <Typography sx={{ mt: 0.5 }}>
                    {eligibleCredit ? (
                      <>→ Pode usar <b>{brl(giftUse)}</b> do cartão presente</>
                    ) : rule ? (
                      <>
                        → Para aplicar <b>{brl(giftUse)}</b>, a compra deve ser &gt;{" "}
                        <b>{brl(rule.minPurchase)}</b>
                      </>
                    ) : (
                      <>→ Defina um valor aplicado que caia em uma faixa da tabela</>
                    )}
                  </Typography>
                  <Typography sx={{ mt: 0.5 }}>
                    → Valor final: <b>{brl(finalCredit)}</b>{" "}
                    <Typography component="span" sx={{ opacity: 0.8 }}>
                      (em até 12x de {brl(monthly12)} sem juros)
                    </Typography>
                  </Typography>
                </Box>
              )}

              {(mode === "both" || mode === "pix") && (
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="h6">À vista (Pix)</Typography>
                  <Typography>
                    Valor à vista (Pix): <b>{brl(pixPrice)}</b>
                  </Typography>
                  <Typography sx={{ mt: 0.5 }}>
                    {eligiblePix ? (
                      <>→ Pode aplicar <b>{brl(giftUse)}</b> do cartão presente</>
                    ) : rule ? (
                      <>
                        → Para aplicar <b>{brl(giftUse)}</b>, a compra deve ser &gt;{" "}
                        <b>{brl(rule.minPurchase)}</b>
                      </>
                    ) : (
                      <>→ Defina um valor aplicado que caia em uma faixa da tabela</>
                    )}
                  </Typography>
                  <Typography sx={{ mt: 0.5 }}>
                    → Valor final: <b>{brl(finalPix)}</b>
                  </Typography>
                </Box>
              )}

              <Divider />

              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardHeader title="Tabela para Utilização do Cartão Presente" />
                <CardContent sx={{ pt: 0 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>
                          <b>Cartão Presente (valor aplicado)</b>
                        </TableCell>
                        <TableCell align="right">
                          <b>Compra deve ser &gt; que</b>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {GIFT_RULES.map((r) => (
                        <TableRow
                          key={`${r.min}-${r.max}`}
                          selected={rule && r.min === rule.min && r.max === rule.max}
                        >
                          <TableCell>
                            {brl(r.min)} até {brl(r.max)}
                          </TableCell>
                          <TableCell align="right">{brl(r.minPurchase)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Typography variant="caption" sx={{ display: "block", mt: 1.5, opacity: 0.8 }}>
                    Importante: o desconto/condição acompanha a forma de pagamento.
                  </Typography>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
