// src/LojaResgatePage.jsx
//
// Fechamento do resgate por NSCréditos (/loja/resgate) — Fase 5.
//
// FRETE ESTÁ FORA DESTE ESCOPO. A equipe/Tray é responsável pelo frete —
// esta tela NUNCA cota, escolhe ou cobra frete. O endereço é coletado
// apenas porque o backend (reward_redemptions, Fase Foundation) já exige
// um address_id para localizar o resgate — não é uma etapa de entrega.
//
// Fluxo: endereço → revisão (sem frete) → confirmação (anti-duplo-clique,
// idempotency_key estável) → resultado honesto (confirmed /
// reconciliation_required / compensado/bloqueado — nunca um "falhou"
// genérico quando o backend não sabe se o pedido foi criado).

import * as React from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Radio,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import LocationOnRoundedIcon from "@mui/icons-material/LocationOnRounded";

import { useAuth } from "./authContext";
import LojaShell from "./components/rewardStore/LojaShell";
import { useCart } from "./components/rewardStore/CartContext";
import { formatNsCredits } from "./services/nscredits";
import {
  getCheckoutBootstrap,
  createAddress,
  prepareRedemption,
  confirmRedemption,
  makeIdempotencyKey,
  describeCheckoutError,
  isRewardRedemptionEnabled,
} from "./services/checkout";
import { formatShortDate } from "./components/rewardStore/StoreProfileHeader";
import { getMyProfile, updateMyBirthDate } from "./services/rewardProfile";

const EMPTY_ADDRESS_FORM = {
  recipient_name: "",
  zipcode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};

function addressLine(addr) {
  if (!addr) return "";
  return [`${addr.street}, ${addr.number}`, addr.neighborhood, `${addr.city}/${addr.state}`, addr.zipcode]
    .filter(Boolean)
    .join(" · ");
}

/* ─────────────────────────── Passo 1: endereço ─────────────────────────── */

