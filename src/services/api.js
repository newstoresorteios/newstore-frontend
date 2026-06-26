import { apiJoin, authHeaders } from "../lib/api";

export async function api(path, { method = "GET", body, params } = {}) {
  const basePath = params ? `${path}?${new URLSearchParams(params).toString()}` : path;
  const url = /^https?:\/\//i.test(basePath) ? basePath : apiJoin(basePath);
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (res.status === 401) {
    const t = await res.text().catch(() => "");
    throw new Error(`401 Unauthorized: ${t}`);
  }
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}
