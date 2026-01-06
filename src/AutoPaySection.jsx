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

// Hoisted (function declaration) para evitar qualquer risco de TDZ em builds/minificação.
function cleanHolderName(name) {
  const s = String(name || "").trim();
  return s ? s : undefined;
}

function cleanDocNumber(doc) {
  const s = String(doc || "").trim();
  const digits = s ? s.replace(/\D+/g, "") : "";
  return digits ? digits : undefined;
}

function parseExpiry(exp) {
  // Aceita MM/AA ou MM/AAAA
  const str = String(exp || "").trim();
  // Remove tudo exceto dígitos
  const d = str.replace(/\D+/g, "");
  if (d.length < 4) return { mm: "", yyyy: "", valid: false };
  
  const mm = d.slice(0, 2);
  let yy = d.slice(2);
  // Se tem 2 dígitos, assume 20AA; se tem 4, usa como está
  let yyyy = yy.length === 2 ? `20${yy}` : yy.slice(0, 4);
  
  // Valida mês (01-12)
  const monthNum = parseInt(mm, 10);
  // Valida: mês entre 1-12, ano tem 4 dígitos, ano >= 2020
  const yearNum = parseInt(yyyy, 10);
  const valid = monthNum >= 1 && monthNum <= 12 && 
                yyyy.length === 4 && 
                yearNum >= 2020 && 
                yearNum <= 2099;
  
  return { mm, yyyy, valid };
}

// Função removida: loadMpSdkOnce (não mais necessária com Vindi)

