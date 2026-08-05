import { apiJoin, authHeaders } from "../lib/api";
import { shouldShowMultiDrawCheckout } from "../utils/checkoutSelection";

export class CheckoutBatchApiError extends Error {
  constructor(status, body) {
    super(body?.error || `checkout_batch_${status}`);
    this.name = "CheckoutBatchApiError";
    this.status = status;
    this.body = body || {};
  }
}

async function request(path, { method = "GET", body, headers = {} } = {}) {
  const response = await fetch(apiJoin(path), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...headers,
    },
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new CheckoutBatchApiError(response.status, payload);
  return payload;
}

export async function reserveCheckoutBatch({ items, idempotencyKey }) {
  if (!shouldShowMultiDrawCheckout(items)) {
    throw new CheckoutBatchApiError(422, {
      error: "multi_draw_checkout_requires_multiple_draws",
      message: "O pagamento agrupado exige seleções em pelo menos dois sorteios diferentes.",
    });
  }
  return request("/checkout-batches/reserve", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: { items },
  });
}

export function createCheckoutBatchPix(batchId) {
  return request(`/checkout-batches/${encodeURIComponent(batchId)}/pix`, { method: "POST" });
}

export function getCheckoutBatchStatus(batchId) {
  return request(`/checkout-batches/${encodeURIComponent(batchId)}/status`);
}
