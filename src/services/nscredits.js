// src/services/nscredits.js
//
// Carteira de NSCreditos — cliente da API NewStore.
//
// O cliente publico apenas LE o proprio saldo. Nao existe endpoint de debito
// para o navegador: o debito futuro de resgate acontecera no backend.

import { getJSON, postJSON } from "../lib/api";

/** Saldo da carteira do usuario autenticado. */
export function getMyNsCredits() {
  return getJSON("/me/nscredits");
}

/* ─────────────────────────── Admin ─────────────────────────── */

export function searchNsCreditUsers({ q = "", page = 1, limit = 20 } = {}) {
  const qs = new URLSearchParams();
  if (String(q ?? "").trim()) qs.set("q", String(q).trim());
  qs.set("page", String(page));
  qs.set("limit", String(limit));
  return getJSON(`/admin/store/nscredits/users?${qs.toString()}`);
}

export function getNsCreditWallet(userId, { page = 1, limit = 20 } = {}) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  return getJSON(`/admin/store/nscredits/users/${encodeURIComponent(String(userId))}?${qs.toString()}`);
}

/**
 * Movimentacao administrativa.
 * `created_by` NUNCA e enviado: o backend usa o admin autenticado.
 */
export function applyNsCreditAdjustment(userId, { operation, amount, reason, idempotencyKey }) {
  return postJSON(`/admin/store/nscredits/users/${encodeURIComponent(String(userId))}/transactions`, {
    operation,
    amount: Number(amount),
    reason: String(reason ?? "").trim(),
    idempotency_key: idempotencyKey,
  });
}

/* ─────────────────────────── Helpers ─────────────────────────── */

/** Chave idempotente por operacao. Usa a API nativa quando disponivel. */
export function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback sem dependencia externa: aleatorio + contador, nunca so timestamp.
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `ns-${rand()}${rand()}-${rand()}`;
}

/** NSCreditos sao inteiros positivos. Retorna o inteiro ou null. */
export function parseNsCreditAmountInput(value) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/**
 * 8450 -> "8.450". Sem casas decimais.
 * Ausencia de valor NAO vira "0": zero e um saldo, ausencia nao.
 */
export function formatNsCredits(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return Math.trunc(n).toLocaleString("pt-BR");
}

/* ─────────────────────────── Erros ─────────────────────────── */

const MESSAGES = {
  unauthorized: "Sua sessao expirou. Faca login novamente.",
  forbidden: "Acesso restrito a administradores.",

  invalid_amount: "A quantidade deve ser um numero inteiro maior que zero.",
  amount_out_of_range: "Quantidade fora da faixa permitida.",
  invalid_operation: "Operacao invalida.",
  invalid_user_id: "Cliente invalido.",
  reason_required: "Informe o motivo da movimentacao.",
  reason_too_long: "O motivo e longo demais (maximo 300 caracteres).",
  admin_required: "Somente administradores podem movimentar NSCreditos.",

  insufficient_balance: "Saldo insuficiente para esse debito.",
  user_not_found: "Cliente nao encontrado.",
  idempotency_conflict: "Essa operacao ja foi registrada.",
  wallet_constraint_violation: "A movimentacao nao passou na validacao do banco.",
  balance_out_of_range: "Saldo fora da faixa suportada. Fale com o suporte tecnico.",
  nscredits_failed: "Nao foi possivel consultar a carteira agora.",
};

const BY_STATUS = {
  401: MESSAGES.unauthorized,
  403: MESSAGES.forbidden,
  404: MESSAGES.user_not_found,
  409: "Conflito ao registrar a movimentacao.",
  500: "Erro interno ao processar a movimentacao.",
};

export function parseApiError(error) {
  const raw = String(error?.message || "");
  const parts = raw.split(":");
  const status = Number(parts[parts.length - 1]);
  const code = parts.length > 1 ? parts.slice(0, -1).join(":") : "";
  return { code, status: Number.isFinite(status) ? status : 0 };
}

export function describeNsCreditError(error, fallback = "Nao foi possivel completar a operacao.") {
  const { code, status } = parseApiError(error);
  return MESSAGES[code] || BY_STATUS[status] || fallback;
}