function AddressStep({ addresses, selectedId, onSelect, onAddressCreated }) {
  const [showForm, setShowForm] = React.useState(addresses.length === 0);
  const [form, setForm] = React.useState(EMPTY_ADDRESS_FORM);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { item } = await createAddress(form);
      onAddressCreated(item);
      setShowForm(false);
      setForm(EMPTY_ADDRESS_FORM);
    } catch (err) {
      setError(describeCheckoutError(err, "Não foi possível salvar o endereço."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <LocationOnRoundedIcon sx={{ color: "primary.main" }} />
        <Typography sx={{ fontWeight: 900, fontSize: 20 }}>Endereço de entrega</Typography>
      </Stack>

      {addresses.length > 0 && (
        <Stack spacing={1.5}>
          {addresses.map((addr) => (
            <Paper
              key={addr.id}
              variant="outlined"
              onClick={() => onSelect(addr.id)}
              sx={{
                p: 2,
                borderRadius: 3,
                cursor: "pointer",
                borderColor: selectedId === addr.id ? "primary.main" : "rgba(255,255,255,0.10)",
                bgcolor: selectedId === addr.id ? "rgba(103,194,58,0.06)" : "transparent",
              }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Radio checked={selectedId === addr.id} sx={{ p: 0, mt: 0.25 }} />
                <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800 }}>{addr.recipient_name}</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    {addressLine(addr)}
                  </Typography>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      {!showForm ? (
        <Button variant="outlined" sx={{ alignSelf: "flex-start", borderRadius: 999, fontWeight: 800 }} onClick={() => setShowForm(true)}>
          ADICIONAR NOVO ENDEREÇO
        </Button>
      ) : (
        <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: "rgba(255,255,255,0.10)" }}>
          <Box component="form" onSubmit={submit}>
            <Stack spacing={1.5}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField label="Nome do destinatário" size="small" required value={form.recipient_name} onChange={set("recipient_name")} />
              <Stack direction="row" spacing={1.5}>
                <TextField label="CEP" size="small" required value={form.zipcode} onChange={set("zipcode")} sx={{ flex: 1 }} />
                <TextField label="Número" size="small" required value={form.number} onChange={set("number")} sx={{ flex: 1 }} />
              </Stack>
              <TextField label="Endereço" size="small" required value={form.street} onChange={set("street")} />
              <TextField label="Complemento" size="small" value={form.complement} onChange={set("complement")} />
              <TextField label="Bairro" size="small" required value={form.neighborhood} onChange={set("neighborhood")} />
              <Stack direction="row" spacing={1.5}>
                <TextField label="Cidade" size="small" required value={form.city} onChange={set("city")} sx={{ flex: 2 }} />
                <TextField label="UF" size="small" required value={form.state} onChange={set("state")} inputProps={{ maxLength: 2 }} sx={{ flex: 1 }} />
              </Stack>
              <Stack direction="row" spacing={1.5}>
                {addresses.length > 0 && (
                  <Button color="inherit" onClick={() => setShowForm(false)} disabled={saving}>
                    CANCELAR
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="contained"
                  disabled={saving}
                  startIcon={saving ? <CircularProgress size={16} /> : null}
                  sx={{ bgcolor: "primary.main", color: "#0E0E0E", fontWeight: 900, borderRadius: 999 }}
                >
                  SALVAR ENDEREÇO
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Paper>
      )}
    </Stack>
  );
}

/* ───────────────── Passo 0: completar perfil (se faltar dado) ───────────────── */
//
// A Tray exige birth_date pra criar o Customer (rewardProfile.js, backend).
// So aparece quando falta -- uma vez salvo, nunca mais pede de novo
// (mesmo padrao do telefone em /conta).

function ProfileCompletionStep({ onComplete }) {
  const [birthDate, setBirthDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const profile = await updateMyBirthDate(birthDate);
      onComplete(profile);
    } catch (err) {
      setError(describeCheckoutError(err, "Não foi possível salvar seus dados agora."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Typography sx={{ fontWeight: 900, fontSize: 20 }}>Complete seus dados para continuar</Typography>
      <Typography variant="body2" sx={{ opacity: 0.75 }}>
        Para criar seu pedido, precisamos apenas da sua data de nascimento. Isso é salvo no seu perfil — você não
        precisará informar de novo em resgates futuros.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, borderColor: "rgba(255,255,255,0.10)" }}>
        <Box component="form" onSubmit={submit}>
          <Stack spacing={1.5}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              label="Data de nascimento"
              type="date"
              size="small"
              required
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              disabled={saving}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} /> : null}
              sx={{ bgcolor: "primary.main", color: "#0E0E0E", fontWeight: 900, borderRadius: 999, alignSelf: "flex-start", px: 3 }}
            >
              SALVAR E CONTINUAR
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Stack>
  );
}

/* ─────────────────────────── Passo 2: revisão ─────────────────────────── */

function ReviewStep({ prepared, address, cartItemsById, confirming, onConfirm, confirmErrorMsg }) {
  return (
    <Stack spacing={2.5}>
      <Typography sx={{ fontWeight: 900, fontSize: 20 }}>Revise seu resgate</Typography>

      <Stack spacing={1.5}>
        {prepared.items.map((item) => (
          <Paper key={item.id} variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: "rgba(255,255,255,0.10)" }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              {cartItemsById[item.id]?.image_url && (
                <Box
                  component="img"
                  src={cartItemsById[item.id].image_url}
                  alt=""
                  sx={{ width: 56, height: 56, objectFit: "contain", bgcolor: "#fff", borderRadius: 1.5, flex: "0 0 56px" }}
                />
              )}
              <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800 }}>{item.name}</Typography>
                {item.variant_name && (
                  <Typography variant="caption" sx={{ opacity: 0.65 }}>
                    {item.variant_name}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ opacity: 0.65 }}>
                  Quantidade: {item.quantity}
                </Typography>
              </Stack>
              <Typography sx={{ fontWeight: 900, color: "secondary.main" }}>
                {formatNsCredits(item.nscredits_subtotal)} NSCréditos
              </Typography>
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

      <Stack spacing={0.75}>
        <Stack direction="row" justifyContent="space-between">
          <Typography sx={{ opacity: 0.75 }}>Saldo antes</Typography>
          <Typography sx={{ fontWeight: 700 }}>{formatNsCredits(prepared.coupon_balance_before)} NSCréditos</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography sx={{ opacity: 0.75 }}>Total do resgate</Typography>
          <Typography sx={{ fontWeight: 900, color: "secondary.main" }}>
            − {formatNsCredits(prepared.credits_amount)} NSCréditos
          </Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between">
          <Typography sx={{ fontWeight: 800 }}>Saldo depois</Typography>
          <Typography sx={{ fontWeight: 900 }}>{formatNsCredits(prepared.coupon_balance_after_preview)} NSCréditos</Typography>
        </Stack>
        {prepared.coupon_code && (
          <Typography variant="caption" sx={{ opacity: 0.55 }}>
            Cupom {prepared.coupon_code}
            {prepared.coupon_expires_at ? ` · válido até ${formatShortDate(prepared.coupon_expires_at)}` : ""}
          </Typography>
        )}
      </Stack>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

      <Stack spacing={0.5}>
        <Typography sx={{ fontWeight: 800 }}>Entregar para</Typography>
        <Typography variant="body2" sx={{ opacity: 0.75 }}>
          {address?.recipient_name} — {addressLine(address)}
        </Typography>
      </Stack>

      {confirmErrorMsg && <Alert severity="error">{confirmErrorMsg}</Alert>}

      <Button
        variant="contained"
        fullWidth
        size="large"
        disabled={confirming}
        startIcon={confirming ? <CircularProgress size={18} /> : null}
        onClick={onConfirm}
        sx={{ bgcolor: "primary.main", color: "#0E0E0E", fontWeight: 900, borderRadius: 999, py: 1.4 }}
      >
        {confirming ? "PROCESSANDO RESGATE…" : "CONFIRMAR RESGATE"}
      </Button>
      <Typography variant="caption" sx={{ opacity: 0.5, textAlign: "center" }}>
        Frete e entrega são combinados diretamente após a confirmação — esta etapa não cobra frete.
      </Typography>
    </Stack>
  );
}

/* ─────────────────────────── Passo 3: resultado ─────────────────────────── */

function ResultScreen({ redemption }) {
  const status = redemption.status;

  if (status === "confirmed") {
    return (
      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: "center", borderColor: "rgba(103,194,58,0.35)" }}>
        <Stack spacing={1.5} alignItems="center">
          <CheckCircleRoundedIcon sx={{ fontSize: 56, color: "primary.main" }} />
          <Typography sx={{ fontWeight: 900, fontSize: 22 }}>RESGATE CONFIRMADO</Typography>
          {redemption.tray_order_id && (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              Pedido #{redemption.tray_order_id}
            </Typography>
          )}
          <Typography variant="body2" sx={{ opacity: 0.75 }}>
            {formatNsCredits(redemption.credits_amount)} NSCréditos utilizados
          </Typography>
          <Typography sx={{ fontWeight: 800 }}>
            Saldo atual: {formatNsCredits(redemption.coupon_value_after_cents / 100)} NSCréditos
          </Typography>
          <Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
            <Button component={RouterLink} to="/loja/pedidos" variant="contained" sx={{ bgcolor: "primary.main", color: "#0E0E0E", fontWeight: 900, borderRadius: 999 }}>
              MEUS PEDIDOS
            </Button>
            <Button component={RouterLink} to="/loja" variant="outlined" sx={{ borderRadius: 999, fontWeight: 800 }}>
              VOLTAR À LOJA
            </Button>
          </Stack>
        </Stack>
      </Paper>
    );
  }

  if (status === "reconciliation_required") {
    return (
      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: "center", borderColor: "rgba(255,193,7,0.35)" }}>
        <Stack spacing={1.5} alignItems="center">
          <HourglassTopRoundedIcon sx={{ fontSize: 56, color: "secondary.main" }} />
          <Typography sx={{ fontWeight: 900, fontSize: 22 }}>ESTAMOS CONFIRMANDO SEU RESGATE</Typography>
          <Typography variant="body2" sx={{ opacity: 0.8, maxWidth: 420 }}>
            Não conseguimos confirmar com certeza se o pedido foi criado do outro lado. Seus{" "}
            {formatNsCredits(redemption.credits_amount)} NSCréditos ficam reservados até resolvermos isso —
            eles não somem. <strong>Não tente novamente.</strong> Acompanhe o status em Meus Pedidos.
          </Typography>
          <Button component={RouterLink} to="/loja/pedidos" variant="contained" sx={{ bgcolor: "secondary.main", color: "#0E0E0E", fontWeight: 900, borderRadius: 999, mt: 1 }}>
            MEUS PEDIDOS
          </Button>
        </Stack>
      </Paper>
    );
  }

  // compensated / blocked_tray_customer_unmapped / blocked_tray_contract_pending / failed
  return (
    <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: "center", borderColor: "rgba(255,255,255,0.12)" }}>
      <Stack spacing={1.5} alignItems="center">
        <ErrorOutlineRoundedIcon sx={{ fontSize: 56, color: "rgba(255,255,255,0.5)" }} />
        <Typography sx={{ fontWeight: 900, fontSize: 22 }}>RESGATE NÃO CONCLUÍDO</Typography>
        <Typography variant="body2" sx={{ opacity: 0.8, maxWidth: 420 }}>
          Não foi possível concluir o resgate agora. Os {formatNsCredits(redemption.credits_amount)} NSCréditos foram
          devolvidos integralmente — seu saldo atual é {formatNsCredits(redemption.coupon_value_after_cents / 100)}{" "}
          NSCréditos.
        </Typography>
        <Button component={RouterLink} to="/loja" variant="outlined" sx={{ borderRadius: 999, fontWeight: 800, mt: 1 }}>
          VOLTAR À LOJA
        </Button>
      </Stack>
    </Paper>
  );
}

