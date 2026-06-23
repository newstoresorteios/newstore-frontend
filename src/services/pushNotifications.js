import { getJSON, postJSON, putJSON } from "../lib/api";

export function isPushSupported() {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getNotificationPermission() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestPushPermission() {
  if (!("Notification" in window)) {
    throw new Error("push_not_supported");
  }
  return Notification.requestPermission();
}

let swRegistrationPromise = null;

export async function registerPushServiceWorker() {
  if (!isPushSupported()) throw new Error("push_not_supported");
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker.register("/push-sw.js");
  }
  return swRegistrationPromise;
}

export async function getPushConfig() {
  return getJSON("/push/config");
}

export async function getPushPreferences() {
  return getJSON("/push/preferences");
}

export async function updatePushPreferences({ push_operational_opt_in, push_marketing_opt_in }) {
  return putJSON("/push/preferences", {
    push_operational_opt_in,
    push_marketing_opt_in,
  });
}

export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function subscriptionPayload(subscription) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint,
    keys: json.keys,
    expirationTime: json.expirationTime ?? null,
  };
}

export async function subscribeToPush({ deviceLabel } = {}) {
  if (!isPushSupported()) throw new Error("push_not_supported");

  const config = await getPushConfig();
  const enabled = config?.enabled ?? config?.push_enabled;
  const publicKey = config?.publicKey ?? config?.public_key ?? config?.vapid_public_key;

  if (!enabled || !publicKey) {
    throw new Error("push_disabled");
  }

  const registration = await registerPushServiceWorker();
  const permission = await requestPushPermission();

  if (permission !== "granted") {
    throw new Error("push_permission_not_granted");
  }

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await postJSON("/push/subscribe", {
    subscription: subscriptionPayload(subscription),
    deviceLabel: deviceLabel || defaultDeviceLabel(),
  });

  return subscription;
}

export async function unsubscribeFromPush() {
  if (!isPushSupported()) throw new Error("push_not_supported");

  const registration = await registerPushServiceWorker();
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) return null;

  const endpoint = subscription.endpoint;
  if (endpoint) {
    await postJSON("/push/unsubscribe", { endpoint });
  }

  await subscription.unsubscribe();
  return true;
}

export async function sendSelfTestPush() {
  return postJSON("/push/test", {});
}

export async function sendAdminTestPush({ user_id, title, body, url, category }) {
  return postJSON("/admin/notifications/push/test", {
    user_id,
    title,
    body,
    url,
    category,
  });
}

export async function getAdminPushTestStatus() {
  return getJSON("/admin/notifications/push/test-status");
}

export async function getLocalPushSubscription() {
  if (!isPushSupported()) return null;
  try {
    const registration = await registerPushServiceWorker();
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

function defaultDeviceLabel() {
  const ua = String(navigator.userAgent || "");
  if (/iPhone|iPad/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac/i.test(ua)) return "Mac";
  return "Browser";
}

export function parsePushError(err) {
  const raw = String(err?.message || err || "");
  const code = raw.split(":")[0];
  const messages = {
    push_not_supported: "Este navegador não suporta notificações push.",
    push_disabled: "Notificações push estão desabilitadas no servidor.",
    push_permission_not_granted: "Permissão de notificação não concedida.",
    push_not_allowed_user: "Usuário não permitido para testes de push.",
    push_test_mode_blocked: "Envio bloqueado: modo teste ativo.",
  };
  return messages[code] || raw || "Erro desconhecido.";
}
