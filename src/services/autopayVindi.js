// src/services/autopayVindi.js
// Serviço para autopay via Vindi (tokenização + setup no backend)
// Tokenização é feita via backend para manter segredos no servidor

import { apiJoin, authHeaders } from "../lib/api";

/**
 * Bandeiras suportadas pela Vindi
 * Códigos exatos esperados pelo backend/Vindi
 */
const SUPPORTED_BRANDS = new Set(['visa', 'mastercard', 'elo', 'american_express', 'diners_club', 'hipercard']);

/**
 * Detecta a bandeira do cartão pelo BIN/IIN
 * Remove tudo que não for dígito antes da detecção
 * @param {string} cardNumber - Número do cartão (pode conter espaços/hífens)
 * @returns {"visa" | "mastercard" | "elo" | "american_express" | "diners_club" | "hipercard" | null} Código exato esperado pelo backend/Vindi ou null
 */
export function detectBrandCode(cardNumber) {
  // Sanitiza: remove tudo que não for dígito
  const digitsOnly = String(cardNumber || "").replace(/\D/g, "");
  if (digitsOnly.length < 6) return null;
  
  const bin = digitsOnly.slice(0, 6);
  const binPrefix4 = digitsOnly.slice(0, 4);
  const binPrefix3 = digitsOnly.slice(0, 3);
  const binPrefix2 = digitsOnly.slice(0, 2);
  const binNum = parseInt(bin, 10);
  const binPrefix4Num = parseInt(binPrefix4, 10);
  const binPrefix3Num = parseInt(binPrefix3, 10);
  const binPrefix2Num = parseInt(binPrefix2, 10);
  
  // IMPORTANTE: Elo deve ser detectado ANTES de Visa para evitar sobreposição
  // Elo: prefixos conhecidos - verificação por ordem de especificidade (6 dígitos primeiro, depois 4, depois 2)
  
  // Prefixos de 6 dígitos exatos para Elo
  const eloBin6 = ['636368', '636369', '627780', '636297', '401178', '431274', '438935',
                    '451416', '457393', '504175', '506768', '509048', '509067', '509151', '509389'];
  if (eloBin6.includes(bin)) {
    return 'elo';
  }
  
  // Prefixos de 4 dígitos para Elo
  const eloPrefix4 = ['6504', '6505', '6506', '6507', '6509', '6516', '6550', '5067', 
                       '4314', '4514', '6363', '6500', '6277', '4389', '5041'];
  if (eloPrefix4.some(prefix => bin.startsWith(prefix))) {
    return 'elo';
  }
  
  // Prefixos de 2 dígitos para Elo (5090-5099)
  if (binPrefix2 === '50' && binPrefix4Num >= 5090 && binPrefix4Num <= 5099) {
    return 'elo';
  }
  
  // Mastercard: 51-55 (prefixo de 2 dígitos) OU 2221-2720 (prefixo de 4 dígitos)
  if ((binPrefix2Num >= 51 && binPrefix2Num <= 55) || 
      (binPrefix4Num >= 2221 && binPrefix4Num <= 2720)) {
    return 'mastercard';
  }
  
  // Visa: começa com 4 (após Elo para evitar sobreposição)
  if (digitsOnly.startsWith('4')) {
    return 'visa';
  }
  
  // Amex: começa com 34 ou 37
  if (binPrefix2 === '34' || binPrefix2 === '37') {
    return 'american_express';
  }
  
  // Hipercard: 606282 (6 dígitos) OU 384100-384199 (range de 4 dígitos)
  if (bin === '606282' || (binPrefix4 === '3841' && binNum >= 384100 && binNum <= 384199)) {
    return 'hipercard';
  }

  // Diners: 300-305 (prefixo de 3 dígitos) OU começa com 36 OU 38 (prefixo de 2 dígitos)
  // IMPORTANTE: Hipercard (3841...) deve ser detectado antes de Diners (38...) para evitar sobreposição.
  if ((binPrefix3Num >= 300 && binPrefix3Num <= 305) ||
      binPrefix2 === '36' || binPrefix2 === '38') {
    return 'diners_club';
  }
  
  return null;
}

/**
 * Tokeniza um cartão via backend (endpoint proxy para Vindi).
 * Modo novo (backend atualizado): retorna payment_profile_id e customer_id.
 * Modo antigo (fallback): pode retornar gateway_token.
 *
 * Formato esperado (novo):
 * { ok, customer_id, payment_profile_id, card_last4, payment_company_code }
 *
 * @param {Object} params - Dados do cartão
 * @param {string} params.holderName - Nome do titular
 * @param {string} params.cardNumber - Número do cartão (apenas dígitos)
 * @param {string} params.expMonth - Mês de expiração (MM)
 * @param {string} params.expYear - Ano de expiração (YYYY)
 * @param {string} params.cvv - CVV
 * @param {string} [params.documentNumber] - CPF/CNPJ do titular (opcional)
 * @returns {Promise<{ok: boolean, customer_id?: string|number, payment_profile_id?: string|number, card_last4?: string, payment_company_code?: string, gateway_token?: string}>}
 */
