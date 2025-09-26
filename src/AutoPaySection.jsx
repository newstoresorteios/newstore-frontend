// src/AutoPaySection.jsx
import * as React from "react";
import {
  Paper, Stack, Typography, Switch, Chip, Button, TextField, Divider, Box, Tooltip
} from "@mui/material";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import { apiJoin, authHeaders, getJSON } from "./lib/api";

const pad2 = (n) => String(n).padStart(2, "0");
const onlyDigits = (s) => String(s || "").replace(/\D+/g, "");
const guessDocType = (docDigits) => (String(docDigits || "").length > 11 ? "CNPJ" : "CPF");

// aceita "MM/AA", "MM/AAAA", "MMAA", "MMYYYY"
function parseExpiry(exp) {
  const d = onlyDigits(exp);
  if (d.length < 4) return { mm: "", yyyy: "" };
  const mm = d.slice(0, 2);
  let yy = d.slice(2);
  let yyyy = yy.length === 2 ? `20${yy}` : yy.slice(0, 4);
  return { mm, yyyy };
}

export default function AutoPaySection() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving]   = React.useState(false);
  const [active, setActive]   = React.useState(true);
  const [numbers, setNumbers] = React.useState([]);
  const [card, setCard]       = React.useState({ brand: null, last4: null, has_card: false });
  const [holder, setHolder]   = React.useState("");
  const [doc, setDoc]         = React.useState("");

  // Campos para gerar token (SDK)
  const [cardNumber, setCardNumber] = React.useState("");
  const [expiry, setExpiry]         = React.useState(""); // MM/AA
  const [cvv, setCvv]               = React.useState("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const j = await getJSON("/api/me/autopay").catch(() => null);
        if (alive && j) {
          setActive(!!j.active);
          setNumbers(Array.isArray(j.numbers) ? j.numbers : []);
          setCard({ brand: j.brand, last4: j.last4, has_card: !!(j.brand || j.last4) });
          setHolder(j.holder_name || "");
          setDoc(j.doc_number || "");
        }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  function toggle(n) {
    setNumbers((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].slice(0, 20)
    );
  }

  // Gera token via SDK do Mercado Pago (se disponível)
  async function createMpTokenOrFail() {
    const num = onlyDigits(cardNumber);
    const { mm, yyyy } = parseExpiry(expiry);
    const sc  = onlyDigits(cvv).slice(0, 4);
    const holderName = (holder || "").trim();
    const docDigits  = onlyDigits(doc);

    // valida mínimos
    if (!num || !mm || !yyyy || !sc || !holderName || !docDigits) {
      throw new Error("Dados do cartão incompletos.");
    }

    const PK =
      process.env.REACT_APP_MP_PUBLIC_KEY ||
      process.env.REACT_APP_MERCADOPAGO_PUBLIC_KEY ||
      window.MP_PUBLIC_KEY;

    if (!(window.MercadoPago && PK)) {
      throw new Error("SDK do Mercado Pago não está carregado no front-end.");
    }

    const mp = new window.MercadoPago(PK);
    if (!mp?.cardToken?.create) {
      throw new Error("Função de tokenização indisponível.");
    }

    const payload = {
      cardNumber: num,
      securityCode: sc,
      expirationMonth: mm,
      expirationYear: yyyy,
      cardholder: {
        name: holderName,
        identification: {
          type: guessDocType(docDigits),
          number: docDigits,
        },
      },
    };

    const resp = await mp.cardToken.create(payload);
    const tok = resp?.id || resp?.data?.id || resp?.token;
    if (!tok) throw new Error("Falha ao gerar token do cartão.");
    return tok;
  }

  async function save() {
    setSaving(true);
    try {
      const body = {
        active,
        numbers,
        holder_name: holder,
        doc_number: doc,
      };

      const wantsCardUpdate =
        cardNumber || expiry || cvv || holder || doc;

      if (wantsCardUpdate && (cardNumber || expiry || cvv)) {
        // Se qualquer campo de cartão foi preenchido, precisamos tokenizar
        const token = await createMpTokenOrFail();
        body.card_token = token;
      }

      const r = await fetch(apiJoin("/api/me/autopay"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "save_failed");

      setCard(j.card || { has_card: false });
      if (j.card?.has_card) {
        // limpa campos sensíveis
        setCardNumber("");
        setExpiry("");
        setCvv("");
      }
      alert("Preferências salvas!");
    } catch (e) {
      alert(e?.message || "Falha ao salvar. Verifique os dados do cartão e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" fontWeight={900}>
            Compra automática (cartão)
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ opacity: .8 }}>Ativar</Typography>
            <Switch checked={active} onChange={(e) => setActive(e.target.checked)} />
          </Stack>
        </Stack>

        <Typography variant="body2" sx={{ opacity: .8, mt: -1 }}>
          Cadastre seu cartão e escolha números “cativos”. Quando um novo sorteio abrir,
          cobraremos automaticamente e reservaremos seus números (pagamento via Mercado Pago).
          <br />
          <span style={{ opacity: .75 }}>
            O CVV e a validade são exigidos apenas para salvar/atualizar o cartão.
          </span>
        </Typography>

        {/* Cartão salvo */}
        <Box
          sx={{
            display: "flex", alignItems: "center", gap: 1,
            p: 1.25, border: "1px solid rgba(255,255,255,.08)", borderRadius: 2.5,
            bgcolor: "rgba(255,255,255,.03)"
          }}
        >
          <CreditCardIcon sx={{ opacity: .9 }} />
          <Typography sx={{ fontWeight: 800 }}>
            {card.has_card ? `${card.brand || "Cartão"} •••• ${card.last4}` : "Nenhum cartão salvo"}
          </Typography>
        </Box>

        {/* Atualizar/Salvar cartão (sem exibir token) */}
        <Stack spacing={1}>
          <Typography variant="subtitle2" sx={{ opacity: .85 }}>
            Atualizar cartão (opcional)
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="Número do cartão"
              inputMode="numeric"
              value={cardNumber}
              onChange={(e) => setCardNumber(onlyDigits(e.target.value).slice(0, 19))}
              fullWidth
            />
            <TextField
              label="Nome impresso no cartão"
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              fullWidth
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="CPF/CNPJ do titular"
              value={doc}
              onChange={(e) => setDoc(onlyDigits(e.target.value).slice(0, 18))}
              fullWidth
            />
            <TextField
              label="Validade (MM/AA)"
              placeholder="ex.: 04/27"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              sx={{ maxWidth: 180 }}
            />
            <TextField
              label="CVV"
              inputMode="numeric"
              value={cvv}
              onChange={(e) => setCvv(onlyDigits(e.target.value).slice(0, 4))}
              sx={{ maxWidth: 140 }}
            />
          </Stack>
        </Stack>

        <Divider />

        {/* Escolha dos números cativos */}
        <Typography variant="subtitle2" sx={{ opacity: .85 }}>
          Números cativos (clique para selecionar)
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(6, 1fr)", sm: "repeat(10, 1fr)", md: "repeat(12, 1fr)"
            },
            gap: .6,
          }}
        >
          {Array.from({ length: 100 }, (_, i) => i).map((n) => {
            const on = numbers.includes(n);
            return (
              <Tooltip key={n} title={on ? "Remover" : "Adicionar"} arrow>
                <Chip
                  label={pad2(n)}
                  onClick={() => toggle(n)}
                  clickable
                  sx={{
                    fontWeight: 800, borderRadius: 999,
                    border: on ? "1px solid #9BD1FF" : "1px solid rgba(255,255,255,.14)",
                    bgcolor: on ? "rgba(155,209,255,.15)" : "rgba(255,255,255,.04)",
                    color: on ? "#D6EBFF" : "inherit",
                    "&:hover": { bgcolor: on ? "rgba(155,209,255,.25)" : "rgba(255,255,255,.08)" }
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>

        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button
            variant="contained"
            startIcon={<AutorenewRoundedIcon />}
            onClick={save}
            disabled={saving || loading}
          >
            {saving ? "Salvando…" : "Salvar preferências"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
