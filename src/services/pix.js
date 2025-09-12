// src/services/pix.js
// Serviço para integrar o PIX sem acoplar a UI ao provedor.
// Suporta backend real (Render) e mock local.

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'https://newstore-backend.onrender.com').replace(/\/+$/, '');
const USE_BACKEND  = (process.env.REACT_APP_USE_BACKEND === 'true');

/* ================= Helpers de Auth ================= */

function getAuthToken() {
  try {
    const keys = ['ns_auth_token', 'authToken', 'token', 'jwt', 'access_token'];
    let raw = '';
    for (const k of keys) {
      raw = localStorage.getItem(k) || sessionStorage.getItem(k) || '';
      if (raw) break;
    }
    if (!raw) {
      const m = document.cookie.match(/(?:^|;\s*)(token|jwt)=([^;]+)/i);
      if (m) raw = decodeURIComponent(m[2]);
    }
    return sanitizeToken(raw);
  } catch {
    return '';
  }
}
function sanitizeToken(t) {
  if (!t) return '';
  let s = String(t).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) s = s.slice(1, -1);
  if (/^Bearer\s+/i.test(s)) s = s.replace(/^Bearer\s+/i, '').trim();
  return s.replace(/\s+/g, '');
}

/* ================= Fetch com Auth ================= */

async function doFetch(url, opts = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, {
    credentials: 'include',
    ...opts,
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${opts.method || 'GET'} ${url} falhou (${res.status}) ${text || ''}`.trim());
  }
  if (res.status === 204) return null;
  return res.json();
}

/* ================= Chamadas ao backend ================= */

async function createReservationBackend(numbers) {
  const json = await doFetch(`${API_BASE_URL}/api/reservations`, {
    method: 'POST',
    body: JSON.stringify({ numbers }),
  });
  const reservationId = json?.reservationId || json?.id || json;
  if (!reservationId || typeof reservationId !== 'string') {
    console.debug('[pix] payload /reservations inesperado:', json);
    throw new Error('Falha ao obter reservationId');
  }
  return reservationId;
}

async function createPixBackend(reservationId) {
  return doFetch(`${API_BASE_URL}/api/payments/pix`, {
    method: 'POST',
    body: JSON.stringify({ reservationId }),
  });
}

export async function checkPixStatus(paymentId) {
  if (!USE_BACKEND) return { id: paymentId, status: 'pending' };
  return doFetch(`${API_BASE_URL}/api/payments/${paymentId}/status`, { method: 'GET' });
}

/* ================= Mock (dev) ================= */

function timeout(ms) { return new Promise(r => setTimeout(r, ms)); }
async function createPixMock({ amount }) {
  await timeout(600);
  const paymentId = String(Math.floor(1e9 + Math.random() * 9e9));
  const cents = String(amount.toFixed(2)).replace('.', '');
  const copy = `00020126580014br.gov.bcb.pix0136EXEMPLO-DE-PAYLOAD-PIX-NAO-PAGAVEL520400005303986540${cents}`;
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6e...'; // placeholder
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

/* ================= API principal =================
 * - Se USE_BACKEND=true: usa reservationId informado ou cria uma reserva,
 *   depois chama /api/payments/pix.
 * - Caso contrário: usa mock local.
 */
export async function createPixPayment({ orderId, amount, numbers = [], reservationId }) {
  if (!USE_BACKEND) {
    return createPixMock({ amount });
  }

  const rid = reservationId || await createReservationBackend(numbers);
  console.debug('[pix] usando reservationId =', rid);

  const data = await createPixBackend(rid);

  return {
    paymentId: data.paymentId || data.id,
    status: data.status || 'pending',
    qr_code: data.qr_code || data.copy_paste_code || '',
    qr_code_base64: (data.qr_code_base64 || '').replace(/\s/g, ''),
    copy_paste_code: data.qr_code || data.copy_paste_code || '',
    amount,
    id: data.paymentId || data.id,
    expires_in: data.expires_in ?? 30 * 60,
    reservationId: rid, // <-- útil para depurar/consultas
  };
}
