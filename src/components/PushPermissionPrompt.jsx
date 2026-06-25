import * as React from "react";
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useAuth } from "../authContext";
import {
  getNotificationPermission,
  getPushAccess,
  hasActiveBrowserSubscription,
  isPushSupported,
  subscribeToPush,
} from "../services/pushNotifications";

const DISMISSED_KEY = "push_permission_prompt_dismissed_until";
const DISMISS_DAYS = 7;

function dismissedUntil() {
  try {
    return Number(localStorage.getItem(DISMISSED_KEY) || 0) || 0;
  } catch {
    return 0;
  }
}

function dismissForAWeek() {
  try {
    localStorage.setItem(
      DISMISSED_KEY,
      String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000)
    );
  } catch {}
}

export default function PushPermissionPrompt() {
  const { user, loading } = useAuth();
  const [visible, setVisible] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let mounted = true;

    async function check() {
      setVisible(false);
      setError("");
      if (loading || !user) return;
      if (!isPushSupported()) return;
      if (getNotificationPermission() === "denied") return;
      if (dismissedUntil() > Date.now()) return;
      if (await hasActiveBrowserSubscription()) return;

      try {
        const access = await getPushAccess();
        if (!mounted) return;
        setVisible(Boolean(access?.visible && access?.can_subscribe));
      } catch {
        if (mounted) setVisible(false);
      }
    }

    check();
    return () => {
      mounted = false;
    };
  }, [loading, user]);

  if (!visible) return null;

  async function allowNotifications() {
    setBusy(true);
    setError("");
    try {
      await subscribeToPush({
        deviceLabel: typeof navigator !== "undefined" ? navigator.userAgent : "Navegador",
      });
      setVisible(false);
    } catch (err) {
      setError(
        err?.code ||
          err?.message ||
          "Não foi possível ativar notificações neste navegador."
      );
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    dismissForAWeek();
    setVisible(false);
  }

  return (
    <Box
      sx={{
        position: "fixed",
        right: { xs: 12, md: 20 },
        bottom: { xs: 12, md: 20 },
        zIndex: 1300,
        maxWidth: 380,
        width: "calc(100% - 24px)",
      }}
    >
      <Paper elevation={8} sx={{ p: 2, borderRadius: 3 }}>
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
              Receba avisos dos novos sorteios
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.78 }}>
              Ative as notificações para saber quando um novo sorteio estiver disponível.
            </Typography>
          </Box>
          {error && <Alert severity="warning">{String(error)}</Alert>}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" variant="text" onClick={dismiss} disabled={busy}>
              Agora não
            </Button>
            <Button size="small" variant="contained" onClick={allowNotifications} disabled={busy}>
              Permitir notificações
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
