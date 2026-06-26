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
const DEBUG_KEY = "push_prompt_debug";
const DISMISS_DAYS = 7;

function isDebugEnabled() {
  try {
    return localStorage.getItem(DEBUG_KEY) === "true";
  } catch {
    return false;
  }
}

function debugPrompt(event, payload = {}) {
  if (!isDebugEnabled()) return;
  console.log("[push.prompt]", event, payload);
}

function getDismissedUntil() {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return 0;
    const until = Number(raw);
    if (!Number.isFinite(until) || until <= Date.now()) {
      localStorage.removeItem(DISMISSED_KEY);
      return 0;
    }
    return until;
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

function getDeviceLabel() {
  return typeof navigator !== "undefined" ? navigator.userAgent : "Navegador";
}

export default function PushPermissionPrompt() {
  const { loading } = useAuth();
  const syncAttemptedRef = React.useRef(false);
  const [visible, setVisible] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let mounted = true;

    function finish(nextVisible, reason, extra = {}) {
      if (!mounted) return;
      setVisible(nextVisible);
      debugPrompt("check", {
        finalVisible: nextVisible,
        reason,
        ...extra,
      });
    }

    async function check() {
      setVisible(false);
      setError("");

      const permission = getNotificationPermission();
      const support = {
        hasNotification: typeof window !== "undefined" && "Notification" in window,
        hasServiceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator,
        hasPushManager: typeof window !== "undefined" && "PushManager" in window,
      };
      const dismissedUntil = getDismissedUntil();

      if (loading) {
        finish(false, "auth_loading", { permission, dismissedUntil, ...support });
        return;
      }
      if (!isPushSupported()) {
        finish(false, "push_not_supported", { permission, dismissedUntil, ...support });
        return;
      }
      if (permission === "denied") {
        finish(false, "permission_denied", { permission, dismissedUntil, ...support });
        return;
      }
      if (dismissedUntil > Date.now()) {
        finish(false, "dismissed", { permission, dismissedUntil, ...support });
        return;
      }

      let access = null;
      try {
        access = await getPushAccess();
      } catch (err) {
        finish(false, "access_error", {
          permission,
          dismissedUntil,
          error: err?.code || err?.message || String(err),
          ...support,
        });
        return;
      }

      debugPrompt("access", access || {});
      if (!access?.can_subscribe) {
        finish(false, access?.reason || access?.error || "access_denied", {
          access,
          permission,
          dismissedUntil,
          ...support,
        });
        return;
      }

      const hasExistingSubscription = await hasActiveBrowserSubscription();
      if (permission === "granted" && hasExistingSubscription && !syncAttemptedRef.current) {
        syncAttemptedRef.current = true;
        try {
          const result = await subscribeToPush({ deviceLabel: getDeviceLabel() });
          finish(false, "existing_subscription_resynced", {
            access,
            permission,
            dismissedUntil,
            hasExistingSubscription,
            subscribeOk: result?.ok === true,
            ...support,
          });
          return;
        } catch (err) {
          finish(true, "existing_subscription_resync_failed", {
            access,
            permission,
            dismissedUntil,
            hasExistingSubscription,
            error: err?.code || err?.message || String(err),
            ...support,
          });
          return;
        }
      }

      if (permission === "default" || permission === "granted") {
        finish(true, permission === "granted" ? "granted_without_synced_subscription" : "permission_default", {
          access,
          permission,
          dismissedUntil,
          hasExistingSubscription,
          ...support,
        });
        return;
      }

      finish(false, "permission_unavailable", {
        access,
        permission,
        dismissedUntil,
        hasExistingSubscription,
        ...support,
      });
    }

    check();
    return () => {
      mounted = false;
    };
  }, [loading]);

  if (!visible) return null;

  async function allowNotifications() {
    setBusy(true);
    setError("");
    try {
      await subscribeToPush({ deviceLabel: getDeviceLabel() });
      setVisible(false);
    } catch (err) {
      setError(
        err?.code ||
          err?.message ||
          "N\u00e3o foi poss\u00edvel ativar notifica\u00e7\u00f5es neste navegador."
      );
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    dismissForAWeek();
    setVisible(false);
    debugPrompt("dismissed", { days: DISMISS_DAYS });
  }

  return (
    <Box
      sx={{
        position: "fixed",
        right: { xs: 12, md: 20 },
        bottom: { xs: 12, md: 20 },
        zIndex: 2000,
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
            <Typography variant="body2" sx={{ opacity: 0.78 }}>{"Ative as notifica\u00e7\u00f5es para saber quando um novo sorteio estiver dispon\u00edvel."}</Typography>
          </Box>
          {error && <Alert severity="warning">{String(error)}</Alert>}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" variant="text" onClick={dismiss} disabled={busy}>{"Agora n\u00e3o"}</Button>
            <Button size="small" variant="contained" onClick={allowNotifications} disabled={busy}>{"Permitir notifica\u00e7\u00f5es"}</Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
