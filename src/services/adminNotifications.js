// src/services/adminNotifications.js
import { apiJoin, authHeaders, getJSON, patchJSON, postJSON } from "../lib/api";

function buildQuery(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") usp.set(k, String(v));
  });
  const q = usp.toString();
  return q ? `?${q}` : "";
}

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
    "recipients",
    "dispatches",
    "templates",
    "inbound",
    "messages",
    "events",
  ];

  for (const key of allKeys) {
    if (Array.isArray(data[key])) return data[key];
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
    hasRecipients: Array.isArray(data?.recipients),
    hasDispatches: Array.isArray(data?.dispatches),
    hasTemplates: Array.isArray(data?.templates),
    hasInbound: Array.isArray(data?.inbound),
    hasMessages: Array.isArray(data?.messages),
    hasEvents: Array.isArray(data?.events),
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

export async function listPushLogs(params = {}) {
  return apiGet("/api/admin/push/logs", params);
}

export async function getPushSummary() {
  return apiGet("/api/admin/push/summary");
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

export async function syncBrevoWhatsAppTemplates() {
  return postJSON("/admin/notifications/templates/sync-brevo-whatsapp", {});
}

function buildBrevoEventsQuery(params = {}) {
  const query = {};
  if (params.contactNumber) query.contactNumber = String(params.contactNumber).trim();
  if (params.days != null && params.days !== "") query.days = params.days;
  if (params.limit != null && params.limit !== "") query.limit = params.limit;
  if (params.offset != null && params.offset !== "") query.offset = params.offset;
  if (params.event) query.event = params.event;
  return query;
}

export async function getBrevoWhatsAppEvents(params = {}) {
  const data = await apiGet(
    "/api/admin/notifications/brevo-whatsapp-events",
    buildBrevoEventsQuery(params)
  );
  const list = extractList(data, ["events", "rows", "items"]);
  debugListResponse("brevo-whatsapp-events response", data, list);
  return list;
}

export async function syncDispatchDeliveryStatus(dispatchId) {
  const id = encodeURIComponent(String(dispatchId));
  return postJSON(`/admin/notifications/dispatches/${id}/sync-delivery-status`, {});
}

export async function searchNotificationRecipients(query, limit = 20) {
  const data = await apiGet("/api/admin/notifications/recipients/search", {
    q: query,
    limit,
  });
  const list = extractList(data, ["rows", "recipients", "items"]);
  debugListResponse("recipients search response", data, list);
  return list;
}

export async function updateNotificationTemplate(id, payload) {
  const tid = encodeURIComponent(String(id));
  return patchJSON(`/admin/notifications/templates/${tid}`, payload);
}

export async function manualSendSelectedNotification(payload) {
  return postJSON("/admin/notifications/manual-send-selected", payload);
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

export async function exportNotificationDispatchesCsv(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.channel) query.set("channel", params.channel);
  if (params.provider) query.set("provider", params.provider);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);

  const qs = query.toString();
  const url = apiJoin(`/admin/notifications/dispatches/export.csv${qs ? `?${qs}` : ""}`);

  const res = await fetch(url, {
    method: "GET",
    headers: { ...authHeaders() },
    credentials: "omit",
  });

  if (!res.ok) {
    throw new Error("Erro ao exportar CSV de disparos.");
  }

  const blob = await res.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = `notification-dispatches-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(downloadUrl);
}
