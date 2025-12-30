// src/services/autopayVindi.js
// Serviço para autopay via Vindi (tokenização + setup no backend)
// Tokenização é feita via backend para manter segredos no servidor

import { apiJoin, authHeaders } from "../lib/api";

/**
 * Bandeiras suportadas pela Vindi
 */
const SUPPORTED_BRANDS = new Set(['visa', 'mastercard', 'elo', 'amex', 'diners', 'hipercard', 'jcb']);

/**
 * Detecta a bandeira do cartão pelo BIN (6 primeiros dígitos)
 * @param {string} cardNumber - Número do cartão (apenas dígitos)
 * @returns {string|null} Código da bandeira (visa, mastercard, elo, etc.) ou null se não detectada
 */
function detectCardBrand(cardNumber) {
  const num = String(cardNumber || "").replace(/\D+/g, "");
  if (num.length < 6) return null;
  
  const bin = num.slice(0, 6);
  
  // Visa: 4xxxxx
  if (/^4/.test(bin)) return 'visa';
  
  // Mastercard: 5xxxxx (51-55) ou 2xxxxx (range 222100-272099)
  const binNum = parseInt(bin);
  if (/^5[1-5]/.test(bin) || (binNum >= 222100 && binNum <= 272099)) return 'mastercard';
  
  // Elo: padrões principais (5067xx, 5090xx-5099xx, 4314xx, 4514xx, 6363xx, 6500xx, 6277xx, 4389xx, 5041xx)
  if (/^(5067|509[0-9]|4314|4514|6363|6500|6277|4389|5041)/.test(bin)) return 'elo';
  
  // Amex: 34xxxx ou 37xxxx
  if (/^3[47]/.test(bin)) return 'amex';
  
  // Diners: 36xxxx ou 38xxxx
  if (/^3[68]/.test(bin)) return 'diners';
  
  // Hipercard: 606282, 384100-384199
  if (/^606282/.test(bin) || /^3841/.test(bin)) return 'hipercard';
  
  // JCB: 35xxxx
  if (/^35/.test(bin)) return 'jcb';
  
  return null;
}

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

  // Detecta bandeira pelo BIN (6 primeiros dígitos)
  const brand = detectCardBrand(num);
  if (!brand) {
    throw new Error("Bandeira do cartão não identificada. Verifique o número do cartão.");
  }

  // Valida se bandeira está na lista suportada
  if (!SUPPORTED_BRANDS.has(brand)) {
    throw new Error(`Bandeira ${brand} não é suportada. Use Visa, Mastercard, Elo, Amex, Diners, Hipercard ou JCB.`);
  }

  // Monta card_expiration como MM/YYYY (formato esperado pela Vindi)
  const cardExpiration = `${mm}/${yyyy}`;

  // Monta o payload para o backend em snake_case
  const payload = {
    holder_name: holder,
    card_number: num,
    card_expiration: cardExpiration, // Formato MM/YYYY
    card_cvv: sc,
    payment_method_code: "credit_card",
    payment_company_code: brand, // visa, mastercard, elo, etc.
  };

  // Adiciona documento se fornecido
  if (doc) {
    payload.document_number = doc;
    payload.registry_code = doc; // backend decide qual usar
  }

  // Log não sensível para debug
  console.log("[autopay] Tokenizando cartão:", {
    brand,
    last4: num.slice(-4),
    expiration: cardExpiration,
    holder_name_length: holder.length,
    has_document: !!doc,
  });

  const url = apiJoin("/api/autopay/vindi/tokenize");
  const headers = {
    "Content-Type": "application/json",
    ...authHeaders(), // Garante Authorization: Bearer <token>
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    // Tratamento específico para 404 - endpoint não existe
    if (response.status === 404) {
      const err = new Error("Endpoint de tokenização não encontrado (backend desatualizado).");
      err.status = 404;
      err.code = "TOKENIZE_ENDPOINT_NOT_FOUND";
      throw err;
    }
    
    let errorMsg = `HTTP ${response.status}`;
    let errorCode = null;
    
    try {
      const errorJson = await response.json();
      
      // Ordem de prioridade: a) json.error, b) json.message, c) json.errors[0].message, d) fallback HTTP ${status}
      if (errorJson?.error) {
        errorMsg = errorJson.error;
      } else if (errorJson?.message) {
        errorMsg = errorJson.message;
      } else if (errorJson?.errors && Array.isArray(errorJson.errors) && errorJson.errors.length > 0) {
        errorMsg = errorJson.errors[0].message || errorMsg;
      }
      
      errorCode = errorJson?.code || null;
      
      // Tratamento específico por status
      if (response.status === 401) {
        // Sessão expirada ou não autorizado
        const err = new Error("Sessão expirada, faça login novamente.");
        err.status = 401;
        err.code = "SESSION_EXPIRED";
        throw err;
      }
      
      if (response.status === 403) {
        // Chave da API inválida ou não autorizado
        const err = new Error(errorMsg);
        err.status = 403;
        err.code = "VINDI_KEY_INVALID";
        throw err;
      }
      
      if (response.status === 422) {
        // Validação do cartão falhou - mostra mensagem real do backend/Vindi (ex: "bandeira/banco não suportado", "não pode ficar em branco")
        const err = new Error(errorMsg);
        err.status = 422;
        err.code = "CARD_VALIDATION_FAILED";
        throw err;
      }
      
      if (response.status === 400) {
        // Validação do cartão ou requisição inválida
        const err = new Error(errorMsg);
        err.status = 400;
        err.code = "CARD_VALIDATION_FAILED";
        throw err;
      }
    } catch (innerError) {
      // Se já foi lançado erro específico, re-lança
      if (innerError.code === "TOKENIZE_ENDPOINT_NOT_FOUND" ||
          innerError.code === "SESSION_EXPIRED" ||
          innerError.code === "VINDI_KEY_INVALID" || 
          innerError.code === "CARD_VALIDATION_FAILED") {
        throw innerError;
      }
      // Se o erro tem mensagem e status, re-lança
      if (innerError.message && innerError.status) {
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

  // Extrai gateway_token de forma resiliente - aceita múltiplos formatos
  const gatewayToken =
    result?.gateway_token ||
    result?.payment_profile?.gateway_token ||
    result?.data?.gateway_token ||
    result?.data?.payment_profile?.gateway_token ||
    null;

  if (!gatewayToken) {
    console.error("[autopay] Resposta do backend não contém gateway_token:", {
      has_gateway_token: !!result?.gateway_token,
      has_payment_profile: !!result?.payment_profile,
      has_data: !!result?.data,
      response_keys: Object.keys(result || {}),
    });
    throw new Error(
      "Resposta do backend não contém gateway_token. Verifique a estrutura da resposta."
    );
  }

  // Log não sensível de sucesso
  console.log("[autopay] Tokenização bem-sucedida:", {
    brand,
    has_token: !!gatewayToken,
    token_length: gatewayToken.length,
  });

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

