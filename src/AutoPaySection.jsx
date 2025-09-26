// src/AutoPaySection.jsx
import * as React from "react";
import {
  Paper, Stack, Typography, Switch, Chip, Button, TextField, Divider, Box, Tooltip
} from "@mui/material";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import { apiJoin, authHeaders, getJSON } from "./lib/api";

const pad2 = (n) => String(n).padStart(2, "0");

export default function AutoPaySection() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving]   = React.useState(false);
  const [active, setActive]   = React.useState(true);
  const [numbers, setNumbers] = React.useState([]);
  const [card, setCard]       = React.useState({ brand: null, last4: null, has_card: false });
  const [holder, setHolder]   = React.useState("");
  const [doc, setDoc]         = React.useState("");
  const [cardToken, setCardToken] = React.useState(""); // recebido do Bricks/SDK

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
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n].slice(0, 20) // limite opcional
    );
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
      if (cardToken.trim()) body.card_token = cardToken.trim();
      const r = await fetch(apiJoin("/api/me/autopay"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "save_failed");
      setCard(j.card || { has_card: false });
      if (j.card?.has_card) setCardToken(""); // limpamos
      alert("Preferências salvas!");
    } catch (e) {
      alert("Falha ao salvar. Verifique os dados do cartão e tente novamente.");
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

        {/* Token do cartão (MP Bricks) */}
        <Stack spacing={1}>
          <Typography variant="subtitle2" sx={{ opacity: .85 }}>
            Atualizar cartão (opcional)
          </Typography>
          <Typography variant="caption" sx={{ opacity: .7, mb: .5 }}>
            <strong>Numero Cartão</strong> 
          </Typography>
          <TextField
            label="Numero Cartão"
            placeholder="ex.: 9d4b6e3e-...."
            value={cardToken}
            onChange={(e) => setCardToken(e.target.value)}
            fullWidth
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="Nome impresso no cartão"
              value={holder}
              onChange={(e) => setHolder(e.target.value)}
              fullWidth
            />
            <TextField
              label="CPF/CNPJ do titular"
              value={doc}
              onChange={(e) => setDoc(e.target.value)}
              fullWidth
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
