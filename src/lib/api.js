// src/lib/api.js
// Util de API para o frontend (React) — robusto contra /api duplicado

const RAW_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_BASE ||
  "";

// remove barras finais
const ROOT = String(RAW_BASE || "").replace(/\/+$/, "");

// Base final: se informou e já termina com /api, mantém; se informou e NÃO termina, acrescenta /api;
// se não informou nada, usa '/api' (proxy/local)
const API_BASE = (() => {
  if (!ROOT) return "/api";
  return /\/api$/i.test(ROOT) ? ROOT : `${ROOT}/api`;
})();

/** Junta caminho com a base, removendo /api duplicado quando necessário */
export const apiJoin = (path) => {
  let p = path.startsWith("/") ? path : `/${path}`;
  // se a base termina com /api e o path começa com /api/, remove o /api inicial do path
  if (API_BASE.endsWith("/api") && p.startsWith("/api/")) p = p.slice(4);
  if (API_BASE.endsWith("/api") && p === "/api") p = ""; // evita .../api/api
  return `${API_BASE}${p}`;
};

/* ---------- token helpers ---------- */
const TOKEN_KEY = "ns_auth_token";
const COMPAT_KEYS = ["token", "access_token"];

export const getStoredToken = () =>
  (
    localStorage.getItem(TOKEN_KEY) ||
    sessionStorage.getItem(TOKEN_KEY) ||
    localStorage.getItem(COMPAT_KEYS[0]) ||
    localStorage.getItem(COMPAT_KEYS[1]) ||
    sessionStorage.getItem(COMPAT_KEYS[0]) ||
    sessionStorage.getItem(COMPAT_KEYS[1]) ||
    ""
  )
    .toString()
    .replace(/^Bearer\s+/i, "")
    .replace(/^["']|["']$/g, "");

export const authHeaders = () => {
  const t = getStoredToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/* ---------- HTTP helpers ---------- */
async function request(pathOrUrl, opts = {}) {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : apiJoin(pathOrUrl);
  const r = await fetch(url, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
      ...authHeaders(),
    },
    credentials: "omit", // usamos Authorization, não cookie
    body:
      opts.body == null
        ? undefined
        : typeof opts.body === "string"
        ? opts.body
        : JSON.stringify(opts.body),
  });
  if (!r.ok) {
    let err = `${r.status}`;
    try {
      const j = await r.json();
      if (j?.error) err = `${j.error}:${r.status}`;
    } catch {}
    throw new Error(err);
  }
  const ct = r.headers.get("content-type") || "";
  return ct.includes("application/json") ? r.json() : r.text();
}

export const getJSON = (path, opts = {}) => request(path, { ...opts, method: "GET" });
export const postJSON = (path, body, opts = {}) => request(path, { ...opts, method: "POST", body });
export const putJSON = (path, body, opts = {}) => request(path, { ...opts, method: "PUT", body });
export const delJSON = (path, opts = {}) => request(path, { ...opts, method: "DELETE" });