/* ─────────────────────────── Página ─────────────────────────── */

function ResgateConteudo() {
  const { user, loading: authLoading } = useAuth();
  const { cart } = useCart();
  const cartItemsById = React.useMemo(() => {
    const map = {};
    (cart?.items || []).forEach((i) => {
      map[i.id] = i;
    });
    return map;
  }, [cart]);

  const [bootLoading, setBootLoading] = React.useState(true);
  const [bootError, setBootError] = React.useState("");
  const [addresses, setAddresses] = React.useState([]);
  const [selectedAddressId, setSelectedAddressId] = React.useState(null);
  const [profileComplete, setProfileComplete] = React.useState(true);

  const [prepared, setPrepared] = React.useState(null);
  const [prepareLoading, setPrepareLoading] = React.useState(false);
  const [prepareError, setPrepareError] = React.useState("");

  const [confirming, setConfirming] = React.useState(false);
  const [confirmErrorMsg, setConfirmErrorMsg] = React.useState("");
  const [redemption, setRedemption] = React.useState(null);

  // Gerada UMA vez por carregamento desta pagina — reenviada identica em
  // qualquer retry. Uma nova tentativa de verdade so acontece navegando
  // de novo para ca (o componente remonta, uma nova chave nasce).
  const idempotencyKeyRef = React.useRef(makeIdempotencyKey());

  React.useEffect(() => {
    if (authLoading || !user || !isRewardRedemptionEnabled()) return;
    let cancelled = false;
    (async () => {
      setBootLoading(true);
      setBootError("");
      try {
        const [out, profile] = await Promise.all([getCheckoutBootstrap(), getMyProfile()]);
        if (cancelled) return;
        const list = Array.isArray(out?.addresses) ? out.addresses : [];
        setAddresses(list);
        const def = list.find((a) => a.is_default) || list[0] || null;
        if (def) setSelectedAddressId(def.id);
        setProfileComplete(profile?.profile_complete_for_reward !== false);
      } catch (e) {
        if (!cancelled) setBootError(describeCheckoutError(e, "Não foi possível carregar o checkout agora."));
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const runPrepare = React.useCallback(async (addressId) => {
    setPrepareLoading(true);
    setPrepareError("");
    setPrepared(null);
    try {
      const out = await prepareRedemption(addressId);
      setPrepared(out);
    } catch (e) {
      setPrepareError(describeCheckoutError(e, "Não foi possível revisar o resgate agora."));
    } finally {
      setPrepareLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // Nao adianta revisar o resgate enquanto falta dado de perfil exigido
    // pela Tray -- evita uma chamada de rede que so seria descartada.
    if (!selectedAddressId || !profileComplete) return;
    runPrepare(selectedAddressId);
  }, [selectedAddressId, profileComplete, runPrepare]);

  async function handleConfirm() {
    if (confirming) return; // anti-duplo-clique: nunca reemitir enquanto ha uma tentativa em voo
    setConfirming(true);
    setConfirmErrorMsg("");
    try {
      const out = await confirmRedemption(selectedAddressId, idempotencyKeyRef.current);
      setRedemption(out.redemption);
    } catch (e) {
      setConfirmErrorMsg(describeCheckoutError(e, "Não foi possível confirmar o resgate agora. Tente novamente."));
    } finally {
      setConfirming(false);
    }
  }

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) || null;

  if (!isRewardRedemptionEnabled()) {
    return (
      <Alert severity="info" variant="outlined">
        O resgate por NSCréditos ainda não está disponível. Volte em breve.
      </Alert>
    );
  }

  if (authLoading) return null;
  if (!user) {
    return (
      <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: "center", borderColor: "rgba(255,255,255,0.08)" }}>
        <Stack spacing={1.5} alignItems="center">
          <Typography sx={{ fontWeight: 800 }}>Entre na sua conta para continuar.</Typography>
          <Button component={RouterLink} to="/login" variant="contained" sx={{ borderRadius: 999, px: 3, fontWeight: 900 }}>
            ENTRAR
          </Button>
        </Stack>
      </Paper>
    );
  }

  if (redemption) return <ResultScreen redemption={redemption} />;

  if (bootLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={120} sx={{ borderRadius: 3 }} />
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: 3 }} />
      </Stack>
    );
  }

  if (bootError) {
    return <Alert severity="error">{bootError}</Alert>;
  }

  if (!profileComplete) {
    return <ProfileCompletionStep onComplete={() => setProfileComplete(true)} />;
  }

  return (
    <Stack spacing={4}>
      <AddressStep
        addresses={addresses}
        selectedId={selectedAddressId}
        onSelect={setSelectedAddressId}
        onAddressCreated={(addr) => {
          setAddresses((list) => [...list, addr]);
          setSelectedAddressId(addr.id);
        }}
      />

      {selectedAddressId && (
        <>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
          {prepareLoading ? (
            <Skeleton variant="rounded" height={260} sx={{ borderRadius: 3 }} />
          ) : prepareError ? (
            <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => runPrepare(selectedAddressId)}>Tentar de novo</Button>}>
              {prepareError}
            </Alert>
          ) : prepared ? (
            <ReviewStep
              prepared={prepared}
              address={selectedAddress}
              cartItemsById={cartItemsById}
              confirming={confirming}
              confirmErrorMsg={confirmErrorMsg}
              onConfirm={handleConfirm}
            />
          ) : null}
        </>
      )}
    </Stack>
  );
}

export default function LojaResgatePage() {
  const navigate = useNavigate();
  return (
    <LojaShell onBack={() => navigate("/loja")}>
      <Box sx={{ maxWidth: 640, mx: "auto", px: 2, py: { xs: 3, md: 5 } }}>
        <Chip label="RESGATE" size="small" sx={{ mb: 2, fontWeight: 800, bgcolor: "rgba(255,255,255,0.08)" }} />
        <ResgateConteudo />
      </Box>
    </LojaShell>
  );
}
