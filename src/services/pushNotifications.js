import { api } from "./api";

function withCode(error) {
  if (error?.code) return error;
  const text = String(error?.message || error || "push_request_failed");
  const jsonStart = text.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(text.slice(jsonStart));
      error.code = parsed?.error || parsed?.code || "push_request_failed";
      error.payload = parsed;
      return error;
    } catch (_) {}
  }
  error.code = text;
  return error;
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
  return navigator.serviceWorker.register("/push-sw.js");
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

export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function subscribeToPush({ deviceLabel, setupCode } = {}) {
  if (!isPushSupported()) throw new Error("push_not_supported");

  await requestPushPermission();
  const registration = await registerPushServiceWorker();
  const { publicKey, enabled } = await getVapidPublicKey();
  if (!enabled || !publicKey) throw new Error("push_disabled");

  let subscription = await registration.pushManager.getSubscription();
  let createdNow = false;
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    createdNow = true;
  }

  try {
    return await pushApi("/api/push/subscribe", {
      method: "POST",
      body: {
        subscription: subscription.toJSON(),
        deviceLabel: deviceLabel || navigator.userAgent,
        setupCode,
      },
    });
  } catch (error) {
    if (createdNow) await subscription.unsubscribe().catch(() => {});
    throw error;
  }
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) throw new Error("push_not_supported");
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return { ok: true, deactivated: false };
  const result = await pushApi("/api/push/unsubscribe", {
    method: "POST",
    body: { endpoint: subscription.endpoint },
  });
  await subscription.unsubscribe();
  return result;
}

export function sendTestPush({ title = "New Store", body = "Teste controlado de Push.", url = "/me" } = {}) {
  return pushApi("/api/push/test", { method: "POST", body: { title, body, url } });
}

export function sendSingleDeviceTestPush({ title = "New Store", body = "Teste controlado de Push.", url = "/me" } = {}) {
  return pushApi("/api/push/test-single-device", { method: "POST", body: { title, body, url } });
}

export function sendAdminSingleDeviceTestPush({ title, body, url = "/me" }) {
  return pushApi("/api/admin/notifications/push/test-single-device", {
    method: "POST",
    body: { title, body, url },
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
