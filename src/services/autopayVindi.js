// src/services/autopayVindi.js
// Serviço para autopay via Vindi (tokenização + setup no backend)
// Tokenização é feita via backend para manter segredos no servidor

import { apiJoin, authHeaders } from "../lib/api";

/**
 * Bandeiras suportadas pela Vindi
 */
const SUPPORTED_BRANDS = new Set(['visa', 'mastercard', 'elo', 'american_express', 'diners_club', 'hipercard']);

/**
 * Detecta a bandeira do cartão pelo BIN (6 primeiros dígitos)
 * Remove tudo que não for dígito antes da detecção
 * @param {string} cardNumber - Número do cartão
 * @returns {"visa" | "mastercard" | "elo" | "american_express" | "diners_club" | "hipercard" | null} Código da bandeira ou null se não detectada
 */
function detectBrandCode(cardNumber) {
  // Remove tudo que não for dígito
  const num = String(cardNumber || "").replace(/\D+/g, "");
  if (num.length < 6) return null;
  
  const bin = num.slice(0, 6);
  const binNum = parseInt(bin);
  
  // IMPORTANTE: Elo deve ser detectado ANTES de Visa para evitar sobreposição
  // Elo: prefixos conhecidos - ordem dos mais específicos primeiro
  // Prefixos de 6 dígitos exatos
  if (bin === '636368' || bin === '636369' || bin === '627780' || 
      bin === '636297' || bin === '401178' || bin === '431274' || bin === '438935' ||
      bin === '451416' || bin === '457393' || bin === '504175' || bin === '506768' ||
      bin === '509048' || bin === '509067' || bin === '509151' || bin === '509389' ||
      bin === '637095' || bin === '637568') {
    return 'elo';
  }
  // Prefixos de 4 dígitos para Elo
  if (bin.startsWith('6504') || bin.startsWith('6505') || bin.startsWith('6506') || 
      bin.startsWith('6507') || bin.startsWith('6509') || bin.startsWith('6516') || 
      bin.startsWith('6550') || bin.startsWith('5067') || bin.startsWith('5090') ||
      bin.startsWith('5091') || bin.startsWith('5092') || bin.startsWith('5093') ||
      bin.startsWith('5094') || bin.startsWith('5095') || bin.startsWith('5096') ||
      bin.startsWith('5097') || bin.startsWith('5098') || bin.startsWith('5099') ||
      bin.startsWith('4314') || bin.startsWith('4514') || bin.startsWith('6363') ||
      bin.startsWith('6500') || bin.startsWith('6277') || bin.startsWith('4389') ||
      bin.startsWith('5041')) {
    return 'elo';
  }
  
  // Mastercard: 51-55 ou range 222100-272099 (2221-2720 nos primeiros 4 dígitos)
  if (/^5[1-5]/.test(bin) || (binNum >= 222100 && binNum <= 272099)) {
    return 'mastercard';
  }
  
  // Visa: começa com 4 (após Elo para evitar sobreposição)
  if (/^4/.test(bin)) return 'visa';
  
  // Amex: 34 ou 37
  if (bin.startsWith('34') || bin.startsWith('37')) return 'american_express';
  
  // Diners: 300-305, 36, 38-39 (primeiros 3 dígitos ou 2 dígitos)
  if (bin.startsWith('300') || bin.startsWith('301') || bin.startsWith('302') ||
      bin.startsWith('303') || bin.startsWith('304') || bin.startsWith('305') ||
      bin.startsWith('36') || bin.startsWith('38') || bin.startsWith('39')) {
    return 'diners_club';
  }
  
  // Hipercard: 606282, 384100-384199, 637095, 637568
  if (bin === '606282' || bin.startsWith('3841') || bin === '637095' || bin === '637568') {
    return 'hipercard';
  }
  
  // JCB não está listado como suportado nessa referência da Vindi; não setar.
  // if (/^35/.test(bin)) return null;
  
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
  // Garante expYear no formato YYYY (4 dígitos) - se vier com 2 dígitos, adiciona 20
  let yyyy = String(expYear || "");
  if (yyyy.length === 2) {
    yyyy = `20${yyyy}`;
  } else if (yyyy.length === 4) {
    yyyy = yyyy;
  } else {
    // Se não tiver 2 ou 4 dígitos, tenta pegar os últimos 4
    yyyy = yyyy.slice(-4);
    if (yyyy.length === 2) {
      yyyy = `20${yyyy}`;
    }
  }
  
  // CVV apenas dígitos, máximo 4 caracteres
  const sc = String(cvv || "").replace(/\D+/g, "").slice(0, 4);
  // Trim para evitar enviar strings vazias
  const holder = String(holderName || "").trim();
  const doc = String(documentNumber || "").replace(/\D+/g, "");

  if (!num || !mm || mm.length !== 2 || !yyyy || yyyy.length !== 4 || !sc || !holder) {
    throw new Error("Dados do cartão incompletos.");
  }

  // Detecta bandeira - não barra no frontend. Se detectar e for suportada, envia payment_company_code
  const brand = detectBrandCode(num);
  
  // Monta payload compatível com o BACKEND (/api/autopay/vindi/tokenize)
  // Backend aceita camelCase (expMonth/expYear) e também card_expiration no formato MM/YYYY (4 dígitos)
  const payload = {
    holderName: holder,
    cardNumber: num,
    expMonth: mm,
    expYear: yyyy,
    card_expiration: `${mm}/${yyyy}`, // Formato MM/YYYY (4 dígitos no ano)
    cvv: sc,
    payment_method_code: "credit_card",
  };

  // Adiciona payment_company_code apenas se detectar bandeira suportada (não envia null/undefined)
  if (brand && SUPPORTED_BRANDS.has(brand)) {
    payload.payment_company_code = brand;
  }

  // Adiciona documento apenas se fornecido (não envia string vazia)
  if (doc) {
    payload.documentNumber = doc;
  }

  // Log não sensível para debug
  const url = apiJoin("/api/autopay/vindi/tokenize");
  console.debug("[autopay] Tokenizando cartão - chamando BACKEND:", {
    url,
    bin: num.slice(0, 6),
    brand: brand || "não detectada",
    payment_company_code: brand && SUPPORTED_BRANDS.has(brand) ? brand : "não enviado",
    last4: num.slice(-4),
    card_expiration: `${mm}/${yyyy}`,
    holder_name_length: holder.length,
    has_document: !!doc,
    has_authorization: !!authHeaders().Authorization,
    payload_keys: Object.keys(payload),
  });

  const headers = {
    "Content-Type": "application/json",
    ...authHeaders(), // Garante Authorization: Bearer <token>
  };

  // Confirma que não está chamando Vindi diretamente
  if (url.includes("app.vindi.com.br") || url.includes("vindi.com.br")) {
    throw new Error("Erro de configuração: tentando chamar Vindi diretamente do frontend. Use o backend.");
  }

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
      
      // Verifica se há erro relacionado a payment_company_id/payment_company_code
      // Pode vir em error_parameters, data.details, ou na mensagem de erro
      let hasPaymentCompanyIdError = false;
      const errorStr = JSON.stringify(errorJson || {}).toLowerCase();
      
      // Verifica se menciona payment_company
      if (errorStr.includes("payment_company_id") || 
          errorStr.includes("payment_company_code") ||
          errorStr.includes("payment_company_code_not_supported")) {
        hasPaymentCompanyIdError = true;
      }
      
      // Verifica error_parameters explicitamente
      if (errorJson?.error_parameters) {
        const errorParams = errorJson.error_parameters;
        if (typeof errorParams === "string") {
          hasPaymentCompanyIdError = errorParams.includes("payment_company_id") || 
                                     errorParams.includes("payment_company_code");
        } else if (Array.isArray(errorParams)) {
          hasPaymentCompanyIdError = errorParams.some(p => 
            (typeof p === "string" && (p.includes("payment_company_id") || p.includes("payment_company_code"))) ||
            (typeof p === "object" && (p?.parameter === "payment_company_id" || p?.parameter === "payment_company_code"))
          );
        } else if (typeof errorParams === "object") {
          hasPaymentCompanyIdError = "payment_company_id" in errorParams || "payment_company_code" in errorParams;
        }
      }
      
      // Também verifica nos details se algum erro é sobre payment_company
      if (!hasPaymentCompanyIdError && errorJson?.data?.details && Array.isArray(errorJson.data.details)) {
        hasPaymentCompanyIdError = errorJson.data.details.some(detail => {
          const param = (detail.parameter || detail.field || "").toLowerCase();
          return param.includes("payment_company") || 
                 (detail.message && typeof detail.message === "string" && detail.message.toLowerCase().includes("payment_company"));
        });
      }
      
      // Log para debug se vier valid_codes
      if (errorJson?.data?.details && Array.isArray(errorJson.data.details)) {
        const validCodesDetail = errorJson.data.details.find(d => 
          d?.valid_codes || (typeof d?.message === "string" && d.message.toLowerCase().includes("valid"))
        );
        if (validCodesDetail?.valid_codes) {
          console.debug("[autopay] Códigos válidos retornados pelo backend:", validCodesDetail.valid_codes);
        }
      }

      // Prioridade: se vier response.data.details (lista de erros), concatena "campo: <parameter> - <message>"
      if (errorJson?.data?.details && Array.isArray(errorJson.data.details) && errorJson.data.details.length > 0) {
        const detailsMessages = errorJson.data.details.map((detail) => {
          const parameter = detail.parameter || detail.field || "campo";
          const message = detail.message || detail.error || "";
          return `${parameter}: ${message}`;
        });
        errorMsg = detailsMessages.join("; ");
      } 
      // Caso contrário, mostra response.data.message
      else if (errorJson?.data?.message) {
        errorMsg = errorJson.data.message;
      }
      // Fallback para estruturas alternativas
      else if (errorJson?.error) {
        errorMsg = errorJson.error;
      } else if (errorJson?.message) {
        errorMsg = errorJson.message;
      } else if (errorJson?.errors && Array.isArray(errorJson.errors) && errorJson.errors.length > 0) {
        errorMsg = errorJson.errors[0].message || errorMsg;
      }
      
      errorCode = errorJson?.code || errorJson?.data?.code || null;
      
      // Preserva informação sobre erro de payment_company_id para uso no componente
      if (hasPaymentCompanyIdError) {
        errorCode = errorCode || "PAYMENT_COMPANY_ID_ERROR";
      }
      
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
        err.code = errorCode || "CARD_VALIDATION_FAILED";
        err.hasPaymentCompanyIdError = hasPaymentCompanyIdError;
        throw err;
      }
      
      if (response.status === 400) {
        // Validação do cartão ou requisição inválida
        const err = new Error(errorMsg);
        err.status = 400;
        err.code = errorCode || "CARD_VALIDATION_FAILED";
        err.hasPaymentCompanyIdError = hasPaymentCompanyIdError;
        throw err;
      }
      
      // Para outros status codes, também preserva informação sobre payment_company_id
      if (hasPaymentCompanyIdError) {
        const err = new Error(errorMsg);
        err.status = response.status;
        err.code = errorCode;
        err.hasPaymentCompanyIdError = true;
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
  // Constrói o body convertendo camelCase para snake_case
  const body = {};
  
  // holder_name só é obrigatório quando tem gateway_token (atualizando cartão)
  if (holderName) {
    body.holder_name = String(holderName || "").trim();
  }

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

