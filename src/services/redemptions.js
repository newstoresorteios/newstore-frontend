// src/services/redemptions.js
//
// "Meus Pedidos" — GET /api/store/redemptions. Somente leitura.
//
// FASE E (pedido Tray real) ainda esta bloqueada no backend: hoje todo
// resgate tentado termina em "blocked_tray_contract_pending" com os
// creditos devolvidos. Este service so LISTA o que ja existe — nao inicia
// nenhum resgate novo.

import { getJSON } from "../lib/api";

export function listMyRedemptions({ page = 1, limit = 20 } = {}) {
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  return getJSON(`/store/redemptions?${qs.toString()}`);
}

export function getMyRedemption(id) {
  return getJSON(`/store/redemptions/${encodeURIComponent(String(id))}`);
}

const STATUS_LABELS = {
  processing: "Processando",
  credits_reserved: "Créditos reservados",
  tray_order_pending: "Enviando pedido",
  tray_order_created: "Pedido criado",
  confirmed: "Confirmado",
  failed: "Falhou",
  compensated: "Cancelado (créditos devolvidos)",
  reconciliation_required: "Em verificação",
  blocked_tray_contract_pending: "Aguardando liberação do resgate real",
};

export function describeRedemptionStatus(status) {
  return STATUS_LABELS[status] || status || "—";
}

const FINAL_NEGATIVE_STATUSES = new Set(["failed", "compensated", "blocked_tray_contract_pending"]);
const FINAL_POSITIVE_STATUSES = new Set(["tray_order_created", "confirmed"]);

export function redemptionStatusSeverity(status) {
  if (FINAL_POSITIVE_STATUSES.has(status)) return "success";
  if (FINAL_NEGATIVE_STATUSES.has(status)) return "warning";
  if (status === "reconciliation_required") return "info";
  return "default";
}
