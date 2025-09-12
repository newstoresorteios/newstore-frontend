// src/services/pix.js
// Serviço para integração com o backend (Render) + fallback mock.
// Agora aceita receber um reservationId já criado no frontend
// (fluxo recomendado): cria o PIX diretamente a partir da reserva.

const API_BASE =
  (process.env.REACT_APP_API_BASE ||
   process.env.REACT_APP_API_BASE_URL ||
   'https://newstore-backend.onrender.com'
  ).replace(/\/+$/, '');

const USE_BACKEND =
  String(process.env.REACT_APP_USE_BACKEND || 'true').toLowerCase() === 'true';

/* ===================== helpers de auth ===================== */

function sanitizeToken(t) {
  if (!t) return '';
  let s = String(t).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1);
  }
  if (/^Bearer\s+/i.test(s)) s = s.replace(/^Bearer\s+/i, '').trim();
  return s.replace(/\s+/g, '');
}

function getAuthToken() {
  try {
    const keys = ['ns_auth_token', 'authToken', 'token', 'jwt', 'access_token'];
    for (const k of keys) {
      const v = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (v) return sanitizeToken(v);
    }
    const m = document.cookie.match(/(?:^|;\s*)(token|jwt)=([^;]+)/i);
    if (m) return sanitizeToken(decodeURIComponent(m[2]));
  } catch {}
  return '';
}

/* ===================== fetch com auth ===================== */

async function doFetch(url, opts = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(url, {
    ...opts,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const msg = text && text.length < 400 ? text : '';
    throw new Error(`${opts.method || 'GET'} ${url} falhou (${res.status}) ${msg}`.trim());
  }

  if (res.status === 204) return null;
  return res.json();
}

/* ===================== chamadas de backend ===================== */

async function createReservationBackend(numbers = []) {
  // retorna { reservationId, ... }
  return doFetch(`${API_BASE}/api/reservations`, {
    method: 'POST',
    body: JSON.stringify({ numbers }),
  });
}

async function createPixBackend(reservationId) {
  // retorna dados do pagamento: { paymentId, status, qr_code, qr_code_base64, ... }
  return doFetch(`${API_BASE}/api/payments/pix`, {
    method: 'POST',
    body: JSON.stringify({ reservationId }),
  });
}

export async function checkPixStatus(paymentId) {
  if (!USE_BACKEND) return { id: paymentId, status: 'pending' };
  return doFetch(`${API_BASE}/api/payments/${paymentId}/status`, { method: 'GET' });
}

/* ===================== mock (dev) ===================== */

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function createPixMock({ amount }) {
  await wait(500);
  const paymentId = String(Math.floor(1e9 + Math.random() * 9e9));
  const cents = String(amount.toFixed(2)).replace('.', '');
  const copy = `00020126580014br.gov.bcb.pix0136PAYLOAD-EXEMPLO-NAO-PAGAVEL520400005303986540${cents}`;
  return {
    paymentId,
    status: 'pending',
    qr_code: copy,
    qr_code_base64: 'iVBORw0KGgoAAAANSUhEUgAA...', // placeholder
    copy_paste_code: copy,
    amount,
    expires_in: 30 * 60,
  };
}

/* ===================== API principal usada pela UI ===================== */
/**
 * createPixPayment:
 *  - Se USE_BACKEND=true:
 *      • usa reservationId se for passado
 *      • senão cria reserva com os números e depois gera o PIX
 *  - Se USE_BACKEND=false: retorna dados mockados
 */
export async function createPixPayment({
  orderId,
  amount,
  numbers = [],
  customer,
  reservationId: maybeReservationId,
}) {
  if (!USE_BACKEND) {
    return createPixMock({ amount });
  }

  // 1) Obter/garantir a reserva
  let reservationId = sanitizeToken(maybeReservationId);
  if (!reservationId) {
    const r = await createReservationBackend(numbers);
    reservationId = r?.reservationId || r?.id || '';
    if (!reservationId) {
      throw new Error('Falha ao criar/obter a reserva.');
    }
  }

  // 2) Criar o PIX
  const data = await createPixBackend(reservationId);

  // 3) Normalizar retorno para a UI
  return {
    paymentId: data.paymentId || data.id,
    status: data.status || 'pending',
    qr_code: data.qr_code || data.copy_paste_code || '',
    qr_code_base64: (data.qr_code_base64 || '').replace(/\s/g, ''),
    copy_paste_code: data.qr_code || data.copy_paste_code || '',
    amount,
    id: data.paymentId || data.id,
    expires_in: data.expires_in ?? 30 * 60,
    reservationId, // devolve para depuração/uso futuro
  };
}