export default function AutoPaySection() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const redirectingToLoginRef = React.useRef(false);

  const handleSessionExpired = React.useCallback(() => {
    if (redirectingToLoginRef.current) return;
    redirectingToLoginRef.current = true;
    alert("Sessão expirada, faça login novamente.");
    window.location.assign("/login");
  }, []);

  const handleVindiFriendlyError = React.useCallback((err) => {
    const code = String(err?.code || "").toLowerCase();
    if (code === "vindi_not_configured" || code === "vindi_error") {
      console.error("[autopay] Erro Vindi:", err);
      alert(
        "No momento não foi possível configurar o pagamento automático. Tente novamente mais tarde ou fale com o suporte."
      );
      return true;
    }
    return false;
  }, []);

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
  const holderDirty = (holder || "").trim() !== (savedHolder || "").trim();
  const docDirty = (doc || "") !== (savedDoc || "");
  const cardFieldsDirty = !!(cardNumber || expiry || cvv);

  // anyDirty: considera mudanças em números, active, holder, doc ou cartão
  // Se usuário digitou cartão OU mudou holder OU mudou números/active/doc, habilita botão
  const anyDirty =
    numbersDirty || activeDirty || holderDirty || docDirty || cardFieldsDirty;
  
  // canSave: habilita se não está carregando/salvando, tem pelo menos 1 número e há mudanças
  const canSave = !loading && !saving && !needsAtLeastOne && anyDirty;
  
  // Diagnóstico: qual condição está impedindo o save
  const saveBlockedReason = React.useMemo(() => {
    if (loading) return "Carregando dados...";
    if (saving) return "Salvando...";
    if (needsAtLeastOne) return "Selecione ao menos 1 número";
    if (!anyDirty) return "Nenhuma alteração detectada";
    return null; // Pode salvar
  }, [loading, saving, needsAtLeastOne, anyDirty]);

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
        if (e?.status === 401 || e?.code === "SESSION_EXPIRED") {
          if (alive) handleSessionExpired();
          return;
        }
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

  // Tokenização via backend (endpoint /api/autopay/vindi/tokenize)
  async function createVindiGatewayToken() {
    console.debug("[autopay] Tokenize start");
    
    const num = onlyDigits(cardNumber);
    const expiryParsed = parseExpiry(expiry);
    const { mm, yyyy, valid: expiryValid } = expiryParsed;
    const sc = onlyDigits(cvv).slice(0, 4);
    const holderName = (holder || "").trim();
    const docDigits = onlyDigits(doc);

    // Validação: garante formato correto
    if (!num || num.length < 13) {
      throw new Error("Número do cartão inválido.");
    }
    
    // Valida parse e formato de validade
    if (!mm || mm.length !== 2 || !yyyy || yyyy.length !== 4 || !expiryValid) {
      const monthNum = parseInt(mm, 10);
      if (!expiryValid && monthNum >= 1 && monthNum <= 12) {
        throw new Error("Ano de validade inválido. Use MM/AA ou MM/AAAA.");
      }
      throw new Error("Data de validade inválida. Use MM/AA ou MM/AAAA (mês deve ser 01-12).");
    }
    
    if (!sc || sc.length < 3) {
      throw new Error("CVV inválido.");
    }
    if (!holderName) {
      throw new Error("Nome do titular é obrigatório.");
    }
    
    // Validação obrigatória de CPF/CNPJ
    if (!docDigits || (docDigits.length !== 11 && docDigits.length !== 14)) {
      throw new Error("CPF/CNPJ é obrigatório. Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).");
    }

    console.debug("[autopay] Tokenize calling backend", {
      has_card_number: !!num,
      has_expiry: !!mm && !!yyyy,
      has_cvv: !!sc,
      has_holder: !!holderName,
      has_doc: !!docDigits,
    });

    try {
      const result = await tokenizeCardWithVindi({
        holderName,
        cardNumber: num,
        expMonth: mm,  // Formato MM
        expYear: yyyy, // Formato YYYY
        cvv: sc,       // Apenas dígitos
        documentNumber: docDigits,
      });
      console.debug("[autopay] Tokenize end - success");
      return result;
    } catch (error) {
      console.debug("[autopay] Tokenize end - error:", error?.message || error);
      throw error;
    }
  }

  async function save() {
    // Instrumentação: logs de diagnóstico
    const holderNameFilled = !!(holder || "").trim();
    const docFilled = !!(doc || "");
    const expiryParsed = parseExpiry(expiry);
    const expiryParsedOk = expiryParsed.valid;
    
    console.debug("[autopay] save() called", {
      needsAtLeastOne,
      anyDirty,
      cardFieldsDirty,
      holderNameFilled,
      docFilled,
      expiryParsedOk,
      has_cardNumber: !!(cardNumber || ""),
      has_expiry: !!(expiry || ""),
      has_cvv: !!(cvv || ""),
      numbers_count: numbers.length,
    });

    if (needsAtLeastOne) {
      alert("Selecione pelo menos 1 número para salvar as preferências.");
      return;
    }

    const holderName = (holder || "").trim();
    const hasSavedCard = !!card.has_card;
    const needsTokenize = cardFieldsDirty || (active && !hasSavedCard);

    // Só exige holder quando realmente precisar tokenizar/ativar sem cartão salvo
    if (needsTokenize && !holderName) {
      alert("Por favor, informe o nome impresso no cartão.");
      return;
    }

    setSaving(true);
    try {
      // Se há atualização de cartão ou precisa ativar sem cartão salvo, tokeniza via backend
      let tokenizeResult = null;
      let paymentProfileId = null;
      let customerId = null;
      let cardLast4 = null;
      let paymentCompanyCode = null;
      let gatewayToken = null; // fallback modo antigo
      if (needsTokenize) {
        console.debug("[autopay] Will call tokenize", {
          has_card_number: !!(cardNumber || ""),
          has_cvv: !!(cvv || ""),
        });
        try {
          tokenizeResult = await createVindiGatewayToken();
          paymentProfileId = tokenizeResult?.payment_profile_id || null;
          customerId = tokenizeResult?.customer_id || null;
          cardLast4 = tokenizeResult?.card_last4 || onlyDigits(cardNumber).slice(-4) || null;
          paymentCompanyCode = tokenizeResult?.payment_company_code || null;
          gatewayToken = tokenizeResult?.gateway_token || null;

          console.debug("[autopay] Tokenize OK", {
            has_payment_profile_id: !!paymentProfileId,
            has_customer_id: !!customerId,
            card_last4: cardLast4,
            payment_company_code: paymentCompanyCode,
            has_gateway_token: !!gatewayToken,
          });

          // Feedback imediato (sem exigir bandeira do usuário)
          if (cardLast4 || paymentCompanyCode) {
            setCard({
              brand: paymentCompanyCode || card.brand || null,
              last4: cardLast4 || card.last4 || null,
              has_card: true,
            });
          }
        } catch (tokenizeError) {
          if (tokenizeError?.status === 401 || tokenizeError?.code === "SESSION_EXPIRED") {
            handleSessionExpired();
            return;
          }
          if (handleVindiFriendlyError(tokenizeError)) return;

          // Mensagem formatada do backend
          const errorMessage = tokenizeError?.message || "Falha ao tokenizar cartão.";
          console.error("[autopay] Tokenize error:", tokenizeError);
          alert(errorMessage);
          return;
        }
      }

      // Sempre chama setupAutopayVindi para persistir preferências
      // Se não houver gatewayToken mas houver mudanças, tenta salvar mesmo assim
      try {
        const cleanedHolderName = cleanHolderName(holderName);
        const cleanedDocNumber = cleanDocNumber(doc);
        
        const result = await setupAutopayVindi({
          paymentProfileId: paymentProfileId || undefined, // modo novo
          gatewayToken: gatewayToken || undefined, // fallback modo antigo
          holderName: cleanedHolderName,
          docNumber: cleanedDocNumber,
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
        if (tokenizeResult) {
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
        if (setupError?.status === 401 || setupError?.code === "SESSION_EXPIRED") {
          handleSessionExpired();
          return;
        }
        if (handleVindiFriendlyError(setupError)) return;

        // Se o erro for porque gateway_token é obrigatório
        if (
          setupError?.message === "GATEWAY_TOKEN_REQUIRED" ||
          (setupError?.status === 400 &&
            !paymentProfileId &&
            !gatewayToken &&
            String(setupError?.message || "")
              .toLowerCase()
              .includes("gateway"))
        ) {
          alert(
            "Para ativar o AutoPay pela primeira vez, cadastre o cartão."
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
        if (e?.status === 401 || e?.code === "SESSION_EXPIRED") {
          handleSessionExpired();
          return;
        }
        console.warn("[autopay] refresh status error:", e);
      }
    } catch (e) {
      if (e?.status === 401 || e?.code === "SESSION_EXPIRED") {
        handleSessionExpired();
        return;
      }
      if (handleVindiFriendlyError(e)) return;
      console.error("[autopay] save error:", e?.message || e);
      // Usa a mensagem do erro (já montada pelo service quando aplicável)
      const errorMsg = e?.message || "Falha ao salvar preferências. Verifique os dados do cartão.";
      alert(errorMsg);
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

      if (r.status === 401) {
        handleSessionExpired();
        return;
      }
      
      // Se não existir, tenta o endpoint antigo
      if (!r.ok && r.status === 404) {
        r = await fetch(apiJoin("/api/me/autopay/cancel"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          credentials: "include",
        });
      }

      if (r.status === 401) {
        handleSessionExpired();
        return;
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
              {saveBlockedReason || (
                <>
                  Selecione <b>pelo menos 1 número</b> para salvar.
                </>
              )}
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
              title={saveBlockedReason || undefined}
            >
              {saving ? "Salvando…" : "Salvar preferências"}
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
