// src/services/adminNotifications.js
import { getJSON, postJSON } from "../lib/api";

function buildQuery(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") usp.set(k, String(v));
  });
  const q = usp.toString();
  return q ? `?${q}` : "";
}

function normalizeList(data, keys = []) {
  if (Array.isArray(data)) return data;

  if (!data || typeof data !== "object") return [];

  const allKeys = [
    ...keys,
    "rows",
    "items",
    "dispatches",
    "templates",
    "inbound",
    "messages",
  ];

  const pick = (keyList) => {
    for (const key of keyList) {
      const val = data[key];
      if (Array.isArray(val) && val.length > 0) return val;
    }
    for (const key of keyList) {
      if (Array.isArray(data[key])) return data[key];
    }
    return null;
  };

  const found = pick(allKeys);
  if (found) return found;

  if (data.data && typeof data.data === "object") {
    return normalizeList(data.data, keys);
  }

  return [];
}

function logDispatchesResponse(data) {
  console.log("[adminNotifications.api] dispatches response", {
    isArray: Array.isArray(data),
    hasRows: Array.isArray(data?.rows),
    hasDispatches: Array.isArray(data?.dispatches),
    hasItems: Array.isArray(data?.items),
    count:
      data?.count ??
      data?.rows?.length ??
      data?.dispatches?.length ??
      data?.items?.length ??
      0,
  });
}

function logTemplatesResponse(data) {
  console.log("[adminNotifications.api] templates response", {
    isArray: Array.isArray(data),
    hasRows: Array.isArray(data?.rows),
    hasTemplates: Array.isArray(data?.templates),
    hasItems: Array.isArray(data?.items),
    count:
      data?.count ??
      data?.rows?.length ??
      data?.templates?.length ??
      data?.items?.length ??
      0,
  });
}

function logInboundResponse(data) {
  console.log("[adminNotifications.api] inbound response", {
    isArray: Array.isArray(data),
    hasRows: Array.isArray(data?.rows),
    hasInbound: Array.isArray(data?.inbound),
    hasMessages: Array.isArray(data?.messages),
    hasItems: Array.isArray(data?.items),
    count:
      data?.count ??
      data?.rows?.length ??
      data?.inbound?.length ??
      data?.messages?.length ??
      data?.items?.length ??
      0,
  });
}

export async function getNotificationHealth() {
  return getJSON("/admin/notifications/health");
}

export async function listNotificationDispatches(params = {}) {
  const data = await getJSON(`/admin/notifications/dispatches${buildQuery(params)}`);
  logDispatchesResponse(data);
  return normalizeList(data, ["rows", "dispatches", "items"]);
}

export async function listInboundMessages(params = {}) {
  const data = await getJSON(`/admin/notifications/inbound${buildQuery(params)}`);
  logInboundResponse(data);
  return normalizeList(data, ["rows", "inbound", "messages", "items"]);
}

export async function listNotificationTemplates() {
  const data = await getJSON("/admin/notifications/templates");
  logTemplatesResponse(data);
  return normalizeList(data, ["rows", "templates", "items"]);
}

export async function sendTestWhatsApp(payload) {
  return postJSON("/admin/notifications/test-whatsapp", payload);
}

export async function estimateAudience(payload) {
  return postJSON("/admin/notifications/audience/estimate", payload);
}

export async function manualSendNotification(payload) {
  return postJSON("/admin/notifications/manual-send", payload);
}
