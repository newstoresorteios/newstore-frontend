// src/services/me.js
import { apiJoin, authHeaders } from "../lib/api";

async function doFetch(path, opts = {}) {
  const r = await fetch(apiJoin(path), {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(opts.headers || {}) },
    credentials: "omit",
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    const e = new Error(txt || `${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

export async function getMyReservations() {
  const json = await doFetch("/me/reservations");
  return json.reservations || [];
}
