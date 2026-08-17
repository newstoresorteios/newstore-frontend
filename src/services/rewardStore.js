// src/services/rewardStore.js
//
// Loja de Premios — cliente da API NewStore.
//
// O navegador NUNCA fala com a Tray. Todas as chamadas vao para o backend
// NewStore, que e quem consulta a Tray (somente leitura).

import { getJSON, postJSON, patchJSON } from "../lib/api";

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || String(value).trim() === "") return;
    qs.set(key, String(value));
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/**
 * NSCreditos e digitado manualmente pelo admin: inteiro positivo.
 * Sem conversao com preco Tray, reais ou qualquer outro valor do sistema.
 * Retorna o inteiro, ou null quando a entrada nao e valida.
 */
export function parseNsCreditsInput(value) {
  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/* ─────────────────────────── Admin ─────────────────────────── */

/** Catalogo real da Tray, paginado pelo backend. */
export function listTrayProducts({ page = 1, limit = 20, q = "", qField = "auto", available = "", brand = "" } = {}) {
  return getJSON(`/admin/store/tray-products${buildQuery({ page, limit, q, qField, available, brand })}`);
}

/** Detalhe de um produto Tray (inclui variacoes). Usado no modal. */
export function getTrayProduct(trayProductId) {
  return getJSON(`/admin/store/tray-products/${encodeURIComponent(String(trayProductId))}`);
}

/** Marcas da Tray — uma chamada, usada para popular o filtro. */
export function listTrayBrands() {
  return getJSON("/admin/store/tray-brands");
}

/** Status da integracao Tray + numeros do catalogo curado (aba Configuracoes). */
export function getStoreStatus() {
  return getJSON("/admin/store/status");
}

/** Produtos publicados. Le somente o PostgreSQL: funciona com a Tray fora do ar. */
export function listPublishedProducts({ page = 1, limit = 100 } = {}) {
  return getJSON(`/admin/store/products${buildQuery({ page, limit })}`);
}

/**
 * Publica um lote.
 * Envia SOMENTE a intencao administrativa — o backend reconsulta a Tray.
 */
export function publishProducts(products) {
  return postJSON("/admin/store/products/publish", {
    products: products.map(({ tray_product_id, nscredits_price }) => ({
      tray_product_id: String(tray_product_id),
      nscredits_price: Number(nscredits_price),
    })),
  });
}

/** Altera apenas propriedades da NewStore. */
export function patchProduct(trayProductId, patch) {
  return patchJSON(`/admin/store/products/${encodeURIComponent(String(trayProductId))}`, patch);
}

/** Comanda a releitura da Tray e a atualizacao do snapshot local. */
export function syncProducts(trayProductIds = null) {
  const body = Array.isArray(trayProductIds) && trayProductIds.length
    ? { tray_product_ids: trayProductIds.map(String) }
    : {};
  return postJSON("/admin/store/products/sync", body);
}

/* ─────────────────────────── Publico ─────────────────────────── */

/** Catalogo de `/loja`. Somente produtos publicados, direto do PostgreSQL. Paginado. */
export function listPublicProducts({ page, limit } = {}) {
  return getJSON(`/store/products${buildQuery({ page, limit })}`);
}

/* ─────────────────────────── Erros ─────────────────────────── */

/** `lib/api` lanca Error("codigo:status") ou Error("status"). */
export function parseApiError(error) {
  const raw = String(error?.message || "");
  const parts = raw.split(":");
  const status = Number(parts[parts.length - 1]);
  const code = parts.length > 1 ? parts.slice(0, -1).join(":") : "";
  return { code, status: Number.isFinite(status) ? status : 0 };
}

const MESSAGES = {
  unauthorized: "Sua sessao expirou. Faca login novamente.",
  forbidden: "Acesso restrito a administradores.",

  tray_rate_limited: "Limite de requisicoes da Tray atingido. Aguarde alguns instantes e tente de novo.",
  tray_timeout: "A Tray demorou demais para responder. Tente novamente.",
  tray_unreachable: "Nao foi possivel falar com a Tray agora.",
  tray_unavailable: "A Tray esta temporariamente indisponivel.",
  tray_auth_failed: "A integracao com a Tray precisa ser reautorizada no backend.",
  tray_invalid_response: "A Tray respondeu em um formato inesperado.",
  tray_request_failed: "A Tray recusou a consulta.",
  tray_product_not_found: "Produto nao encontrado na Tray.",
  tray_product_mismatch: "A Tray devolveu um produto diferente do solicitado.",

  invalid_nscredits_price: "NSCreditos deve ser um numero inteiro maior que zero.",
  invalid_tray_product_id: "Produto invalido na selecao.",
  empty_batch: "Selecione ao menos um produto.",
  batch_too_large: "Selecione no maximo 50 produtos por vez.",
  duplicate_tray_product_id: "Ha produto repetido na selecao.",
  invalid_patch_field: "Esse campo nao pode ser alterado pela NewStore.",
  invalid_display_order: "A ordem de exibicao deve ser um inteiro maior ou igual a zero.",
  invalid_is_published: "Estado de publicacao invalido.",
  empty_patch: "Nada para alterar.",

  reward_product_not_found: "Esse produto nao esta na loja.",
  reward_product_conflict: "Conflito de publicacao. Atualize a lista e tente de novo.",
  reward_product_constraint_violation: "Os dados enviados nao passaram na validacao do banco.",
  store_catalog_unavailable: "Nao foi possivel carregar o catalogo da loja.",
};

const BY_STATUS = {
  401: MESSAGES.unauthorized,
  403: MESSAGES.forbidden,
  404: "Nao encontrado.",
  409: MESSAGES.reward_product_conflict,
  429: MESSAGES.tray_rate_limited,
  502: "A integracao com a Tray falhou.",
  503: MESSAGES.tray_unavailable,
};

/** Mensagem tratada por tipo de erro — Tray indisponivel != sessao expirada. */
export function describeApiError(error, fallback = "Nao foi possivel completar a operacao.") {
  const { code, status } = parseApiError(error);
  return MESSAGES[code] || BY_STATUS[status] || fallback;
}

/** Erros em que faz sentido oferecer "tentar de novo". */
export function isRecoverableError(error) {
  const { code, status } = parseApiError(error);
  if ([429, 502, 503, 504].includes(status)) return true;
  return ["tray_rate_limited", "tray_timeout", "tray_unreachable", "tray_unavailable", "tray_invalid_response"].includes(code);
}

/** Sessao expirada / sem permissao — o usuario precisa reautenticar. */
export function isAuthError(error) {
  const { code, status } = parseApiError(error);
  return status === 401 || status === 403 || code === "unauthorized" || code === "forbidden";
}
