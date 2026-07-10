import { getJSON, patchJSON, postJSON } from "../lib/api";

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

export function reissueAndResendCaptivePreauths(drawId) {
  return postJSON(`/admin/captive-preauth/draws/${encodeURIComponent(String(drawId))}/reissue-and-resend`, {
    confirmation: "REEMITIR",
  });
}
