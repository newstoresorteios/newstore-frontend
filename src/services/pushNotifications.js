import { api } from "./api";

function withCode(error) {
  if (error?.code) return error;
  const text = String(error?.message || error || "push_request_failed");
  const codeOnly = text.includes(":") ? text.split(":")[0] : text;
  const jsonStart = text.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(text.slice(jsonStart));
      error.code = parsed?.error || parsed?.code || "push_request_failed";
      error.payload = parsed;
      return error;
    } catch (_) {}
  }
  error.code = codeOnly;
  return error;
}

export function parsePushError(error) {
  const normalized = withCode(error || new Error("push_request_failed"));
  const code = normalized?.code || normalized?.message || "push_request_failed";
  if (code === "push_test_subscription_id_missing") {
    return "PUSH_TEST_SUBSCRIPTION_ID/PUSH_TEST_SUBSCRIPTION_IDS ainda não foi configurado.";
  }
  if (code === "push_production_send_blocked") {
    return "Envio Push bloqueado em produção pelo modo de segurança.";
  }
  if (code === "push_test_subscription_not_found_or_inactive") {
    return "Subscription de teste não encontrada ou inativa.";
  }
  if (code === "push_test_too_many_subscriptions_configured") {
    return "Há mais subscriptions configuradas que o limite permitido para teste.";
  }
  if (code === "push_provider_forbidden_or_vapid_mismatch") {
    return "Provider bloqueou o envio. Recrie a subscription após conferir as chaves VAPID.";
  }
  return String(code);
}

async function pushApi(path, options) {
  try {
    return await api(path, options);
  } catch (error) {
    throw withCode(error);
  }
}

export function isPushSupported() {
  return typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
}

export function getNotificationPermission() {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

export async function requestPushPermission() {
  if (!isPushSupported()) throw new Error("push_not_supported");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("push_permission_not_granted");
  return permission;
}

export async function registerPushServiceWorker() {
  if (!("serviceWorker" in navigator)) throw new Error("service_worker_not_supported");
  try {
    return await navigator.serviceWorker.register("/push-sw.js");
  } catch {
    throw new Error("push_service_worker_failed");
  }
}

export async function getPushAccess() {
  try {
    return await pushApi("/api/push/access");
  } catch (error) {
    if (error?.code === "push_hidden_for_user" || String(error?.message || "").startsWith("404")) {
      return { ok: false, visible: false, error: "push_hidden_for_user" };
    }
    throw error;
  }
}

export function getVapidPublicKey() {
  return pushApi("/api/push/vapid-public-key");
}

export function getPushDebugConfig() {
  return pushApi("/api/push/debug-config");
}

export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function arrayBufferToBase64Url(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || []);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function normalizeBase64Url(value) {
  return String(value || "").trim().replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function isSameApplicationServerKey(existingKey, expectedKey) {
  if (!existingKey || !expectedKey) return false;
  const existing = typeof existingKey === "string"
    ? normalizeBase64Url(existingKey)
    : arrayBufferToBase64Url(existingKey);
  return existing === normalizeBase64Url(expectedKey);
}

export async function subscribeToPush({ deviceLabel, setupCode } = {}) {
  if (!isPushSupported()) throw new Error("push_not_supported");
  const cleanSetupCode = String(setupCode || "").trim();

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (process.env.NODE_ENV !== "production") {
    console.log("[push.front] permission", permission);
  }
  if (permission !== "granted") throw new Error("push_permission_not_granted");

  await registerPushServiceWorker();
  if (process.env.NODE_ENV !== "production") {
    console.log("[push.front] service-worker:registered");
  }
  const readyRegistration = await navigator.serviceWorker.ready.catch(() => null);
  if (!readyRegistration) throw new Error("push_service_worker_not_ready");
  if (process.env.NODE_ENV !== "production") {
    console.log("[push.front] service-worker:ready");
  }

  const vapid = await getVapidPublicKey();
  if (vapid?.error) throw new Error(vapid.error);
  const { publicKey, enabled } = vapid;
  if (process.env.NODE_ENV !== "production") {
    console.log("[push.front] vapid:loaded", {
      enabled: Boolean(enabled),
      hasPublicKey: Boolean(publicKey),
    });
  }
  if (!enabled || !publicKey) throw new Error("push_disabled");

  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  let subscription = await readyRegistration.pushManager.getSubscription();
  let createdNow = false;
  if (subscription) {
    const sameKey = isSameApplicationServerKey(
      subscription.options?.applicationServerKey,
      publicKey
    );
    if (process.env.NODE_ENV !== "production") {
      console.log("[push.front] vapid:compare", {
        hasExistingKey: Boolean(subscription.options?.applicationServerKey),
        sameKey,
      });
    }
    if (!sameKey) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[push.front] browser-subscription:vapid-mismatch");
      }
      await subscription.unsubscribe().catch(() => {});
      if (process.env.NODE_ENV !== "production") {
        console.log("[push.front] browser-subscription:unsubscribed");
      }
      subscription = null;
    }
  }
  if (!subscription) {
    try {
      subscription = await readyRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      createdNow = true;
      if (process.env.NODE_ENV !== "production") {
        console.log("[push.front] browser-subscription:created");
      }
    } catch {
      throw new Error("push_subscription_failed");
    }
  }
  if (process.env.NODE_ENV !== "production") {
    console.log("[push.front] browser-subscription:ready", {
      hasEndpoint: Boolean(subscription?.endpoint),
    });
    console.log("[push.front] api-subscribe:payload", {
      hasSubscription: Boolean(subscription),
      hasSetupCode: Boolean(cleanSetupCode),
      setupCodeLength: cleanSetupCode.length,
      hasDeviceLabel: Boolean(deviceLabel || navigator.userAgent),
    });
    console.log("[push.front] api-subscribe:start");
  }

  try {
    const result = await pushApi("/api/push/subscribe", {
      method: "POST",
      body: {
        subscription: subscription.toJSON ? subscription.toJSON() : subscription,
        deviceLabel: deviceLabel || navigator.userAgent,
        setupCode: cleanSetupCode,
      },
    });
    if (process.env.NODE_ENV !== "production") {
      console.log("[push.front] api-subscribe:done", {
        ok: result?.ok,
        hasSubscriptionId: Boolean(result?.subscription_id),
      });
    }
    return result;
  } catch (error) {
    if (createdNow) await subscription.unsubscribe().catch(() => {});
    if (error?.code) throw error;
    throw new Error("push_subscribe_api_failed");
  }
}

