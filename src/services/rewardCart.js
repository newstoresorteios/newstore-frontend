// src/services/rewardCart.js
//
// Carrinho da Loja de Premios — cliente da API NewStore.
//
// O backend/PostgreSQL e a AUTORIDADE do carrinho. O estado do React serve
// apenas como cache de UI: o carrinho sobrevive a refresh e a novo login.
//
// Nada aqui cria carrinho ou pedido na Tray, nem debita NSCreditos.

import { getJSON, postJSON, patchJSON, delJSON } from "../lib/api";

/** Detalhe publico de um produto publicado (somente PostgreSQL no backend). */
export function getPublicProduct(trayProductId) {
  return getJSON(`/store/products/${encodeURIComponent(String(trayProductId))}`);
}

export function getCart() {
  return getJSON("/store/cart");
}

/**
 * Adiciona um item.
 * Envia SOMENTE a intencao — preco, nome e imagem vem do backend.
 */
export function addCartItem({ rewardProductId, trayVariantId = null, quantity = 1 }) {
  return postJSON("/store/cart/items", {
    reward_product_id: rewardProductId,
    tray_variant_id: trayVariantId,
    quantity: Number(quantity),
  });
}

export function updateCartItem(itemId, quantity) {
  return patchJSON(`/store/cart/items/${encodeURIComponent(String(itemId))}`, {
    quantity: Number(quantity),
  });
}

export function removeCartItem(itemId) {
  return delJSON(`/store/cart/items/${encodeURIComponent(String(itemId))}`);
}

export function clearCart() {
  return delJSON("/store/cart");
}

/** Pre-validacao: NAO cria pedido, NAO debita, NAO altera a Tray. */
export function validateCart() {
  return postJSON("/store/cart/validate", {});
}

/* ─────────────────────────── Helpers ─────────────────────────── */

export function parseQuantityInput(value) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 1 ? value : null;
  }
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/** Contador do header: quantidade de ITENS DISTINTOS (regra fixa e consistente). */
export function cartBadgeCount(cart) {
  return Array.isArray(cart?.items) ? cart.items.length : 0;
}

/** Uma variacao so pode ser escolhida se a Tray a marcar como disponivel. */
export function isVariantSelectable(variant) {
  if (!variant) return false;
  if (variant.is_available === false) return false;
  if (variant.tray_available === 0) return false;
  return true;
}

export function variantLabel(variant) {
  if (!variant) return "";
  const values = Array.isArray(variant.values) ? variant.values : [];
  const label = values
    .map((v) => [v?.type, v?.value].filter(Boolean).join(": "))
    .filter(Boolean)
    .join(" · ");
  return label || variant.reference || (variant.variant_id ? `#${variant.variant_id}` : "");
}

/* ─────────────────────────── Erros / problemas ─────────────────────────── */

/** Mensagens por CODIGO estavel — o contrato nunca e o texto humano. */
export const ISSUE_MESSAGES = {
  cart_empty: "Seu carrinho está vazio.",
  product_not_found: "Produto não encontrado.",
  product_not_published: "Este produto não está mais disponível na Loja de Prêmios.",
  product_not_found_tray: "Este produto não foi encontrado no catálogo.",
  product_unavailable: "Este produto está indisponível no momento.",
  variant_required: "Escolha uma opção antes de continuar.",
  variant_not_found: "A opção escolhida não existe mais.",
  variant_not_belongs_to_product: "A opção escolhida não pertence a este produto.",
  variant_unavailable: "A opção escolhida está indisponível.",
  insufficient_stock: "Estoque insuficiente para a quantidade escolhida.",
  price_changed: "O valor deste produto foi atualizado.",
  insufficient_nscredits: "Saldo de NSCréditos insuficiente.",
  tray_unavailable: "Não foi possível confirmar a disponibilidade agora. Tente de novo.",
  wallet_unavailable: "Não foi possível consultar seu saldo agora.",

  invalid_quantity: "Quantidade inválida.",
  cart_item_not_found: "Item não encontrado no seu carrinho.",
  cart_item_conflict: "Este item já está no seu carrinho.",
  unauthorized: "Entre na sua conta para usar o carrinho.",
};

export function describeIssue(code, fallback = "Não foi possível completar a operação.") {
  return ISSUE_MESSAGES[code] || fallback;
}

export function parseApiError(error) {
  const raw = String(error?.message || "");
  const parts = raw.split(":");
  const status = Number(parts[parts.length - 1]);
  const code = parts.length > 1 ? parts.slice(0, -1).join(":") : "";
  return { code, status: Number.isFinite(status) ? status : 0 };
}

export function describeCartError(error, fallback = "Não foi possível completar a operação.") {
  const { code, status } = parseApiError(error);
  if (ISSUE_MESSAGES[code]) return ISSUE_MESSAGES[code];
  if (status === 401) return ISSUE_MESSAGES.unauthorized;
  if (status === 503) return ISSUE_MESSAGES.tray_unavailable;
  return fallback;
}

/** Sessao expirada / visitante — o fluxo deve mandar para o login existente. */
export function isAuthError(error) {
  const { code, status } = parseApiError(error);
  return status === 401 || code === "unauthorized";
}
