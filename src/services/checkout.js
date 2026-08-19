// src/services/checkout.js
//
// Fechamento do resgate da Loja de Premios: endereco + prepare/confirm.
//
// O navegador NUNCA fala com a Tray -- tudo passa pelo backend NewStore,
// que e quem decide se o resgate pode avancar. FRETE ESTA FORA DO ESCOPO
// (responsabilidade da Tray) -- nada aqui cota, cobra ou escolhe frete.

import { getJSON, postJSON, delJSON } from "../lib/api";

/** Saldo + enderecos salvos, numa unica chamada (bootstrap da tela). */
export function getCheckoutBootstrap() {
  return getJSON("/store/checkout");
}

export function listAddresses() {
  return getJSON("/store/checkout/addresses");
}

export function createAddress(input) {
  return postJSON("/store/checkout/addresses", input);
}

export function deleteAddress(addressId) {
  return delJSON(`/store/checkout/addresses/${encodeURIComponent(String(addressId))}`);
}

/** Resumo de confirmacao -- NUNCA debita, NUNCA cria pedido. */
export function prepareRedemption(addressId) {
  return postJSON("/store/redemptions/prepare", { address_id: addressId });
}

/**
 * O UNICO ponto que debita e cria o pedido Tray real.
 * idempotencyKey precisa ser gerada UMA vez por tentativa de confirmacao e
 * reenviada IDENTICA em qualquer retry -- nunca gerar uma nova a cada clique
 * nem a cada nova chamada desta funcao.
 */
export function confirmRedemption(addressId, idempotencyKey) {
  return postJSON("/store/redemptions/confirm", {
    address_id: addressId,
    idempotency_key: idempotencyKey,
  });
}

export function makeIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `redeem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ─────────────────────────── Erros ─────────────────────────── */

function parseError(error) {
  const raw = String(error?.message || "");
  const parts = raw.split(":");
  const status = Number(parts[parts.length - 1]);
  const code = parts.length > 1 ? parts.slice(0, -1).join(":") : "";
  return { code, status: Number.isFinite(status) ? status : 0 };
}

const MESSAGES = {
  reward_redemption_disabled: "O resgate por NSCréditos ainda não está disponível.",
  address_not_found: "Selecione um endereço válido para continuar.",
  cart_empty: "Seu carrinho está vazio.",
  // cart_invalid perde o detalhe do issue especifico na camada de erro (lib/api
  // so preserva codigo+status) -- a validacao detalhada ja acontece antes,
  // na tela de carrinho/revisao, via /store/cart/validate. Se isso aparecer
  // aqui mesmo assim, e uma corrida rara (algo mudou entre a revisao e o
  // clique) -- mandar revisar de novo e a resposta correta.
  cart_invalid: "Seu carrinho mudou desde a última revisão. Volte e confira os itens.",
  idempotency_key_required: "Não foi possível confirmar o resgate. Atualize a página e tente de novo.",
  idempotency_conflict: "Não foi possível confirmar o resgate. Atualize a página e tente de novo.",
  insufficient_balance: "Saldo de NSCréditos insuficiente.",
  coupon_expired: "Seu cupom de NSCréditos está vencido. Fale com o suporte para renovar.",
  invalid_recipient_name: "Informe o nome do destinatário.",
  invalid_zipcode: "CEP inválido.",
  invalid_street: "Informe o endereço.",
  invalid_number: "Informe o número.",
  invalid_neighborhood: "Informe o bairro.",
  invalid_city: "Informe a cidade.",
  invalid_state: "Informe o estado.",
};

export function describeCheckoutError(error, fallback = "Não foi possível concluir o resgate agora.") {
  const { code, status } = parseError(error);
  if (MESSAGES[code]) return MESSAGES[code];
  if (status === 401) return "Sua sessão expirou. Faça login novamente.";
  if (status === 503) return MESSAGES.reward_redemption_disabled;
  return fallback;
}

export function isCheckoutAuthError(error) {
  const { code, status } = parseError(error);
  return status === 401 || code === "unauthorized";
}

/**
 * Kill-switch do lado do cliente -- espelha REWARD_REDEMPTION_ENABLED do
 * backend. Default SEGURO "false": o backend recusa de qualquer forma, mas
 * a UI so oferece o fluxo quando os dois lados concordarem explicitamente.
 */
export function isRewardRedemptionEnabled() {
  return String(process.env.REACT_APP_REWARD_REDEMPTION_ENABLED || "").trim().toLowerCase() === "true";
}