export async function tokenizeCardWithVindi({
  holderName,
  cardNumber,
  expMonth,
  expYear,
  cvv,
  documentNumber,
}) {
  // Sanitiza número do cartão: remove tudo que não for dígito
  const num = String(cardNumber || "").replace(/\D/g, "");
  
  // Garante expMonth no formato MM (zero-padded, 2 dígitos)
  const mm = String(expMonth || "").padStart(2, "0");
  
  // Garante expYear no formato YYYY (4 dígitos)
  // Se usuário digitar 2 dígitos, prefixa com 20
  let yyyy = String(expYear || "");
  if (yyyy.length === 2) {
    yyyy = `20${yyyy}`;
  } else if (yyyy.length === 4) {
    // Já está com 4 dígitos, usar como está
    yyyy = yyyy;
  } else if (yyyy.length > 4) {
    // Se tiver mais de 4 dígitos, pega os últimos 4
    yyyy = yyyy.slice(-4);
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
  const brandCode = detectBrandCode(num);
  
  // Monta payload compatível com o BACKEND (/api/autopay/vindi/tokenize)
  // Backend aceita camelCase (expMonth/expYear) e também card_expiration no formato MM/YYYY (4 dígitos)
  const card_expiration = `${mm}/${yyyy}`; // Sempre MM/YYYY (4 dígitos no ano)
  
  const payload = {
    holderName: holder,
    cardNumber: num,
    expMonth: mm,
    expYear: yyyy,
    card_expiration,
    cvv: sc,
    payment_method_code: "credit_card",
    // Adiciona payment_company_code apenas se detectar bandeira suportada (não envia null/undefined)
    ...(brandCode && SUPPORTED_BRANDS.has(brandCode) ? { payment_company_code: brandCode } : {}),
    // Adiciona documento apenas se fornecido (não envia string vazia)
    ...(doc ? { documentNumber: doc } : {}),
  };

  // Log não sensível para debug (nunca logar PAN completo)
  const url = apiJoin("/api/autopay/vindi/tokenize");
  if (process.env.NODE_ENV === 'development') {
    console.debug("[autopay] Tokenizando cartão - chamando BACKEND:", {
      url,
      bin: num.slice(0, 6), // Apenas 6 primeiros dígitos (BIN), nunca o cartão completo
      detectedBrandCode: brandCode || "não detectada",
      payment_company_code: brandCode && SUPPORTED_BRANDS.has(brandCode) ? brandCode : "não enviado",
      last4: num.slice(-4),
      card_expiration: `${mm}/${yyyy}`,
      holder_name_length: holder.length,
      has_document: !!doc,
      has_authorization: !!authHeaders().Authorization,
      payload_keys: Object.keys(payload),
    });
  }

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
        // Só trata como SESSION_EXPIRED se for erro real de autenticação JWT
        const isSessionExpired = 
          errorCode === "SESSION_EXPIRED" ||
          errorCode === "UNAUTHORIZED" ||
          (errorJson?.error && String(errorJson.error).toLowerCase() === "unauthorized") ||
          (errorMsg && (
            errorMsg.toLowerCase().includes("jwt") ||
            errorMsg.toLowerCase().includes("token expired") ||
            errorMsg.toLowerCase().includes("token inválido") ||
            errorMsg.toLowerCase().includes("não autorizado")
          ));
        
        if (isSessionExpired) {
          const err = new Error("Sessão expirada, faça login novamente.");
          err.status = 401;
          err.code = "SESSION_EXPIRED";
          throw err;
        } else {
          // 401 mas não é sessão expirada (ex: erro Vindi de autorização)
          const err = new Error(errorMsg || "Erro de autorização ao processar cartão.");
          err.status = 401;
          err.code = errorCode || "VINDI_BACKEND_ERROR";
          throw err;
        }
      }
      
      if (response.status === 403) {
        // Chave da API inválida ou não autorizado
        const err = new Error(errorMsg);
        err.status = 403;
        err.code = errorCode || "VINDI_KEY_INVALID";
        throw err;
      }
      
      if (response.status === 502 || response.status === 503) {
        // Bad Gateway / Service Unavailable - pode ser erro de comunicação com Vindi
        if (errorCode === "VINDI_AUTH_ERROR") {
          const err = new Error("Falha na Vindi: verifique configuração do cartão/ambiente. Contate o suporte.");
          err.status = response.status;
          err.code = "VINDI_AUTH_ERROR";
          throw err;
        }
        // Outros erros 502/503
        const err = new Error(errorMsg || "Serviço temporariamente indisponível. Tente novamente.");
        err.status = response.status;
        err.code = errorCode || "SERVICE_UNAVAILABLE";
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
          innerError.code === "VINDI_AUTH_ERROR" ||
          innerError.code === "VINDI_BACKEND_ERROR" ||
          innerError.code === "SERVICE_UNAVAILABLE" ||
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

  // Extrai gateway_token de forma resiliente - aceita múltiplos formatos (fallback modo antigo)
  const gatewayToken =
    result?.gateway_token ||
    result?.payment_profile?.gateway_token ||
    result?.data?.gateway_token ||
    result?.data?.payment_profile?.gateway_token ||
    null;

  // Extrai campos do modo novo
  const ok = typeof result?.ok === "boolean" ? result.ok : true;
  const payment_profile_id =
    result?.payment_profile_id ||
    result?.paymentProfileId ||
    result?.payment_profile?.id ||
    result?.data?.payment_profile_id ||
    result?.data?.paymentProfileId ||
    result?.data?.payment_profile?.id ||
    null;
  const customer_id =
    result?.customer_id ||
    result?.customerId ||
    result?.customer?.id ||
    result?.data?.customer_id ||
    result?.data?.customerId ||
    result?.data?.customer?.id ||
    null;
  const card_last4 =
    (result?.card_last4 ||
      result?.cardLast4 ||
      result?.card?.last4 ||
      result?.data?.card_last4 ||
      result?.data?.cardLast4 ||
      result?.data?.card?.last4 ||
      null) ??
    null;
  const payment_company_code =
    result?.payment_company_code ||
    result?.paymentCompanyCode ||
    result?.card?.payment_company_code ||
    result?.data?.payment_company_code ||
    result?.data?.paymentCompanyCode ||
    brandCode ||
    null;

  // Se backend antigo: não vem payment_profile_id, mas vem gateway_token
  // Se backend novo: deve vir payment_profile_id (e opcionalmente gateway_token)
  if (!payment_profile_id && !gatewayToken) {
    console.error("[autopay] Resposta do backend não contém payment_profile_id nem gateway_token:", {
      ok,
      has_payment_profile_id: !!result?.payment_profile_id,
      has_gateway_token: !!result?.gateway_token,
      has_payment_profile: !!result?.payment_profile,
      has_data: !!result?.data,
      response_keys: Object.keys(result || {}),
    });
    const err = new Error(
      "Resposta do backend inválida: não contém payment_profile_id (modo novo) nem gateway_token (modo antigo)."
    );
    err.code = "TOKENIZE_INVALID_RESPONSE";
    throw err;
  }

  // Log não sensível de sucesso
  console.log("[autopay] Tokenização bem-sucedida:", {
    ok,
    brandCode: brandCode || "não detectada",
    payment_profile_id: payment_profile_id ? "[present]" : null,
    customer_id: customer_id ? "[present]" : null,
    card_last4: card_last4 || num.slice(-4),
    payment_company_code: payment_company_code || null,
    has_gateway_token: !!gatewayToken,
  });

  return {
    ok,
    customer_id: customer_id || undefined,
    payment_profile_id: payment_profile_id || undefined,
    card_last4: (card_last4 || num.slice(-4) || undefined),
    payment_company_code: payment_company_code || undefined,
    ...(gatewayToken ? { gateway_token: gatewayToken } : {}),
  };
}

/**
 * Configura o autopay no backend usando payment_profile_id (modo novo) ou gateway_token (fallback).
 * @param {Object} params
 * @param {string|number} [params.paymentProfileId] - payment_profile_id (modo novo)
 * @param {string|number} [params.payment_profile_id] - payment_profile_id (modo novo, snake_case)
 * @param {string} [params.gatewayToken] - Token retornado pela Vindi (modo antigo / fallback)
 * @param {string} params.holderName - Nome do titular
 * @param {string} params.docNumber - CPF/CNPJ do titular
 * @param {number[]} params.numbers - Array de números cativos
 * @param {boolean} params.active - Status ativo/inativo do autopay
 * @returns {Promise<Object>} Resposta do backend (pode incluir card.last4, card.brand, etc.)
 */
export async function setupAutopayVindi({
  paymentProfileId,
  payment_profile_id,
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

  // Modo novo: envia payment_profile_id (preferencial).
  const ppId = payment_profile_id ?? paymentProfileId;
  if (ppId) {
    body.payment_profile_id = ppId;
  } else if (gatewayToken) {
    // Fallback (modo antigo): envia gateway_token
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
    let errorJson = null;
    try {
      errorJson = await response.json();
      errorMsg = errorJson?.error || errorJson?.message || errorMsg;
      errorCode = errorJson?.code || null;
    } catch {}

    if (response.status === 401) {
      // Só trata como SESSION_EXPIRED se for erro real de autenticação JWT
      const isSessionExpired = 
        errorCode === "SESSION_EXPIRED" ||
        errorCode === "UNAUTHORIZED" ||
        (errorJson?.error && String(errorJson.error).toLowerCase() === "unauthorized") ||
        (errorMsg && (
          errorMsg.toLowerCase().includes("jwt") ||
          errorMsg.toLowerCase().includes("token expired") ||
          errorMsg.toLowerCase().includes("token inválido") ||
          errorMsg.toLowerCase().includes("não autorizado")
        ));
      
      if (isSessionExpired) {
        const err = new Error("Sessão expirada, faça login novamente.");
        err.status = 401;
        err.code = "SESSION_EXPIRED";
        throw err;
      } else {
        // 401 mas não é sessão expirada (ex: erro Vindi de autorização)
        const err = new Error(errorMsg || "Erro de autorização ao processar cartão.");
        err.status = 401;
        err.code = errorCode || "VINDI_BACKEND_ERROR";
        throw err;
      }
    }

    if (response.status === 502 || response.status === 503) {
      // Bad Gateway / Service Unavailable - pode ser erro de comunicação com Vindi
      if (errorCode === "VINDI_AUTH_ERROR") {
        const err = new Error("Falha na Vindi: verifique configuração do cartão/ambiente. Contate o suporte.");
        err.status = response.status;
        err.code = "VINDI_AUTH_ERROR";
        throw err;
      }
      // Outros erros 502/503
      const err = new Error(errorMsg || "Serviço temporariamente indisponível. Tente novamente.");
      err.status = response.status;
      err.code = errorCode || "SERVICE_UNAVAILABLE";
      throw err;
    }

    // Verifica se o erro indica que gateway_token é obrigatório
    const errorStr = String(errorMsg || "").toLowerCase();
    if (
      response.status === 400 &&
      (!ppId && (!gatewayToken || gatewayToken === null)) &&
      (errorStr.includes("gateway_token") ||
        errorStr.includes("gateway token") ||
        errorStr.includes("obrigatório") ||
        errorStr.includes("required"))
    ) {
      errorMsg = "GATEWAY_TOKEN_REQUIRED";
    }
    
    const error = new Error(errorMsg);
    if (errorCode) error.code = errorCode;
    error.status = response.status;
    throw error;
  }

  return await response.json();
}

/**
 * Alias sem quebrar imports antigos/novos
 * (Alguns lugares podem referenciar "tokenizeVindiCard" ao invés de tokenizeCardWithVindi)
 */
export async function tokenizeVindiCard(params) {
  return tokenizeCardWithVindi(params);
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
    let errorCode = null;
    let errorJson = null;
    try {
      errorJson = await response.json();
      errorMsg = errorJson?.error || errorJson?.message || errorMsg;
      errorCode = errorJson?.code || null;
    } catch {}
    
    if (response.status === 401) {
      // Só trata como SESSION_EXPIRED se for erro real de autenticação JWT
      const isSessionExpired = 
        errorCode === "SESSION_EXPIRED" ||
        errorCode === "UNAUTHORIZED" ||
        (errorJson?.error && String(errorJson.error).toLowerCase() === "unauthorized") ||
        (errorMsg && (
          errorMsg.toLowerCase().includes("jwt") ||
          errorMsg.toLowerCase().includes("token expired") ||
          errorMsg.toLowerCase().includes("token inválido") ||
          errorMsg.toLowerCase().includes("não autorizado")
        ));
      
      if (isSessionExpired) {
        const err = new Error("Sessão expirada, faça login novamente.");
        err.status = 401;
        err.code = "SESSION_EXPIRED";
        throw err;
      } else {
        // 401 mas não é sessão expirada (ex: erro Vindi de autorização)
        const err = new Error(errorMsg || "Erro de autorização ao buscar status.");
        err.status = 401;
        err.code = errorCode || "VINDI_BACKEND_ERROR";
        throw err;
      }
    }
    
    if (response.status === 502 || response.status === 503) {
      // Bad Gateway / Service Unavailable - pode ser erro de comunicação com Vindi
      if (errorCode === "VINDI_AUTH_ERROR") {
        const err = new Error("Falha na Vindi: verifique configuração do cartão/ambiente. Contate o suporte.");
        err.status = response.status;
        err.code = "VINDI_AUTH_ERROR";
        throw err;
      }
      // Outros erros 502/503
      const err = new Error(errorMsg || "Serviço temporariamente indisponível. Tente novamente.");
      err.status = response.status;
      err.code = errorCode || "SERVICE_UNAVAILABLE";
      throw err;
    }
    
    const err = new Error(errorMsg);
    err.status = response.status;
    if (errorCode) err.code = errorCode;
    throw err;
  }

  return await response.json();
}

