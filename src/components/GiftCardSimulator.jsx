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
  Select,
  MenuItem,
} from "@mui/material";

/* ===================== Helpers ===================== */
const brl = (v) =>
  (Number.isFinite(v) ? v : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

/** Mantém só dígitos e UMA vírgula; sem ponto; 2 casas no máximo (não força). */
function sanitizeCommaMoney(str) {
  let s = String(str ?? "");
  s = s.replace(/\./g, "");            // remove pontos
  s = s.replace(/[^\d,]/g, "");        // mantém dígitos e vírgula
  const parts = s.split(",");
  if (parts.length > 2) s = `${parts[0]},${parts.slice(1).join("")}`;
  const [intPart, decRaw = ""] = s.split(",");
  const decPart = decRaw.slice(0, 2);
  return decPart.length ? `${intPart},${decPart}` : intPart;
}

/** Força sempre vírgula e DUAS casas. */
function forceTwoDecimalsComma(str) {
  let s = sanitizeCommaMoney(str);
  if (!s) return "0,00";
  let [intPart, decPart = ""] = s.split(",");
  if (!intPart) intPart = "0";
  if (decPart.length === 0) decPart = "00";
  else if (decPart.length === 1) decPart = `${decPart}0`;
  else decPart = decPart.slice(0, 2);
  return `${intPart},${decPart}`;
}

/** Converte string com vírgula para número JS. */
function parseCommaMoney(str) {
  const s = sanitizeCommaMoney(str);
  if (!s) return 0;
  const [intPart, decPart = ""] = s.split(",");
  const n = Number(`${intPart}.${decPart}`);
  return Number.isFinite(n) ? n : 0;
}

/** Normaliza QUALQUER default (número | "6.799,99" | "6799.99") para "####,##". */
function normalizeDefaultToComma2(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return forceTwoDecimalsComma(String(value.toFixed(2)).replace(".", ","));
  }
  let s = String(value ?? "").trim();
  if (!s) return "0,00";

  // Se já tem vírgula, só força 2 casas
  if (s.includes(",")) return forceTwoDecimalsComma(s);

  // Se tem ponto mas não vírgula → tratar último ponto como decimal
  if (s.includes(".") && !s.includes(",")) {
    const lastDot = s.lastIndexOf(".");
    const intPart = s.slice(0, lastDot).replace(/[^\d]/g, "");
    const decPart = s.slice(lastDot + 1).replace(/[^\d]/g, "");
    return forceTwoDecimalsComma(`${intPart},${decPart}`);
  }

  // Só dígitos
  return forceTwoDecimalsComma(s);
}

/* ===================== Regras (anexo) ===================== */
const GIFT_RULES = [
  { min: 50, minPurchase: 1500, max: 250 },
  { min: 251, minPurchase: 3500, max: 600 },
  { min: 601, minPurchase: 5500, max: 800 },
  { min: 801, minPurchase: 7500, max: 1000 },
  { min: 1101, minPurchase: 15000, max: 2100 },
  { min: 2101, minPurchase: 22500, max: 3100 },
  { min: 3101, minPurchase: 30000, max: 4200 },
];

function findRuleForGiftUse(valueToUse) {
  return GIFT_RULES.find((r) => valueToUse >= r.min && valueToUse <= r.max) || null;
}

