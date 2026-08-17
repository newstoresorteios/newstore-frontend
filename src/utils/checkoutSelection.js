export function normalizeNumbers(numbers) {
  if (!Array.isArray(numbers)) return [];
  return [...new Set(numbers.map(Number).filter((number) => Number.isInteger(number) && number >= 0))]
    .sort((a, b) => a - b);
}

export function buildCheckoutSelection({
  currentDrawId,
  principalNumbers,
  principalUnitPriceCents,
  additionalDraws,
  additionalNumbersByDrawId,
}) {
  const items = [];
  const principal = normalizeNumbers(principalNumbers);
  const principalDrawId = Number(currentDrawId);
  const principalPrice = Math.round(Number(principalUnitPriceCents || 0));
  if (principal.length && Number.isInteger(principalDrawId) && principalDrawId > 0 && principalPrice > 0) {
    items.push({
      drawId: principalDrawId,
      drawType: "principal",
      title: "Sorteio principal",
      numbers: principal,
      unitPriceCents: principalPrice,
      amountCents: principal.length * principalPrice,
    });
  }

  for (const draw of additionalDraws || []) {
    const drawId = Number(draw?.id ?? draw?.draw_id);
    const numbers = normalizeNumbers(
      additionalNumbersByDrawId?.[draw?.id] ?? additionalNumbersByDrawId?.[drawId]
    );
    const price = Math.round(Number(draw?.ticket_price_cents ?? draw?.price_cents ?? 0));
    if (!Number.isInteger(drawId) || drawId <= 0 || !numbers.length || price <= 0) continue;
    const drawType = ["adicional", "secundario"].includes(String(draw?.draw_type).toLowerCase())
      ? String(draw.draw_type).toLowerCase()
      : "adicional";
    items.push({
      drawId,
      drawType,
      title:
        draw?.product_name ||
        draw?.banner_title ||
        (drawType === "secundario" ? `Secundário ${drawId}` : `Adicional ${drawId}`),
      numbers,
      unitPriceCents: price,
      amountCents: numbers.length * price,
    });
  }
  return items.sort((a, b) => a.drawId - b.drawId);
}

export function checkoutSelectionFingerprint(items) {
  return JSON.stringify((items || []).map((item) => ({
    draw_id: Number(item.drawId),
    numbers: normalizeNumbers(item.numbers),
  })));
}

export function getSelectedDrawGroups(items) {
  const groups = new Map();
  for (const item of items || []) {
    const drawId = Number(item?.drawId ?? item?.draw_id);
    const numbers = normalizeNumbers(item?.numbers);
    if (!Number.isInteger(drawId) || drawId <= 0 || !numbers.length) continue;
    const previous = groups.get(drawId);
    groups.set(drawId, previous
      ? { ...previous, numbers: normalizeNumbers([...previous.numbers, ...numbers]) }
      : { ...item, drawId, numbers });
  }
  return [...groups.values()].sort((a, b) => a.drawId - b.drawId);
}

export function shouldShowMultiDrawCheckout(items) {
  return getSelectedDrawGroups(items).length >= 2;
}

export function isCheckoutBatchSettled(payment) {
  return String(payment?.status || "").toLowerCase() === "settled" &&
    payment?.paid === true && payment?.settled === true;
}

export function normalizeCheckoutBatchPayment(payment) {
  if (!payment || typeof payment !== "object" || Array.isArray(payment)) {
    return null;
  }

  const amountCents = Number(
    payment.amount_cents ??
      payment.amountCents ??
      0
  );

  return {
    ...payment,
    paymentId: payment.payment_id ?? payment.paymentId ?? null,
    batchId: payment.batch_id ?? payment.batchId ?? null,
    amount_cents: amountCents,
    amount: amountCents / 100,
    qr_code: payment.qr_code ?? payment.copy_paste_code ?? "",
    qr_code_base64: String(payment.qr_code_base64 ?? "").replace(/\s/g, ""),
    copy_paste_code: payment.copy_paste_code ?? payment.qr_code ?? "",
    expires_at: payment.expires_at ?? null,
    status: payment.status ?? "pending",
    paymentType: "checkout_batch",
    payment_type: "checkout_batch",
  };
}

export function validateCheckoutBatchPaymentResponse(response) {
  const amountCents = Number(response?.amount_cents);
  const hasRequiredFields =
    response &&
    typeof response === "object" &&
    !Array.isArray(response) &&
    String(response.batch_id ?? "").trim() !== "" &&
    String(response.payment_id ?? "").trim() !== "" &&
    response.amount_cents != null &&
    Number.isFinite(amountCents) &&
    String(response.status ?? "").trim() !== "";

  if (!hasRequiredFields) {
    throw new Error("Resposta inválida ao gerar o PIX agrupado.");
  }

  return response;
}

export function toCheckoutPayload(items) {
  return {
    items: (items || []).map((item) => ({
      draw_id: Number(item.drawId),
      numbers: normalizeNumbers(item.numbers),
    })),
  };
}

export function createCheckoutIdempotencyKey(
  cryptoObject = typeof window !== "undefined" ? window.crypto : undefined
) {
  if (typeof cryptoObject?.randomUUID === "function") return cryptoObject.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof cryptoObject?.getRandomValues === "function") cryptoObject.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function formatCheckoutMoney(cents) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
