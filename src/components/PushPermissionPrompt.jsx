import * as React from "react";
import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useAuth } from "../authContext";
import {
  getNotificationPermission,
  getPushAccess,
  isPushSupported,
  subscribeToPush,
} from "../services/pushNotifications";

const DISMISSED_KEY = "push_permission_prompt_dismissed_until";
const DEBUG_KEY = "push_prompt_debug";
const DISMISS_DAYS = 7;
const BLOCKED_MESSAGE =
  "As notificações estão bloqueadas neste navegador. Ative-as nas configurações do site.";
const GENERIC_ERROR_MESSAGE = "Não foi possível verificar as notificações agora.";

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
  const [permissionChecked, setPermissionChecked] = React.useState(false);
  const [shouldShowPrompt, setShouldShowPrompt] = React.useState(false);
  const [permission, setPermission] = React.useState("unsupported");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let mounted = true;

    function finish(nextVisible, reason, extra = {}) {
      if (!mounted) return;
      setPermissionChecked(true);
      setShouldShowPrompt(nextVisible);
      debugPrompt("check", {
        finalVisible: nextVisible,
        reason,
        ...extra,
      });
    }

    async function check() {
      setPermissionChecked(false);
      setShouldShowPrompt(false);
      setError("");

      const currentPermission = getNotificationPermission();
      setPermission(currentPermission);
      const support = {
        hasNotification: typeof window !== "undefined" && "Notification" in window,
        hasServiceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator,
        hasPushManager: typeof window !== "undefined" && "PushManager" in window,
      };
      const dismissedUntil = getDismissedUntil();

      if (!support.hasNotification) {
        finish(false, "notification_not_supported", {
          permission: currentPermission,
          dismissedUntil,
          ...support,
        });
        return;
      }
      if (currentPermission === "granted") {
        finish(false, "permission_granted", {
          permission: currentPermission,
          dismissedUntil,
          ...support,
        });
        return;
      }
      if (loading) {
        finish(false, "auth_loading", {
          permission: currentPermission,
          dismissedUntil,
          ...support,
        });
        return;
      }
      if (!isPushSupported()) {
        finish(false, "push_not_supported", {
          permission: currentPermission,
          dismissedUntil,
          ...support,
        });
        return;
      }
      if (currentPermission === "denied") {
        setError(BLOCKED_MESSAGE);
        finish(true, "permission_denied", {
          permission: currentPermission,
          dismissedUntil,
          ...support,
        });
        return;
      }
      if (dismissedUntil > Date.now()) {
        finish(false, "dismissed", {
          permission: currentPermission,
          dismissedUntil,
          ...support,
        });
        return;
      }

      let access = null;
      try {
        access = await getPushAccess();
      } catch (err) {
        finish(false, "access_error", {
          permission: currentPermission,
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
          permission: currentPermission,
          dismissedUntil,
          ...support,
        });
        return;
      }

      if (currentPermission === "default") {
        finish(true, "permission_default", {
          access,
          permission: currentPermission,
          dismissedUntil,
          ...support,
        });
        return;
      }

      finish(false, "permission_unavailable", {
        access,
        permission: currentPermission,
        dismissedUntil,
        ...support,
      });
    }

    check();
    function handlePromptRecheck() {
      check();
    }
    if (typeof window !== "undefined") {
      window.addEventListener("push-permission-prompt:recheck", handlePromptRecheck);
    }
    return () => {
      mounted = false;
      if (typeof window !== "undefined") {
        window.removeEventListener("push-permission-prompt:recheck", handlePromptRecheck);
      }
    };
  }, [loading]);

  if (!permissionChecked || !shouldShowPrompt) return null;

  async function allowNotifications() {
    const currentPermission = getNotificationPermission();
    setPermission(currentPermission);

    if (currentPermission === "granted") {
      setError("");
      setShouldShowPrompt(false);
      return;
    }
    if (currentPermission === "denied") {
      setError(BLOCKED_MESSAGE);
      return;
    }

    setBusy(true);
    setError("");
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission === "granted") {
        setShouldShowPrompt(false);
        setBusy(false);
        subscribeToPush({ deviceLabel: getDeviceLabel() }).catch((err) => {
          debugPrompt("background_sync_failed", {
            error: err?.code || err?.message || String(err),
          });
        });
        return;
      }

      if (nextPermission === "denied") {
        setError(BLOCKED_MESSAGE);
        return;
      }

      setError(GENERIC_ERROR_MESSAGE);
    } catch {
      setError(GENERIC_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    dismissForAWeek();
    setShouldShowPrompt(false);
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
            {permission !== "denied" && (
              <Button size="small" variant="contained" onClick={allowNotifications} disabled={busy}>{"Permitir notifica\u00e7\u00f5es"}</Button>
            )}
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
