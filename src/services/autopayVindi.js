// src/services/autopayVindi.js
// Serviço para autopay via Vindi (tokenização + setup no backend)

import { apiJoin, authHeaders } from "../lib/api";

const VINDI_PUBLIC_KEY =
  process.env.REACT_APP_VINDI_PUBLIC_KEY ||
  "";

const VINDI_PUBLIC_BASE_URL =
  (process.env.REACT_APP_VINDI_PUBLIC_BASE_URL || "https://app.vindi.com.br/api/v1")
    .replace(/\/+$/, "");

/**
 * Tokeniza um cartão via Vindi Public API
 * @param {Object} params - Dados do cartão
 * @param {string} params.holderName - Nome do titular
 * @param {string} params.cardNumber - Número do cartão (apenas dígitos)
 * @param {string} params.expMonth - Mês de expiração (MM)
 * @param {string} params.expYear - Ano de expiração (YYYY)
 * @param {string} params.cvv - CVV
 * @param {string} [params.documentNumber] - CPF/CNPJ do titular (opcional)
 * @returns {Promise<string>} gateway_token
 */
export async function tokenizeCardWithVindi({
  holderName,
  cardNumber,
  expMonth,
  expYear,
  cvv,
  documentNumber,
}) {
  if (!VINDI_PUBLIC_KEY) {
    throw new Error(
      "Chave pública da Vindi não configurada (REACT_APP_VINDI_PUBLIC_KEY)."
    );
  }

  const num = String(cardNumber || "").replace(/\D+/g, "");
  const mm = String(expMonth || "").padStart(2, "0");
  const yyyy = String(expYear || "").slice(-4);
  const sc = String(cvv || "").replace(/\D+/g, "").slice(0, 4);
  const holder = String(holderName || "").trim();
  const doc = String(documentNumber || "").replace(/\D+/g, "");

  if (!num || !mm || !yyyy || !sc || !holder) {
    throw new Error("Dados do cartão incompletos.");
  }

  // Monta o payload conforme a API da Vindi
  const payload = {
    holder_name: holder,
    card_number: num,
    card_expiration_month: mm,
    card_expiration_year: yyyy,
    card_cvv: sc,
    payment_method_code: "credit_card",
  };

  // Adiciona documento se fornecido
  if (doc) {
    payload.document_number = doc;
  }

  // Authorization: Basic base64(public_key + ":")
  const auth = btoa(`${VINDI_PUBLIC_KEY}:`);

  try {
    const response = await fetch(
      `${VINDI_PUBLIC_BASE_URL}/public/payment_profiles`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      let errorMsg = `Falha ao tokenizar cartão (HTTP ${response.status})`;
      try {
        const errorJson = await response.json();
        errorMsg =
          errorJson?.errors?.[0]?.message ||
          errorJson?.error ||
          errorMsg;
      } catch {}
      throw new Error(errorMsg);
    }

    const vindiJson = await response.json();

    // Extrai gateway_token de forma resiliente
    const gatewayToken =
      vindiJson?.payment_profile?.gateway_token ||
      vindiJson?.gateway_token ||
      null;

    if (!gatewayToken) {
      throw new Error(
        "Resposta da Vindi não contém gateway_token. Verifique a estrutura da resposta."
      );
    }

    return gatewayToken;
  } catch (error) {
    if (error instanceof Error) throw error;
    throw new Error("Erro ao comunicar com a Vindi.");
  }
}

/**
 * Configura o autopay no backend usando gateway_token (opcional)
 * @param {Object} params
 * @param {string} [params.gatewayToken] - Token retornado pela Vindi (opcional)
 * @param {string} params.holderName - Nome do titular
 * @param {string} params.docNumber - CPF/CNPJ do titular
 * @param {number[]} params.numbers - Array de números cativos
 * @param {boolean} params.active - Status ativo/inativo do autopay
 * @returns {Promise<Object>} Resposta do backend (pode incluir card.last4, card.brand, etc.)
 */
export async function setupAutopayVindi({
  gatewayToken,
  holderName,
  docNumber,
  numbers,
  active,
}) {
  if (!holderName) {
    throw new Error("holder_name é obrigatório.");
  }

  // Constrói o body convertendo camelCase para snake_case
  const body = {
    holder_name: String(holderName || "").trim(),
  };

  // Adiciona gateway_token apenas se fornecido
  if (gatewayToken) {
    body.gateway_token = String(gatewayToken);
  }

  // Adiciona doc_number se fornecido
  if (docNumber) {
    body.doc_number = String(docNumber).replace(/\D+/g, "");
  }

  // Adiciona numbers (array de inteiros)
  if (Array.isArray(numbers)) {
    body.numbers = numbers.map((n) => Number(n)).filter(Number.isFinite);
  }

  // Adiciona active (boolean)
  if (typeof active === "boolean") {
    body.active = active;
  }

  const url = apiJoin("/api/autopay/vindi/setup");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorMsg = "Falha ao configurar autopay";
    let errorCode = null;
    try {
      const errorJson = await response.json();
      errorMsg = errorJson?.error || errorJson?.message || errorMsg;
      errorCode = errorJson?.code || null;
      
      // Verifica se o erro indica que gateway_token é obrigatório
      const errorStr = String(errorMsg || "").toLowerCase();
      if (
        response.status === 400 &&
        (!gatewayToken || gatewayToken === null) &&
        (errorStr.includes("gateway_token") ||
          errorStr.includes("gateway token") ||
          errorStr.includes("obrigatório") ||
          errorStr.includes("required"))
      ) {
        errorMsg = "GATEWAY_TOKEN_REQUIRED";
      }
    } catch {}
    
    const error = new Error(errorMsg);
    if (errorCode) error.code = errorCode;
    error.status = response.status;
    throw error;
  }

  return await response.json();
}

/**
 * Busca o status do autopay via backend
 * @returns {Promise<Object>} Status do autopay (active, card.last4, card.brand, etc.)
 */
export async function getAutopayVindiStatus() {
  const url = apiJoin("/api/autopay/vindi/status");
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    credentials: "include",
  });

  if (!response.ok) {
    // Se 404, pode ser que o autopay não esteja configurado ainda
    if (response.status === 404) {
      return { active: false, has_card: false };
    }
    let errorMsg = "Falha ao buscar status do autopay";
    try {
      const errorJson = await response.json();
      errorMsg = errorJson?.error || errorJson?.message || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  return await response.json();
}

