// src/AutoPaySection.jsx
import * as React from "react";
import {
  Paper,
  Stack,
  Typography,
  Switch,
  Chip,
  Button,
  TextField,
  Divider,
  Box,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import AutorenewRoundedIcon from "@mui/icons-material/AutorenewRounded";
import ClearRoundedIcon from "@mui/icons-material/ClearRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { authHeaders as _authHeaders } from "./lib/api";
import {
  tokenizeCardWithVindi,
  setupAutopayVindi,
  getAutopayVindiStatus,
} from "./services/autopayVindi";

const apiJoin = (p) => {
  const base =
    process.env.REACT_APP_API_BASE_URL ||
    process.env.REACT_APP_API_BASE ||
    "/api";
  return `${String(base).replace(/\/+$/, "")}${p.startsWith("/") ? p : `/${p}`}`;
};

const defaultAuthHeaders = () => {
  const tk =
    localStorage.getItem("ns_auth_token") ||
    sessionStorage.getItem("ns_auth_token") ||
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token");
  return tk
    ? { Authorization: `Bearer ${String(tk).replace(/^Bearer\s+/i, "")}` }
    : {};
};

const authHeaders = _authHeaders || defaultAuthHeaders;

const pad2 = (n) => String(n).padStart(2, "0");
const onlyDigits = (s) => String(s || "").replace(/\D+/g, "");

function parseExpiry(exp) {
  const d = onlyDigits(exp);
  if (d.length < 4) return { mm: "", yyyy: "" };
  const mm = d.slice(0, 2);
  let yy = d.slice(2);
  let yyyy = yy.length === 2 ? `20${yy}` : yy.slice(0, 4);
  return { mm, yyyy };
}

// Função removida: loadMpSdkOnce (não mais necessária com Vindi)

export default function AutoPaySection() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [active, setActive] = React.useState(true);
  const [savedActive, setSavedActive] = React.useState(true);

  const [numbers, setNumbers] = React.useState([]);
  const [savedNumbers, setSavedNumbers] = React.useState([]);

  const [card, setCard] = React.useState({
    brand: null,
    last4: null,
    has_card: false,
  });

  const [holder, setHolder] = React.useState("");
  const [savedHolder, setSavedHolder] = React.useState("");

  // ✅ correção: hook correto
  const [doc, setDoc] = React.useState("");
  const [savedDoc, setSavedDoc] = React.useState("");

  const [cardNumber, setCardNumber] = React.useState("");
  const [expiry, setExpiry] = React.useState("");
  const [cvv, setCvv] = React.useState("");

  const needsAtLeastOne = numbers.length === 0;

  const numbersDirty = React.useMemo(() => {
    if (!Array.isArray(numbers) || !Array.isArray(savedNumbers)) return false;
    if (numbers.length !== savedNumbers.length) return true;
    const a = [...numbers].sort((x, y) => x - y).join(",");
    const b = [...savedNumbers].sort((x, y) => x - y).join(",");
    return a !== b;
  }, [numbers, savedNumbers]);

  const activeDirty = active !== savedActive;
  const holderDirty = (holder || "") !== (savedHolder || "");
  const docDirty = (doc || "") !== (savedDoc || "");
  const cardFieldsDirty = !!(cardNumber || expiry || cvv);

  const anyDirty =
    numbersDirty || activeDirty || holderDirty || docDirty || cardFieldsDirty;
  const canSave = !loading && !saving && !needsAtLeastOne && anyDirty;

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        // Usa o novo endpoint Vindi para buscar status
        const j = await getAutopayVindiStatus();
        if (alive && j) {
          const gotNumbers = Array.isArray(j.numbers)
            ? j.numbers.map(Number)
            : [];
          setActive(!!j.active);
          setSavedActive(!!j.active);
          setNumbers(gotNumbers);
          setSavedNumbers(gotNumbers);
          setCard({
            brand: j.card?.brand || j.brand || null,
            last4: j.card?.last4 || j.last4 || null,
            has_card: !!(j.card?.last4 || j.last4 || j.card?.has_card || j.has_card),
          });
          // Só atualiza holder/doc se vierem do backend
          // Se não vierem, mantém o estado atual (vazio ou já digitado)
          if (j.holder_name || j.card?.holder_name) {
            const h = j.holder_name || j.card?.holder_name || "";
            setHolder(h);
            setSavedHolder(h);
          }
          if (j.doc_number) {
            setDoc(j.doc_number);
            setSavedDoc(j.doc_number);
          }
        }
      } catch (e) {
        console.error("[autopay] GET error:", e?.message || e);
        // Se falhar, assume estado vazio (autopay não configurado)
        if (alive) {
          setActive(false);
          setSavedActive(false);
          setNumbers([]);
          setSavedNumbers([]);
          setCard({ brand: null, last4: null, has_card: false });
          // Não zera holder/doc para não perder dados já digitados
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function toggle(n) {
    setNumbers((prev) =>
      prev.includes(n)
        ? prev.filter((x) => x !== n)
        : [...prev, n].slice(0, 20)
    );
  }

  // Tokenização via Vindi
  async function createVindiGatewayToken() {
    const num = onlyDigits(cardNumber);
    const { mm, yyyy } = parseExpiry(expiry);
    const sc = onlyDigits(cvv).slice(0, 4);
    const holderName = (holder || "").trim();
    const docDigits = onlyDigits(doc);

    if (!num || !mm || !yyyy || !sc || !holderName) {
      throw new Error("Dados do cartão incompletos.");
    }

    return await tokenizeCardWithVindi({
      holderName,
      cardNumber: num,
      expMonth: mm,
      expYear: yyyy,
      cvv: sc,
      documentNumber: docDigits || undefined,
    });
  }

  async function save() {
    if (needsAtLeastOne) {
      alert("Selecione pelo menos 1 número para salvar as preferências.");
      return;
    }

    // Valida holder_name antes de prosseguir
    const holderName = (holder || "").trim();
    if (!holderName) {
      alert("Por favor, informe o nome impresso no cartão.");
      return;
    }

    setSaving(true);
    try {
      // Se há atualização de cartão, tokeniza via Vindi primeiro
      let gatewayToken = null;
      if (cardFieldsDirty) {
        gatewayToken = await createVindiGatewayToken();
      }

      // Sempre chama setupAutopayVindi para persistir preferências
      // Se não houver gatewayToken mas houver mudanças, tenta salvar mesmo assim
      try {
        const result = await setupAutopayVindi({
          gatewayToken: gatewayToken || undefined, // undefined se não houver
          holderName,
          docNumber: doc,
          numbers,
          active,
        });

        // Atualiza estado do cartão se retornado
        if (result.card) {
          setCard({
            brand: result.card.brand || null,
            last4: result.card.last4 || null,
            has_card: !!(result.card.last4 || result.card.brand),
          });
        }

        // Limpa campos do cartão após tokenizar (só se houve tokenização)
        if (gatewayToken) {
          setCardNumber("");
          setExpiry("");
          setCvv("");
        }

        // Atualiza estados salvos
        setSavedNumbers([...numbers]);
        setSavedActive(active);
        setSavedHolder(holderName);
        setSavedDoc(doc);

        alert("Preferências salvas!");
      } catch (setupError) {
        // Se o erro for porque gateway_token é obrigatório
        if (
          setupError?.message === "GATEWAY_TOKEN_REQUIRED" ||
          (setupError?.status === 400 &&
            !gatewayToken &&
            String(setupError?.message || "")
              .toLowerCase()
              .includes("gateway"))
        ) {
          alert(
            "Para ativar ou alterar preferências, você precisa salvar o cartão novamente. Por favor, preencha os dados do cartão e tente novamente."
          );
          return;
        }
        throw setupError;
      }

      // Recarrega status para garantir sincronização
      try {
        const status = await getAutopayVindiStatus();
        if (status.card) {
          setCard({
            brand: status.card.brand || null,
            last4: status.card.last4 || null,
            has_card: !!(status.card.last4 || status.card.brand),
          });
        }
        if (status.numbers) {
          const gotNumbers = Array.isArray(status.numbers)
            ? status.numbers.map(Number)
            : [];
          setNumbers(gotNumbers);
          setSavedNumbers(gotNumbers);
        }
        if (typeof status.active === "boolean") {
          setActive(status.active);
          setSavedActive(status.active);
        }
        // Atualiza holder/doc se vierem do status
        if (status.holder_name || status.card?.holder_name) {
          const h = status.holder_name || status.card?.holder_name || "";
          setHolder(h);
          setSavedHolder(h);
        }
        if (status.doc_number) {
          setDoc(status.doc_number);
          setSavedDoc(status.doc_number);
        }
      } catch (e) {
        console.warn("[autopay] refresh status error:", e);
      }
    } catch (e) {
      console.error("[autopay] save error:", e?.message || e);
      alert(
        e?.message || "Falha ao salvar preferências. Verifique os dados do cartão."
      );
    } finally {
      setSaving(false);
    }
  }

  async function cancelAutopay() {
    if (
      !window.confirm(
        "Tem certeza que deseja cancelar a compra automática? Isso apagará os números cativos e o cartão salvo."
      )
    )
      return;
    setSaving(true);
    try {
      // Tenta o endpoint Vindi primeiro, depois fallback para o antigo
      let r = await fetch(apiJoin("/api/autopay/vindi/cancel"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
      });
      
      // Se não existir, tenta o endpoint antigo
      if (!r.ok && r.status === 404) {
        r = await fetch(apiJoin("/api/me/autopay/cancel"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          credentials: "include",
        });
      }

      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error || "cancel_failed");
      }

      setActive(false);
      setSavedActive(false);
      setNumbers([]);
      setSavedNumbers([]);
      setCard({ brand: null, last4: null, has_card: false });
      setCardNumber("");
      setExpiry("");
      setCvv("");
      alert("Compra automática cancelada.");
    } catch (e) {
      console.error("[autopay] cancel error:", e?.message || e);
      alert("Não foi possível cancelar agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2}>
        {/* Cabeçalho */}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="h6" fontWeight={900}>
            Compra automática (cartão)
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ opacity: 0.8 }}>
              Ativar
            </Typography>
            <Switch
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
          </Stack>
        </Stack>

        {/* Texto explicativo */}
        <Typography variant="body2" sx={{ opacity: 0.8, mt: -1 }}>
          Cadastre seu cartão e escolha números "cativos". Quando um novo sorteio
          abrir, cobraremos automaticamente e reservaremos seus números
          (cobrança automática).
          <br />
          <span style={{ opacity: 0.75 }}>
            O CVV e a validade são exigidos apenas para salvar/atualizar o
            cartão.
          </span>
        </Typography>

        {/* Cartão salvo */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            p: 1.25,
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 2.5,
            bgcolor: "rgba(255,255,255,.03)",
          }}
        >
          <CreditCardIcon sx={{ opacity: 0.9 }} />
          <Typography sx={{ fontWeight: 800 }}>
            {card.has_card
              ? `${card.brand || "Cartão"} •••• ${card.last4}`
              : "Nenhum cartão salvo"}
          </Typography>
        </Box>

        {/* Form do cartão */}
        <Stack spacing={1}>
          <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
            Atualizar cartão (opcional)
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              label="Número do cartão"
              inputMode="numeric"
              value={cardNumber}
              onChange={(e) =>
                setCardNumber(onlyDigits(e.target.value).slice(0, 19))
              }
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

        {/* Números cativos */}
        <Typography variant="subtitle2" sx={{ opacity: 0.85 }}>
          Números cativos (clique para selecionar)
        </Typography>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(6, 1fr)",
              sm: "repeat(10, 1fr)",
              md: "repeat(12, 1fr)",
            },
            gap: 0.6,
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
                    fontWeight: 800,
                    borderRadius: 999,
                    border: on
                      ? "1px solid #9BD1FF"
                      : "1px solid rgba(255,255,255,.14)",
                    bgcolor: on
                      ? "rgba(155,209,255,.15)"
                      : "rgba(255,255,255,.04)",
                    color: on ? "#D6EBFF" : "inherit",
                    "&:hover": {
                      bgcolor: on
                        ? "rgba(155,209,255,.25)"
                        : "rgba(255,255,255,.08)",
                    },
                  }}
                />
              </Tooltip>
            );
          })}
        </Box>

        {/* Ações */}
        <Stack
          direction="row"
          spacing={1}
          justifyContent="space-between"
          alignItems="center"
        >
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ opacity: needsAtLeastOne ? 0.95 : 0.6 }}
          >
            <InfoOutlinedIcon fontSize="small" />
            <Typography variant="body2">
              Selecione <b>pelo menos 1 número</b> para salvar.
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="error"
              startIcon={<ClearRoundedIcon />}
              onClick={cancelAutopay}
              disabled={saving || loading}
            >
              Cancelar compra automática
            </Button>

            <Button
              variant="contained"
              startIcon={
                saving ? <CircularProgress size={16} /> : <AutorenewRoundedIcon />
              }
              onClick={save}
              disabled={!canSave}
            >
              {saving ? "Salvando…" : "Salvar preferências"}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
