// src/services/autopayVindi.js
// Serviço para autopay via Vindi (tokenização + setup no backend)
// Tokenização é feita via backend para manter segredos no servidor

import { apiJoin, authHeaders } from "../lib/api";

/**
 * Tokeniza um cartão via backend (endpoint proxy para Vindi)
 * O backend usa a chave privada da Vindi de forma segura
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
  // Valida e normaliza dados do cartão
  const num = String(cardNumber || "").replace(/\D+/g, "");
  // Garante expMonth no formato MM (2 dígitos)
  const mm = String(expMonth || "").padStart(2, "0");
  // Garante expYear no formato YYYY (4 dígitos)
  let yyyy = String(expYear || "").slice(-4);
  if (yyyy.length === 2) {
    yyyy = `20${yyyy}`;
  }
  // CVV apenas dígitos, máximo 4 caracteres
  const sc = String(cvv || "").replace(/\D+/g, "").slice(0, 4);
  const holder = String(holderName || "").trim();
  const doc = String(documentNumber || "").replace(/\D+/g, "");

  if (!num || !mm || mm.length !== 2 || !yyyy || yyyy.length !== 4 || !sc || !holder) {
    throw new Error("Dados do cartão incompletos.");
  }

  // Monta o payload para o backend
  const payload = {
    holder_name: holder,
    card_number: num,
    card_expiration_month: mm,
    card_expiration_year: yyyy,
    card_cvv: sc,
    payment_method_code: "credit_card",
  };

  // Adiciona documento se fornecido (campo pode ser registry_code ou document_number)
  if (doc) {
    payload.document_number = doc;
    payload.registry_code = doc; // backend decide qual usar
  }

  const url = apiJoin("/api/autopay/vindi/tokenize");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // Tratamento específico para 404 - endpoint não existe
    if (response.status === 404) {
      const err = new Error("TOKENIZE_ENDPOINT_NOT_FOUND");
      err.status = 404;
      throw err;
    }
    
    let errorMsg = "Falha ao tokenizar cartão";
    let errorCode = null;
    
    try {
      const errorJson = await response.json();
      errorMsg = errorJson?.error || errorJson?.message || errorMsg;
      errorCode = errorJson?.code || null;
      
      // Tratamento específico por status
      if (response.status === 401 || response.status === 403) {
        // Chave da API inválida ou não autorizado
        const err = new Error("VINDI_KEY_INVALID");
        err.status = response.status;
        err.details = errorMsg;
        throw err;
      }
      
      if (response.status === 422 || response.status === 400) {
        // Validação do cartão falhou
        const friendlyMsg = errorJson?.errors?.[0]?.message || 
                          errorJson?.message || 
                          "Dados do cartão inválidos. Verifique e tente novamente.";
        const err = new Error("CARD_VALIDATION_FAILED");
        err.status = response.status;
        err.details = friendlyMsg;
        throw err;
      }
    } catch (innerError) {
      // Se já foi lançado erro específico, re-lança
      if (innerError.message === "TOKENIZE_ENDPOINT_NOT_FOUND" ||
          innerError.message === "VINDI_KEY_INVALID" || 
          innerError.message === "CARD_VALIDATION_FAILED") {
        throw innerError;
      }
      // Caso contrário, continua para criar erro genérico
    }
    
    const error = new Error(errorMsg);
    if (errorCode) error.code = errorCode;
    error.status = response.status;
    throw error;
  }

  const result = await response.json();

  // Extrai gateway_token de forma resiliente
  const gatewayToken =
    result?.gateway_token ||
    result?.payment_profile?.gateway_token ||
    result?.data?.gateway_token ||
    null;

  if (!gatewayToken) {
    throw new Error(
      "Resposta do backend não contém gateway_token. Verifique a estrutura da resposta."
    );
  }

  return gatewayToken;
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

