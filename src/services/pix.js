// src/services/pix.js
// Cliente PIX do frontend -> backend (Render)

const API_BASE =
  (process.env.REACT_APP_API_BASE || process.env.REACT_APP_API_BASE_URL || '')
    .replace(/\/+$/, '');

const USE_BACKEND = String(process.env.REACT_APP_USE_BACKEND || 'true').toLowerCase() === 'true';

// === Token helpers ===
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
    const keys = ['ns_auth_token','authToken','token','jwt','access_token'];
    for (const k of keys) {
      const v = localStorage.getItem(k) || sessionStorage.getItem(k);
      if (v) return sanitizeToken(v);
    }
    const m = document.cookie.match(/(?:^|;\s*)(token|jwt)=([^;]+)/i);
    return m ? sanitizeToken(decodeURIComponent(m[2])) : '';
  } catch {
    return '';
  }
}

// === Fetch wrapper ===
async function doFetch(url, opts = {}) {
  if (!API_BASE) throw new Error('API base não configurada (REACT_APP_API_BASE)');
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, { credentials: 'include', ...opts, headers });

  // Trata 409 (conflitos) devolvendo o JSON pro caller decidir UX
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    const err = new Error('conflict');
    err.status = 409;
    err.body = body;
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error || `${res.statusText} (${res.status})`);
    err.status = res.status;
    err.body = body;
    throw err;
  }

  return res.status === 204 ? null : res.json();
}

// === Backend calls ===
async function createReservationBackend(numbers) {
  return doFetch(`${API_BASE}/api/reservations`, {
    method: 'POST',
    body: JSON.stringify({ numbers }),
  });
}

async function createPixBackend(reservationId) {
  return doFetch(`${API_BASE}/api/payments/pix`, {
    method: 'POST',
    body: JSON.stringify({ reservationId }),
  });
}

export async function checkPixStatus(paymentId) {
  if (!USE_BACKEND) return { id: paymentId, status: 'pending' };
  return doFetch(`${API_BASE}/api/payments/status/${paymentId}`, { // << corrigido
    method: 'GET',
  });
}

// === Mock (dev-only) ===
const delay = (ms) => new Promise(r => setTimeout(r, ms));
async function createPixMock({ amount }) {
  await delay(600);
  const paymentId = String(Math.floor(1e9 + Math.random() * 9e9));
  const cents = String(Number(amount || 0).toFixed(2)).replace('.', '');
  const copy = `0002012658...540${cents}`; // encurtado
  return {
    paymentId,
    status: 'pending',
    qr_code: copy,
    qr_code_base64: '',
    copy_paste_code: copy,
    amount,
    expires_in: 30 * 60,
  };
}

/**
 * API principal usada pela UI:
 * - Se USE_BACKEND=true: cria reserva -> gera PIX no backend.
 * - Caso contrário: retorna mock.
 */
export async function createPixPayment({ orderId, amount, numbers = [], customer } = {}) {
  if (!USE_BACKEND) return createPixMock({ amount });

  // 1) Reserva (retorna { reservationId, ... } no seu backend)
  const reservation = await createReservationBackend(numbers);
  const reservationId = reservation?.reservationId || reservation?.id || reservation;
  if (!reservationId) throw new Error('reservation_failed');

  // 2) Gera PIX
  const data = await createPixBackend(reservationId);

  // Normaliza payload
  return {
    paymentId: data.paymentId || data.id,
    status: data.status || 'pending',
    qr_code: data.qr_code || data.copy_paste_code || '',
    qr_code_base64: (data.qr_code_base64 || '').replace(/\s/g, ''),
    copy_paste_code: data.qr_code || data.copy_paste_code || '',
    amount,
    id: data.paymentId || data.id,
    expires_in: data.expires_in ?? 30 * 60,
    reservationId,
  };
}
