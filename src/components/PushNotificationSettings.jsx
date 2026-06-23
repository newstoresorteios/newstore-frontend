import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  FormControlLabel,
  Stack,
  Typography,
} from "@mui/material";
import {
  getNotificationPermission,
  getPushConfig,
  getPushPreferences,
  getLocalPushSubscription,
  isPushSupported,
  parsePushError,
  sendSelfTestPush,
  subscribeToPush,
  unsubscribeFromPush,
  updatePushPreferences,
} from "../services/pushNotifications";

function permissionLabel(permission) {
  if (permission === "unsupported") return "Navegador sem suporte";
  if (permission === "default") return "Permissão ainda não solicitada";
  if (permission === "granted") return "Permissão concedida";
  if (permission === "denied") return "Permissão bloqueada";
  return permission;
}

export default function PushNotificationSettings() {
  const [loading, setLoading] = React.useState(true);
  const [config, setConfig] = React.useState(null);
  const [prefs, setPrefs] = React.useState({
    push_operational_opt_in: false,
    push_marketing_opt_in: false,
  });
  const [localSubscribed, setLocalSubscribed] = React.useState(false);
  const [permission, setPermission] = React.useState(getNotificationPermission());
  const [busy, setBusy] = React.useState("");
  const [message, setMessage] = React.useState(null);
  const [error, setError] = React.useState(null);

  const supported = isPushSupported();
  const testMode = Boolean(config?.test_mode);

  const refreshStatus = React.useCallback(async () => {
    setPermission(getNotificationPermission());
    const sub = await getLocalPushSubscription();
    setLocalSubscribed(Boolean(sub));
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await getPushConfig();
      setConfig(cfg);
      try {
        const p = await getPushPreferences();
        setPrefs({
          push_operational_opt_in: Boolean(p?.push_operational_opt_in),
          push_marketing_opt_in: Boolean(p?.push_marketing_opt_in),
        });
      } catch {
        // preferências podem falhar se usuário novo
      }
      await refreshStatus();
    } catch (err) {
      setError(parsePushError(err));
    } finally {
      setLoading(false);
    }
  }, [refreshStatus]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleActivate = async () => {
    setBusy("activate");
    setMessage(null);
    setError(null);
    try {
      setPrefs((prev) => ({ ...prev, push_operational_opt_in: true }));
      await subscribeToPush({});
      try {
        await updatePushPreferences({
          push_operational_opt_in: true,
          push_marketing_opt_in: prefs.push_marketing_opt_in,
        });
      } catch {
        // subscription já salva; preferências podem ser salvas depois
      }
      await refreshStatus();
      setMessage("Notificações ativadas neste dispositivo.");
    } catch (err) {
      setError(parsePushError(err));
      await refreshStatus();
    } finally {
      setBusy("");
    }
  };

  const handleSavePrefs = async () => {
    setBusy("prefs");
    setMessage(null);
    setError(null);
    try {
      await updatePushPreferences(prefs);
      setMessage("Preferências salvas.");
    } catch (err) {
      setError(parsePushError(err));
    } finally {
      setBusy("");
    }
  };

  const handleSelfTest = async () => {
    setBusy("test");
    setMessage(null);
    setError(null);
    try {
      const result = await sendSelfTestPush();
      const sent = result?.sent ?? result?.summary?.sent;
      const failed = result?.failed ?? result?.summary?.failed;
      setMessage(
        sent != null
          ? `Push de teste enviado. Enviados: ${sent}, falhas: ${failed ?? 0}.`
          : "Push de teste solicitado."
      );
    } catch (err) {
      setError(parsePushError(err));
    } finally {
      setBusy("");
    }
  };

  const handleDeactivate = async () => {
    setBusy("deactivate");
    setMessage(null);
    setError(null);
    try {
      await unsubscribeFromPush();
      await refreshStatus();
      setMessage("Notificações desativadas neste dispositivo.");
    } catch (err) {
      setError(parsePushError(err));
    } finally {
      setBusy("");
    }
  };

  const deviceStatus = !supported
    ? "Navegador sem suporte"
    : localSubscribed
      ? "Push ativo neste dispositivo"
      : "Push desativado neste dispositivo";

  return (
    <Stack spacing={2}>
      <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
        <Typography variant="h6" fontWeight={900}>
          Receber avisos no navegador
        </Typography>
        {testMode && (
          <Chip
            label="Modo teste ativo"
            size="small"
            color="warning"
            sx={{ fontWeight: 800 }}
          />
        )}
      </Stack>

      <Typography variant="body2" sx={{ opacity: 0.85 }}>
        Ative para receber avisos importantes da sua conta sem depender do WhatsApp.
      </Typography>

      {testMode && (
        <Alert severity="warning" variant="outlined">
          Enquanto os testes não forem finalizados, o sistema não envia Push para a base de usuários.
        </Alert>
      )}

      {loading && (
        <Typography variant="body2" sx={{ opacity: 0.7 }}>Carregando…</Typography>
      )}

      {!loading && (
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            border: "1px solid rgba(255,255,255,0.12)",
            bgcolor: "rgba(255,255,255,0.03)",
          }}
        >
          <Stack spacing={0.5}>
            <Typography variant="body2" sx={{ opacity: 0.75 }}>Status</Typography>
            <Typography variant="body2" fontWeight={700}>{permissionLabel(permission)}</Typography>
            <Typography variant="body2" fontWeight={700}>{deviceStatus}</Typography>
            {testMode && (
              <Typography variant="body2" fontWeight={700} color="warning.main">
                Sistema em modo teste
              </Typography>
            )}
          </Stack>
        </Box>
      )}

      {permission === "denied" && (
        <Alert severity="error" variant="outlined">
          A permissão está bloqueada no navegador. Libere notificações nas configurações do site.
        </Alert>
      )}

      {error && (
        <Alert severity="error" variant="outlined" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {message && (
        <Alert severity="success" variant="outlined" onClose={() => setMessage(null)}>
          {message}
        </Alert>
      )}

      <Stack spacing={0.5}>
        <FormControlLabel
          control={
            <Checkbox
              checked={prefs.push_operational_opt_in}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, push_operational_opt_in: e.target.checked }))
              }
              disabled={!supported || loading}
            />
          }
          label="Receber avisos importantes da minha conta"
        />
        <Typography variant="caption" sx={{ opacity: 0.7, pl: 4 }}>
          Pagamentos, saldo vencendo, resultado publicado e atualizações da conta.
        </Typography>
      </Stack>

      <Stack spacing={0.5}>
        <FormControlLabel
          control={
            <Checkbox
              checked={prefs.push_marketing_opt_in}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, push_marketing_opt_in: e.target.checked }))
              }
              disabled={!supported || loading}
            />
          }
          label="Receber avisos sobre sorteios e novidades"
        />
        <Typography variant="caption" sx={{ opacity: 0.7, pl: 4 }}>
          Abertura de sorteios, andamento e comunicados da New Store.
        </Typography>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} flexWrap="wrap" gap={1}>
        <Button
          variant="contained"
          color="success"
          onClick={handleActivate}
          disabled={!supported || loading || busy || permission === "denied"}
        >
          {busy === "activate" ? "Ativando…" : "Ativar notificações neste dispositivo"}
        </Button>
        <Button
          variant="outlined"
          onClick={handleSavePrefs}
          disabled={!supported || loading || busy}
        >
          {busy === "prefs" ? "Salvando…" : "Salvar preferências"}
        </Button>
        <Button
          variant="outlined"
          onClick={handleSelfTest}
          disabled={!supported || loading || busy || !localSubscribed}
        >
          {busy === "test" ? "Enviando…" : "Enviar push de teste para este dispositivo"}
        </Button>
        <Button
          variant="text"
          color="warning"
          onClick={handleDeactivate}
          disabled={!supported || loading || busy || !localSubscribed}
        >
          {busy === "deactivate" ? "Desativando…" : "Desativar neste dispositivo"}
        </Button>
      </Stack>
    </Stack>
  );
}