/* ===================== Componente ===================== */
export default function GiftCardSimulator({
  creditPriceDefault = "6.799,99",
  pixPriceDefault = "5.779,99",
  giftBalanceMax, // limite opcional (saldo do usuário)
}) {
  const [paymentMethod, setPaymentMethod] = React.useState("credit"); // 'credit' | 'pix'

  // >>> Inicialização corrigida (aceita número, pt-BR ou en-US)
  const [creditInput, setCreditInput] = React.useState(
    normalizeDefaultToComma2(creditPriceDefault)
  );
  const [pixInput, setPixInput] = React.useState(
    normalizeDefaultToComma2(pixPriceDefault)
  );
  const [giftUseInput, setGiftUseInput] = React.useState("0,00");

  // numéricos derivados
  const creditPrice = parseCommaMoney(creditInput);
  const pixPrice = parseCommaMoney(pixInput);

  // valor aplicado agora
  let giftUse = parseCommaMoney(giftUseInput);
  if (Number.isFinite(giftBalanceMax) && giftBalanceMax > 0) {
    giftUse = Math.min(giftUse, giftBalanceMax);
  }

  // preço conforme seleção
  const price = paymentMethod === "credit" ? creditPrice : pixPrice;

  // regra e calculo final
  const rule = findRuleForGiftUse(giftUse);
  const eligible = !!rule && price >= rule.minPurchase && giftUse > 0;
  const finalToPay = eligible ? price - giftUse : price;
  const monthly12 = finalToPay / 12;

  const warnOutOfBand =
    giftUse > 0 && !rule
      ? "O valor aplicado não se encaixa em nenhuma faixa da tabela. Ajuste para uma das faixas."
      : null;

  const infoMinPurchase =
    rule && !eligible
      ? `Para aplicar ${brl(giftUse)}, a compra deve ser superior a ${brl(
          rule.minPurchase
        )}.`
      : null;

  // handlers
  const handlePriceChange = (val) => {
    const s = sanitizeCommaMoney(val);
    if (paymentMethod === "credit") setCreditInput(s);
    else setPixInput(s);
  };
  const handlePriceBlur = () => {
    if (paymentMethod === "credit") setCreditInput((v) => forceTwoDecimalsComma(v));
    else setPixInput((v) => forceTwoDecimalsComma(v));
  };

  const handleGiftChange = (val) => setGiftUseInput(sanitizeCommaMoney(val));
  const handleGiftBlur = () => setGiftUseInput((v) => forceTwoDecimalsComma(v));

  return (
    <Card elevation={6} sx={{ borderRadius: 3 }}>
      <CardHeader title="💳 Simulador de Uso do Cartão Presente" sx={{ pb: 0 }} />
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Table
              size="small"
              sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: "success.light", color: "black", fontWeight: 700 }}>
                    Uso do Cartão Presente
                  </TableCell>
                  <TableCell sx={{ bgcolor: "success.light" }} />
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Forma de Pagamento</TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      fullWidth
                    >
                      <MenuItem value="credit">Crédito</MenuItem>
                      <MenuItem value="pix">Pix</MenuItem>
                    </Select>
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {paymentMethod === "credit"
                      ? "Valor do Relógio (Crédito)"
                      : "Valor do Relógio (Pix)"}
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={paymentMethod === "credit" ? creditInput : pixInput}
                      onChange={(e) => handlePriceChange(e.target.value)}
                      onBlur={handlePriceBlur}
                      inputProps={{ inputMode: "numeric", pattern: "[0-9,]*" }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">R$</InputAdornment>
                        ),
                      }}
                      placeholder={paymentMethod === "credit" ? "6799,99" : "5779,99"}
                      fullWidth
                    />
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>
                    Cartão Presente (aplicar agora)
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      value={giftUseInput}
                      onChange={(e) => handleGiftChange(e.target.value)}
                      onBlur={handleGiftBlur}
                      inputProps={{ inputMode: "numeric", pattern: "[0-9,]*" }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">R$</InputAdornment>
                        ),
                      }}
                      placeholder="0,00"
                      fullWidth
                    />
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Valor a Pagar</TableCell>
                  <TableCell>
                    <Box sx={{ fontWeight: 700 }}>{brl(finalToPay)}</Box>
                    {paymentMethod === "credit" && (
                      <Typography variant="caption" sx={{ opacity: 0.8 }}>
                        em até 12x de {brl(monthly12)} sem juros
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Grid>

          <Grid item xs={12} md={6}>
            <Stack spacing={1.5}>
              {warnOutOfBand && <Alert severity="warning">{warnOutOfBand}</Alert>}
              {infoMinPurchase && <Alert severity="info">{infoMinPurchase}</Alert>}

              <Divider />

              <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardHeader title="Tabela para Utilização do Cartão Presente" />
                <CardContent sx={{ pt: 0 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>
                          <b>Cartão Presente (aplicado agora)</b>
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
                          selected={!!rule && r.min === rule.min && r.max === rule.max}
                        >
                          <TableCell>
                            {brl(r.min)} até {brl(r.max)}
                          </TableCell>
                          <TableCell align="right">{brl(r.minPurchase)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <Typography
                    variant="caption"
                    sx={{ display: "block", mt: 1.5, opacity: 0.8 }}
                  >
                    Observação: o valor do cartão presente aplicado deve respeitar a
                    faixa e o mínimo de compra da tabela acima.
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