export async function recreatePushSubscription({ deviceLabel, setupCode } = {}) {
  await unsubscribeFromPush().catch(() => ({ ok: true }));
  return subscribeToPush({ deviceLabel, setupCode });
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) throw new Error("push_not_supported");
  await registerPushServiceWorker();
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return { ok: true, deactivated: false };
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const result = await pushApi("/api/push/unsubscribe", {
    method: "POST",
    body: { endpoint },
  });
  return result;
}

export function sendTestPush({ title = "New Store", body = "Teste controlado de Push.", url = "/me" } = {}) {
  return pushApi("/api/push/test", { method: "POST", body: { title, body, url } });
}

export function sendSingleDeviceTestPush({ title = "New Store", body = "Teste controlado de Push.", url = "/me" } = {}) {
  return pushApi("/api/push/test-single-device", { method: "POST", body: { title, body, url } });
}

export async function sendCurrentDeviceTestPush() {
  if (!isPushSupported()) throw new Error("push_not_supported");
  const registration = await navigator.serviceWorker.ready.catch(() => null);
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) throw new Error("push_current_device_subscription_required");
  return pushApi("/api/push/test-current-device", {
    method: "POST",
    body: {
      subscription: subscription.toJSON ? subscription.toJSON() : subscription,
    },
  });
}

export function getPushPreferences() {
  return pushApi("/api/push/preferences");
}

export function updatePushPreferences({ push_operational_opt_in, push_marketing_opt_in }) {
  return pushApi("/api/push/preferences", {
    method: "PUT",
    body: { push_operational_opt_in, push_marketing_opt_in },
  });
}

export async function hasActiveBrowserSubscription() {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  return Boolean(await registration?.pushManager?.getSubscription());
}
