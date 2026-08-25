// src/services/redemptionsAdmin.js
//
// Administração de PEDIDOS / RESGATES da Loja de Prêmios NS.
//
// SOMENTE LEITURA. Nenhuma função aqui altera resgate, saldo, ledger ou
// pedido na Tray — a NewStore administra o resgate, a Tray administra a
// logística.
//
// O navegador nunca fala com a Tray: o status externo do pedido chega pelo
// backend NewStore, que faz o GET read-only.

import { getJSON } from "../lib/api";
import { describeApiError, parseApiError } from "./rewardStore";

function buildQuery(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || String(value).trim() === "") return;
    qs.set(key, String(value));
  });
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** Listagem paginada de resgates reais. */
export function listRedemptions({ page = 1, limit = 20, q = "", status = "", from = "", to = "" } = {}) {
  return getJSON(`/admin/store/redemptions${buildQuery({ page, limit, q, status, from, to })}`);
}

/** Detalhe administrativo: resgate, cliente, itens, endereço, timeline e ledger. */
export function getRedemption(id) {
  return getJSON(`/admin/store/redemptions/${encodeURIComponent(String(id))}`);
}

/** Estado atual do pedido na Tray. GET read-only, sob demanda. */
export function getRedemptionTrayOrder(id) {
  return getJSON(`/admin/store/redemptions/${encodeURIComponent(String(id))}/tray`);
}

/** Métricas reais + últimos resgates + números do catálogo. */
export function getStoreReports({ from = "", to = "", recentLimit = 5 } = {}) {
  return getJSON(`/admin/store/reports${buildQuery({ from, to, recent_limit: recentLimit })}`);
}

/* ─────────────────────────── Status ─────────────────────────── */

// Mapa CENTRALIZADO de status. A lista factual vem do backend (derivada do
// CHECK real de reward_redemptions) e acompanha as respostas de listagem e
// relatório — o frontend nunca inventa um status nem oferece um filtro que
// o banco não aceita. Este fallback existe só para o caso de uma resposta
// antiga/sem catálogo, e nunca substitui a lista real.
const FALLBACK_LABELS = {
  processing: "Processando",
  credits_reserved: "Créditos debitados",
  tray_order_pending: "Enviando à Tray",
  tray_order_created: "Pedido criado (legado)",
  confirmed: "Confirmado",
  failed: "Falhou",
  compensated: "Compensado",
  reconciliation_required: "Requer conciliação",
  blocked_tray_contract_pending: "Bloqueado: contrato Tray",
  blocked_tray_customer_unmapped: "Bloqueado: cliente não mapeado (legado)",
  blocked_tray_profile_incomplete: "Bloqueado: perfil incompleto",
  blocked_tray_customer_ambiguous: "Bloqueado: cliente ambíguo",
};

/**
 * Descrição administrativa de um status. `catalog` é a lista factual que o
 * backend devolveu; sem ela cai no rótulo conhecido e, em último caso, no
 * próprio código — nunca em um rótulo inventado.
 */
export function describeRedemptionStatus(status, catalog = []) {
  const found = Array.isArray(catalog) ? catalog.find((s) => s.status === status) : null;
  if (found) return found;
  return {
    status,
    label: FALLBACK_LABELS[status] || status || "—",
    description: "",
    severity: "neutral",
  };
}

/**
 * Intenção visual -> tokens do tema admin já existentes.
 * Nenhuma paleta nova: as cores são as mesmas já usadas em
 * AvailabilityCell (disponível/indisponível) e OperationChip (crédito/débito).
 */
export const STATUS_CHIP_STYLES = {
  success: { bgcolor: "#7CFF6B", color: "#061006" },
  info: { bgcolor: "rgba(125,183,255,0.20)", color: "#D6E8FF" },
  warning: { bgcolor: "rgba(214,161,0,0.22)", color: "#FFE9A8" },
  error: { bgcolor: "rgba(239,111,108,0.22)", color: "#FFD9D8" },
  neutral: { bgcolor: "rgba(255,255,255,0.12)", color: "rgba(245,247,245,0.78)" },
};

export function statusChipSx(severity) {
  return { fontWeight: 800, ...(STATUS_CHIP_STYLES[severity] || STATUS_CHIP_STYLES.neutral) };
}

/* ─────────────────────────── Erros ─────────────────────────── */

const MESSAGES = {
  redemption_not_found: "Resgate não encontrado.",
  tray_order_not_created: "Este resgate ainda não gerou pedido na Tray.",
};

export function describeRedemptionAdminError(error, fallback = "Não foi possível carregar os resgates.") {
  const { code } = parseApiError(error);
  return MESSAGES[code] || describeApiError(error, fallback);
}
