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

function normalizeList(data, keys = ["items", "dispatches", "inbound", "messages", "templates"]) {
  if (Array.isArray(data)) return data;
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

export async function getNotificationHealth() {
  return getJSON("/admin/notifications/health");
}

export async function listNotificationDispatches(params = {}) {
  const data = await getJSON(`/admin/notifications/dispatches${buildQuery(params)}`);
  return normalizeList(data, ["dispatches", "items"]);
}

export async function listInboundMessages(params = {}) {
  const data = await getJSON(`/admin/notifications/inbound${buildQuery(params)}`);
  return normalizeList(data, ["inbound", "messages", "items"]);
}

export async function listNotificationTemplates() {
  const data = await getJSON("/admin/notifications/templates");
  return normalizeList(data, ["templates", "items"]);
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
