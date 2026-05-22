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

/** GET admin notifications — path may be /api/admin/... or /admin/... (apiJoin normalizes). */
async function apiGet(path, params = {}) {
  let p = String(path || "");
  if (p.startsWith("/api/")) p = p.slice(4);
  if (!p.startsWith("/")) p = `/${p}`;
  return getJSON(`${p}${buildQuery(params)}`);
}

export function extractList(data, keys = []) {
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

  for (const key of allKeys) {
    const val = data[key];
    if (Array.isArray(val)) {
      return val;
    }
    if (val && typeof val === "object" && Array.isArray(val.rows)) {
      return val.rows;
    }
  }

  if (data.result && typeof data.result === "object") {
    const nested = extractList(data.result, keys);
    if (nested.length) return nested;
  }

  if (data.data && typeof data.data === "object") {
    const nested = extractList(data.data, keys);
    if (nested.length) return nested;
  }

  return [];
}

function debugListResponse(label, data, list) {
  console.log(`[adminNotifications.api] ${label}`, {
    rawType: Array.isArray(data) ? "array" : typeof data,
    hasRows: Array.isArray(data?.rows),
    hasItems: Array.isArray(data?.items),
    hasDispatches: Array.isArray(data?.dispatches),
    hasTemplates: Array.isArray(data?.templates),
    hasInbound: Array.isArray(data?.inbound),
    hasMessages: Array.isArray(data?.messages),
    rawCount: data?.count ?? null,
    extractedCount: Array.isArray(list) ? list.length : 0,
  });
}

export async function getNotificationHealth() {
  return apiGet("/api/admin/notifications/health");
}

export async function listNotificationDispatches(params = {}) {
  const data = await apiGet("/api/admin/notifications/dispatches", params);
  const list = extractList(data, ["rows", "dispatches", "items"]);
  debugListResponse("dispatches response", data, list);
  return list;
}

export async function listInboundMessages(params = {}) {
  const data = await apiGet("/api/admin/notifications/inbound", params);
  const list = extractList(data, ["rows", "inbound", "messages", "items"]);
  debugListResponse("inbound response", data, list);
  return list;
}

export async function listNotificationTemplates() {
  const data = await apiGet("/api/admin/notifications/templates");
  const list = extractList(data, ["rows", "templates", "items"]);
  debugListResponse("templates response", data, list);
  return list;
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
