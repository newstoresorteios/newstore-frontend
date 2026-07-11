import { apiJoin, authHeaders, getJSON, patchJSON, postJSON } from "../lib/api";

export function listAdminCaptives(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      qs.set(key, String(value));
    }
  });
  return getJSON(`/admin/captives${qs.toString() ? `?${qs.toString()}` : ""}`);
}

export function updateAdminCaptiveParticipation(id, active) {
  return patchJSON(`/admin/captives/${encodeURIComponent(String(id))}/participation`, {
    active: active === true,
  });
}

export function updateAdminCaptiveAuthorizationMode(id, authorizationMode) {
  return patchJSON(`/admin/captives/${encodeURIComponent(String(id))}/authorization-mode`, {
    authorization_mode: authorizationMode === true,
  });
}

export function updateCaptivePreauthNotifications(id, enabled) {
  return patchJSON(`/admin/captives/${encodeURIComponent(String(id))}/preauth-notifications`, {
    preauth_notifications_enabled: enabled === true,
  });
}

export function getAdminCaptivesCurrentDraw() {
  return getJSON("/admin/dashboard/summary");
}

export function listCaptiveNotificationHistory(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      qs.set(key, String(value));
    }
  });
  return getJSON(`/admin/captives/notification-history${qs.toString() ? `?${qs.toString()}` : ""}`);
}

export function listCurrentDrawCaptiveParticipation(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      qs.set(key, String(value));
    }
  });
  return getJSON(`/admin/captives/current-draw-participation${qs.toString() ? `?${qs.toString()}` : ""}`);
}

export function isDatabaseMigrationRequiredError(error) {
  return String(error?.message || "").includes("database_migration_required");
}

export function updateCurrentDrawCaptiveParticipation(id, enabled, reason) {
  return patchJSON(`/admin/captives/current-draw-participation/${encodeURIComponent(String(id))}`, {
    enabled: enabled === true,
    reason: String(reason || "").trim(),
  });
}

export async function authorizeCurrentDrawCaptiveParticipation(authorizationId, drawId) {
  const response = await fetch(
    apiJoin(`/admin/captives/current-draw-participation/${encodeURIComponent(String(authorizationId))}/authorize`),
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "omit",
      body: JSON.stringify({ draw_id: Number(drawId) }),
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const requestError = new Error(payload?.message || payload?.error || String(response.status));
    requestError.status = response.status;
    requestError.error = payload?.error || null;
    requestError.reason = payload?.reason || null;
    requestError.responseMessage = payload?.message || null;
    throw requestError;
  }
  return payload;
}

export function reissueAndResendCaptivePreauths() {
  return postJSON("/admin/captive-preauth/current-draw/reissue-and-resend", {
    confirmation: "REEMITIR",
  });
}
