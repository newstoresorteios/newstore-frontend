// src/lib/api.js
const RAW_BASE =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_BASE ||
  "";

const ROOT = String(RAW_BASE).replace(/\/+$/, "");
const API_BASE =
  ROOT === "" ? "/api" : /\/api$/i.test(ROOT) ? ROOT : `${ROOT}/api`;

export const apiJoin = (path) => {
  const p = path.startsWith("/") ? path : `/${path}`;
  // se API_BASE termina com /api e o path começa com /api/... -> tira um /api
  const dedup = API_BASE.endsWith("/api") && p.startsWith("/api/")
    ? p.slice(4)
    : p;
  return `${API_BASE}${dedup}`;
};

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

async function request(pathOrUrl, opts = {}) {
  const url = /^https?:\/\//i.test(pathOrUrl) ? pathOrUrl : apiJoin(pathOrUrl);
  const r = await fetch(url, {
    method: opts.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
      ...authHeaders(),
    },
    credentials: "omit",
    body: opts.body
      ? typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body)
      : undefined,
  });
  if (!r.ok) {
    let err = `${r.status}`;
    try {
      const j = await r.json();
      err = j?.error ? `${j.error}:${r.status}` : err;
    } catch {}
    throw new Error(err);
  }
  const ct = r.headers.get("content-type") || "";
  return ct.includes("application/json") ? r.json() : r.text();
}

export const getJSON = (path, opts = {}) => request(path, { ...opts, method: "GET" });
export const postJSON = (path, body, opts = {}) => request(path, { ...opts, method: "POST", body });
export const putJSON  = (path, body, opts = {}) => request(path, { ...opts, method: "PUT",  body });
export const delJSON  = (path, opts = {})       => request(path, { ...opts, method: "DELETE"    });
