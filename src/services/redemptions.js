// src/services/redemptions.js
//
// "Meus Pedidos" — GET /api/store/redemptions. Somente leitura.
//
// O fechamento real do resgate (prepare/confirm) vive em services/checkout.js
// — este arquivo so LISTA o que ja existe.

import { getJSON } from "../lib/api";

export function listMyRedemptions({ page = 1, limit = 20 } = {}) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  return getJSON(`/store/redemptions?${qs.toString()}`);
}

export function getMyRedemption(id) {
  return getJSON(`/store/redemptions/${encodeURIComponent(String(id))}`);
}

/**
 * Acompanhamento logistico do pedido na Tray — SOB DEMANDA.
 *
 * A listagem de "Meus Pedidos" nunca chama isto: seria uma consulta externa
 * por pedido. So e chamado quando o cliente pede para acompanhar um pedido
 * especifico. O backend confere a posse do resgate e le o tray_order_id do
 * banco — o navegador nunca informa numero de pedido.
 */
export function getMyRedemptionTrayStatus(id) {
  return getJSON(`/store/redemptions/${encodeURIComponent(String(id))}/tray-status`);
}

/* ─────────────────────── Logistica (dominio da Tray) ─────────────────────── */

// O status do RESGATE (NewStore) e a logistica (Tray) sao dominios separados
// e nunca se misturam: "Resgate confirmado" continua verdadeiro mesmo quando
// a consulta de acompanhamento falha.
//
// So existem as fases que a Tray comprova. Nao ha fase "entregue": os campos
// de entrega da Tray vem vazios ate em pedidos finalizados.
const LOGISTICS_LABELS = {
  received: "Pedido recebido pela Tray",
  shipped: "Pedido enviado",
  canceled: "Pedido cancelado",
};

export function describeLogisticsPhase(phase, fallbackLabel = "") {
  return LOGISTICS_LABELS[phase] || fallbackLabel || "Acompanhamento indisponível";
}

/** Mensagem do bloco de acompanhamento quando nao ha o que mostrar. */
export function describeTrackingUnavailable(payload) {
  if (payload?.temporarily_unavailable) {
    return "Não foi possível atualizar o acompanhamento agora. Seu resgate continua registrado normalmente.";
  }
  if (payload?.reason === "tray_order_not_created") {
    return "Este resgate ainda não gerou pedido de entrega.";
  }
  return "Acompanhamento indisponível no momento.";
}

const STATUS_LABELS = {
  processing: "Processando",
  credits_reserved: "Créditos reservados",
  tray_order_pending: "Enviando pedido",
  tray_order_created: "Pedido criado",
  confirmed: "Confirmado",
  failed: "Falhou (créditos devolvidos)",
  compensated: "Cancelado (créditos devolvidos)",
  reconciliation_required: "Em verificação",
  blocked_tray_contract_pending: "Aguardando liberação do resgate real",
  blocked_tray_customer_unmapped: "Não foi possível localizar seu cadastro (créditos devolvidos)",
};

export function describeRedemptionStatus(status) {
  return STATUS_LABELS[status] || status || "—";
}

const FINAL_NEGATIVE_STATUSES = new Set([
  "failed",
  "compensated",
  "blocked_tray_contract_pending",
  "blocked_tray_customer_unmapped",
]);
const FINAL_POSITIVE_STATUSES = new Set(["tray_order_created", "confirmed"]);

export function redemptionStatusSeverity(status) {
  if (FINAL_POSITIVE_STATUSES.has(status)) return "success";
  if (FINAL_NEGATIVE_STATUSES.has(status)) return "warning";
  if (status === "reconciliation_required") return "info";
  return "default";
}
