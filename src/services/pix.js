// src/services/pix.js
// Serviço para integrar o PIX sem acoplar a UI ao provedor.
// Suporta backend real (Render) e mock local.

const API_BASE_URL =
  (process.env.REACT_APP_API_BASE_URL || 'https://lancaster-backend.onrender.com').replace(/\/+$/,'');
const USE_BACKEND = (process.env.REACT_APP_USE_BACKEND === 'true');

/** Recupera o JWT salvo pelo login (ajuste o key name se necessário). */
/** Lê token do storage/cookie e sanitiza para "puro JWT" */
function getAuthToken() {
  try {
    const keys = [
      'ns_auth_token',
      'authToken',
      'token',
      'jwt',
      'access_token',
    ];
    let raw = '';
    for (const k of keys) {
      raw =
        localStorage.getItem(k) ||
        sessionStorage.getItem(k) ||
        '';
      if (raw) break;
    }
    if (!raw) {
      // tenta cookie "token" (ou "jwt")
      const cookieMatch =
        document.cookie.match(/(?:^|;\s*)(token|jwt)=([^;]+)/i);
      if (cookieMatch) raw = decodeURIComponent(cookieMatch[2]);
    }
    return sanitizeToken(raw);
  } catch {
    return '';
  }
}

/** Remove "Bearer ", aspas e espaços; retorna só o JWT */
function sanitizeToken(t) {
  if (!t) return '';
  let s = String(t).trim();
  // tira aspas acidentais
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  // se veio "Bearer <jwt>", pega só o segundo pedaço
  if (/^Bearer\s+/i.test(s)) {
    s = s.replace(/^Bearer\s+/i, '').trim();
  }
  // remove espaços fantasmas
  s = s.replace(/\s+/g, '');
  return s;
}


/** Fetch com headers de auth e credenciais (envia cookie se houver). */
async function doFetch(url, opts = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, {
    credentials: 'include', // garante envio de cookie de sessão
    ...opts,
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const msg = text && text.length < 300 ? text : '';
    throw new Error(`${opts.method || 'GET'} ${url} falhou (${res.status}) ${msg}`.trim());
  }
  // 204 não tem body
  if (res.status === 204) return null;
  return res.json();
}

/** Backend: cria a reserva. Espera { id }. */
async function createReservationBackend(numbers) {
  return doFetch(`${API_BASE_URL}/api/reservations`, {
    method: 'POST',
    body: JSON.stringify({ numbers }),
  });
}

/** Backend: cria o PIX a partir da reserva. Espera { paymentId, status, qr_code, qr_code_base64 }. */
async function createPixBackend(reservationId) {
  return doFetch(`${API_BASE_URL}/api/payments/pix`, {
    method: 'POST',
    body: JSON.stringify({ reservationId }),
  });
}

/** Backend: consulta status do pagamento. */
export async function checkPixStatus(paymentId) {
  if (!USE_BACKEND) return { id: paymentId, status: 'pending' };
  return doFetch(`${API_BASE_URL}/api/payments/${paymentId}/status`, {
    method: 'GET',
  });
}

/** MOCK provider: gera payload fake só para UI/dev. */
function timeout(ms) { return new Promise(r => setTimeout(r, ms)); }
async function createPixMock({ amount }) {
  await timeout(600);
  const paymentId = String(Math.floor(1e9 + Math.random() * 9e9));
  const cents = String(amount.toFixed(2)).replace('.', '');
  const copy = `00020126580014br.gov.bcb.pix0136EXEMPLO-DE-PAYLOAD-PIX-NAO-PAGAVEL520400005303986540${cents}`;
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAACXBIWXMAAAsSAAALEgHS3X78AAAAGXRFWHRTb2Z0d2FyZQBwYWludC5uZXQgNC4xLjM0b0VZAAABxk...'; // placeholder
  return {
    paymentId,
    status: 'pending',
    qr_code: copy,
    qr_code_base64: pngBase64,
    copy_paste_code: copy,
    amount,
    expires_in: 30 * 60,
  };
}

/**
 * API principal usada pela UI:
 * - Se USE_BACKEND=true: cria reserva -> gera PIX no backend.
 * - Caso contrário: usa mock local para validar a tela.
 */
export async function createPixPayment({ orderId, amount, numbers = [], customer }) {
  if (USE_BACKEND) {
    // 1) Reserva
    const reservation = await createReservationBackend(numbers);
    const reservationId = reservation?.id || reservation?.reservationId || reservation;

    // 2) Gera PIX
    const data = await createPixBackend(reservationId);

    // Normaliza campos esperados pela UI
    return {
      paymentId: data.paymentId || data.id,
      status: data.status || 'pending',
      qr_code: data.qr_code || data.copy_paste_code || '',
      qr_code_base64: (data.qr_code_base64 || '').replace(/\s/g, ''),
      copy_paste_code: data.qr_code || data.copy_paste_code || '',
      amount,
      id: data.paymentId || data.id,
      expires_in: data.expires_in ?? 30 * 60,
    };
  }

  // Mock
  return createPixMock({ amount });
}
