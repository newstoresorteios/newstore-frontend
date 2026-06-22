import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  getNotificationPermission,
  getPushAccess,
  getPushPreferences,
  hasActiveBrowserSubscription,
  isPushSupported,
  sendSingleDeviceTestPush,
  subscribeToPush,
  unsubscribeFromPush,
  updatePushPreferences,
} from "../services/pushNotifications";

const LABEL = "43998640480";

function friendlyError(code) {
  if (code === "push_test_setup_code_required") return "Código de teste inválido ou ausente.";
  if (code === "push_test_subscription_id_missing") {
    return "Subscription salva. Copie o subscription_id e configure PUSH_TEST_SUBSCRIPTION_ID no backend para liberar o envio de teste.";
  }
  if (code === "push_production_send_blocked") return "Envio Push bloqueado em produção pelo modo de segurança.";
  if (code === "push_permission_not_granted") return "A permissão de notificações não foi concedida.";
  if (code === "push_test_subscription_not_found_or_inactive") return "A subscription configurada não existe ou está inativa.";
  if (code === "push_not_supported") return "Este navegador não oferece suporte a notificações Push.";
  return "Push bloqueado pelo modo de teste.";
}

export default function PushNotificationSettings() {
  const [access, setAccess] = React.useState(null);
  const [permission, setPermission] = React.useState(getNotificationPermission());
  const [active, setActive] = React.useState(false);
  const [setupCode, setSetupCode] = React.useState("");
  const [subscriptionId, setSubscriptionId] = React.useState("");
  const [operational, setOperational] = React.useState(true);
  const [marketing, setMarketing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState(null);

  React.useEffect(() => {
    let mounted = true;
    getPushAccess()
      .then(async (result) => {
        if (!mounted) return;
        setAccess(result);
        if (!result?.visible) return;
        setPermission(getNotificationPermission());
        setActive(await hasActiveBrowserSubscription());
        try {
          const preferences = await getPushPreferences();
          if (!mounted) return;
          setOperational(preferences.push_operational_opt_in !== false);
          setMarketing(preferences.push_marketing_opt_in === true);
        } catch (_) {}
      })
      .catch(() => mounted && setAccess({ visible: false }));
    return () => { mounted = false; };
  }, []);

  if (!access?.visible) return null;

  const supported = isPushSupported();
  const testLabel = access.test_label || LABEL;

  async function activate() {
    setBusy(true);
    setNotice(null);
    try {
      const result = await subscribeToPush({ setupCode, deviceLabel: navigator.userAgent });
      setSubscriptionId(result.subscription_id || "");
      setSetupCode("");
      setPermission(getNotificationPermission());
      setActive(true);
      setOperational(true);
      setMarketing(false);
      setNotice({ severity: "success", text: "Subscription salva. Copie o subscription_id antes de sair desta tela." });
    } catch (error) {
      setPermission(getNotificationPermission());
      setNotice({ severity: "error", text: friendlyError(error?.code || error?.message) });
    } finally {
      setBusy(false);
    }
  }

  async function copySubscriptionId() {
    if (!subscriptionId) return;
    try {
      await navigator.clipboard.writeText(subscriptionId);
      setNotice({ severity: "success", text: "subscription_id copiado." });
    } catch {
      setNotice({ severity: "error", text: "Não foi possível copiar o subscription_id." });
    }
  }

  async function sendTest() {
    setBusy(true);
    setNotice(null);
    try {
      await sendSingleDeviceTestPush();
      setNotice({ severity: "success", text: "Push enviado para a subscription de teste configurada." });
    } catch (error) {
      setNotice({ severity: "warning", text: friendlyError(error?.code || error?.message) });
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    setNotice(null);
    try {
      await unsubscribeFromPush();
      setActive(false);
      setSubscriptionId("");
      setNotice({ severity: "success", text: "Push desativado neste dispositivo." });
    } catch (error) {
      setNotice({ severity: "error", text: friendlyError(error?.code || error?.message) });
    } finally {
      setBusy(false);
    }
  }

  async function savePreferences() {
    setBusy(true);
    setNotice(null);
    try {
      await updatePushPreferences({
        push_operational_opt_in: operational,
        push_marketing_opt_in: marketing,
      });
      setNotice({ severity: "success", text: "Preferências de Push salvas." });
    } catch (error) {
      setNotice({ severity: "error", text: friendlyError(error?.code || error?.message) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box id="push-notification-settings">
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, mb: 2 }}>
        <Typography variant="h6" fontWeight={900}>Receba avisos sem depender do WhatsApp</Typography>
        <Typography sx={{ opacity: 0.78, mt: 0.5, mb: 1.5 }}>
          Ative notificações no navegador para acompanhar atualizações importantes da sua conta.
        </Typography>
        <Button variant="outlined" href="#push-preferences">Configurar notificações</Button>
      </Paper>

      <Paper id="push-preferences" variant="outlined" sx={{ p: { xs: 2, md: 3 }, scrollMarginTop: 90 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline" sx={{ opacity: 0.72 }}>Preferências de comunicação</Typography>
            <Typography variant="h6" fontWeight={900}>Teste de notificações Push</Typography>
            <Typography sx={{ opacity: 0.8 }}>Este recurso está em teste restrito nesta conta.</Typography>
            <Typography sx={{ mt: 1 }}>Número de referência: <strong>{testLabel}</strong></Typography>
            <Typography variant="body2" sx={{ opacity: 0.72 }}>
              Este número é apenas uma referência. Push não envia para telefone; envia para este navegador/dispositivo após autorização. Nenhuma mensagem será enviada por WhatsApp ou Brevo.
            </Typography>
          </Box>

          {!supported && <Alert severity="warning">Este navegador não oferece suporte a notificações Push.</Alert>}
          {permission === "denied" && (
            <Alert severity="warning">A permissão está bloqueada no navegador. Para ativar, libere notificações nas configurações do site.</Alert>
          )}
          {permission === "default" && <Alert severity="info">Permissão ainda não solicitada.</Alert>}
          {permission === "granted" && <Alert severity="success">Permissão concedida.{active ? " Push ativo neste dispositivo." : ""}</Alert>}
          {notice && <Alert severity={notice.severity}>{notice.text}</Alert>}

          {subscriptionId && (
            <TextField
              label="subscription_id"
              value={subscriptionId}
              fullWidth
              InputProps={{ readOnly: true }}
            />
          )}

          <TextField
            label="Código de teste"
            type="password"
            value={setupCode}
            onChange={(event) => setSetupCode(event.target.value)}
            autoComplete="off"
            helperText="Digite manualmente. O código não é salvo no navegador."
            disabled={busy || !supported || permission === "denied"}
          />

          <Box>
            <FormControlLabel
              control={<Checkbox checked={operational} onChange={(event) => setOperational(event.target.checked)} />}
              label="Receber avisos importantes da minha conta"
            />
            <Typography variant="body2" sx={{ opacity: 0.7, ml: 4 }}>
              Pagamentos, saldo vencendo, resultado publicado e atualizações da conta.
            </Typography>
          </Box>
          <Box>
            <FormControlLabel
              control={<Checkbox checked={marketing} onChange={(event) => setMarketing(event.target.checked)} />}
              label="Receber avisos sobre sorteios e novidades"
            />
            <Typography variant="body2" sx={{ opacity: 0.7, ml: 4 }}>
              Abertura de sorteios, andamento e comunicados da New Store.
            </Typography>
          </Box>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap">
            <Button variant="contained" color="success" onClick={activate} disabled={busy || !supported || permission === "denied" || !setupCode}>
              Ativar Push neste dispositivo
            </Button>
            <Button variant="outlined" onClick={copySubscriptionId} disabled={busy || !subscriptionId}>
              Copiar subscription_id
            </Button>
            <Button variant="outlined" onClick={sendTest} disabled={busy || !active}>
              Enviar teste controlado
            </Button>
            <Button variant="outlined" color="warning" onClick={deactivate} disabled={busy || !active}>
              Desativar neste dispositivo
            </Button>
            <Button variant="text" onClick={savePreferences} disabled={busy || !active}>
              Salvar preferências
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
