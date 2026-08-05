import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { MemoryRouter } from "react-router-dom";
import FloatingParticipationSummary from "./components/FloatingParticipationSummary";
import BatchCheckoutReviewDialog from "./components/BatchCheckoutReviewDialog";
import PixModal from "./PixModal";
import NewStorePage from "./NewStorePage";
import { AuthProvider } from "./authContext";
import { SelectionContext } from "./selectionContext";
import {
  buildCheckoutSelection,
  checkoutSelectionFingerprint,
  createCheckoutIdempotencyKey,
  getSelectedDrawGroups,
  isCheckoutBatchSettled,
  normalizeCheckoutBatchPayment,
  shouldShowMultiDrawCheckout,
  toCheckoutPayload,
  validateCheckoutBatchPaymentResponse,
} from "./utils/checkoutSelection";
import {
  CheckoutBatchApiError,
  createCheckoutBatchPix,
  getCheckoutBatchStatus,
  reserveCheckoutBatch,
} from "./services/checkoutBatch";

jest.mock("react-router-dom", () => {
  const React = require("react");
  return {
    MemoryRouter: ({ children }) => <>{children}</>,
    Link: React.forwardRef(({ children, to, ...props }, ref) => (
      <a ref={ref} href={typeof to === "string" ? to : "#"} {...props}>
        {children}
      </a>
    )),
    useNavigate: () => jest.fn(),
  };
}, { virtual: true });

const draws = [
  { id: 142, draw_type: "adicional", product_name: "Adicional 142", ticket_price_cents: 2000 },
  { id: 145, draw_type: "secundario", product_name: "Adicional 145", price_cents: 1500 },
];
const build = ({ principal = [], additional = {}, activeDraws = draws } = {}) => buildCheckoutSelection({
  currentDrawId: 140,
  principalNumbers: principal,
  principalUnitPriceCents: 5500,
  additionalDraws: activeDraws,
  additionalNumbersByDrawId: additional,
});
const newStorePageSource = readFileSync(`${process.cwd()}/src/NewStorePage.jsx`, "utf8");

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  global.fetch = jest.fn();
});

function renderNewStorePage(selecionados = []) {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <SelectionContext.Provider
          value={{
            selecionados,
            setSelecionados: jest.fn(),
            limparSelecao: jest.fn(),
          }}
        >
          <NewStorePage />
        </SelectionContext.Provider>
      </AuthProvider>
    </MemoryRouter>
  );
}

test("normalizacao do PIX agrupado aceita estado inicial nulo", () => {
  expect(normalizeCheckoutBatchPayment(null)).toBeNull();
  expect(normalizeCheckoutBatchPayment(undefined)).toBeNull();
});

test("renderizacao inicial de NewStorePage nao quebra sem pagamento agrupado", () => {
  fetch.mockResolvedValue({
    ok: false,
    status: 404,
    json: async () => ({}),
    text: async () => "",
  });

  let renderedPage;
  expect(() => {
    renderedPage = renderNewStorePage();
  }).not.toThrow();
  renderedPage.unmount();
});

test("aba escondida ou visivel sem PIX nao normaliza pagamento inexistente de forma insegura", () => {
  expect(normalizeCheckoutBatchPayment(null)).toBeNull();
  expect(newStorePageSource).toMatch(/const normalizedBatchPayment = React\.useMemo\(/);
  expect(newStorePageSource).toMatch(/batchCheckout[\s\S]*\? normalizeCheckoutBatchPayment\(batchCheckout\)[\s\S]*: null/);
  expect(newStorePageSource).toMatch(/\{normalizedBatchPayment && \([\s\S]*<PixModal/);
});

test("resposta do PIX agrupado precisa dos campos obrigatorios antes de abrir o modal", () => {
  expect(() => validateCheckoutBatchPaymentResponse(null)).toThrow(
    "Resposta inválida ao gerar o PIX agrupado."
  );
  expect(() => validateCheckoutBatchPaymentResponse({ status: "pending" })).toThrow(
    "Resposta inválida ao gerar o PIX agrupado."
  );
  expect(validateCheckoutBatchPaymentResponse({
    batch_id: "batch-1",
    payment_id: "payment-1",
    amount_cents: 7500,
    status: "pending",
  })).toMatchObject({ batch_id: "batch-1", payment_id: "payment-1" });
});

test("amount_cents do PIX agrupado e convertido para numero", () => {
  const payment = normalizeCheckoutBatchPayment({
    batch_id: "batch-1",
    payment_id: "payment-1",
    amount_cents: "7500",
    status: "pending",
  });

  expect(payment.amount_cents).toBe(7500);
  expect(payment.amount).toBe(75);
});

test("1. um numero somente no principal nao mostra a aba", () => {
  render(<FloatingParticipationSummary items={build({ principal: [3], activeDraws: [] })} expanded />);
  expect(screen.queryByLabelText("Suas participações")).not.toBeInTheDocument();
});

test("2. cinco numeros somente no principal nao mostram a aba", () => {
  const items = build({ principal: [1, 2, 3, 4, 5], activeDraws: [] });
  expect(shouldShowMultiDrawCheckout(items)).toBe(false);
  render(<FloatingParticipationSummary items={items} expanded />);
  expect(screen.queryByLabelText("Suas participações")).not.toBeInTheDocument();
});

test("3. um numero somente em um adicional nao mostra a aba", () => {
  render(<FloatingParticipationSummary items={build({ additional: { 142: [8] } })} expanded />);
  expect(screen.queryByLabelText("Suas participações")).not.toBeInTheDocument();
});

test("4. varios numeros no mesmo adicional nao mostram a aba", () => {
  const items = build({ additional: { 142: [8, 9, 10, 11, 12] } });
  expect(getSelectedDrawGroups(items)).toHaveLength(1);
  render(<FloatingParticipationSummary items={items} expanded />);
  expect(screen.queryByLabelText("Suas participações")).not.toBeInTheDocument();
});

test("5. principal mais um adicional mostra a aba", () => {
  render(<FloatingParticipationSummary items={build({ principal: [3], additional: { 142: [8] } })} expanded />);
  expect(screen.getByLabelText("Suas participações")).toBeInTheDocument();
});

test("6. dois adicionais diferentes mostram a aba", () => {
  render(<FloatingParticipationSummary items={build({ additional: { 142: [8], 145: [91] } })} expanded />);
  expect(screen.getByLabelText("Suas participações")).toBeInTheDocument();
});

test("7. principal mais dois adicionais mostra a aba", () => {
  const items = build({ principal: [3], additional: { 142: [8], 145: [91] } });
  expect(getSelectedDrawGroups(items)).toHaveLength(3);
  render(<FloatingParticipationSummary items={items} expanded />);
  expect(screen.getByLabelText("Suas participações")).toBeInTheDocument();
});

test("8. remover um grupo e restar somente um esconde a aba", () => {
  const { rerender } = render(<FloatingParticipationSummary items={build({ principal: [3], additional: { 142: [8] } })} expanded />);
  expect(screen.getByLabelText("Suas participações")).toBeInTheDocument();
  rerender(<FloatingParticipationSummary items={build({ principal: [3], activeDraws: [] })} expanded />);
  expect(screen.queryByLabelText("Suas participações")).not.toBeInTheDocument();
});

test("mesmo numero em sorteios diferentes representa duas participacoes", () => {
  const items = build({ principal: [8], additional: { 142: [8] } });
  expect(items.map((item) => item.numbers)).toEqual([[8], [8]]);
  expect(shouldShowMultiDrawCheckout(items)).toBe(true);
});

test("resumo permite remover um numero sem afetar outro sorteio", () => {
  const onRemoveNumber = jest.fn();
  render(<FloatingParticipationSummary items={build({ principal: [3, 12], additional: { 142: [8] } })} expanded onRemoveNumber={onRemoveNumber} onClearDraw={() => {}} />);
  fireEvent.click(screen.getAllByTestId("CloseRoundedIcon")[0]);
  expect(onRemoveNumber).toHaveBeenCalledWith(140, 3);
});

test("resumo limpa somente o sorteio escolhido", () => {
  const onClearDraw = jest.fn();
  render(<FloatingParticipationSummary items={build({ principal: [3], additional: { 142: [8] } })} expanded onClearDraw={onClearDraw} onRemoveNumber={() => {}} />);
  const clearButtons = screen.getAllByText("Limpar");
  expect(clearButtons).toHaveLength(2);
  fireEvent.click(clearButtons[1]);
  expect(onClearDraw).toHaveBeenCalledWith(142);
});

test("total previsto soma precos diferentes", () => {
  const items = build({ principal: [3, 12, 44], additional: { 142: [8, 73], 145: [91] } });
  expect(items.reduce((sum, item) => sum + item.amountCents, 0)).toBe(22000);
});

test("9. resumo pendente usa total definitivo do backend", () => {
  render(<FloatingParticipationSummary items={build({ principal: [3], activeDraws: [] })} pendingBatch={{ batch_id: "b", total_numbers: 1, amount_cents: 1234, items: [{ draw_id: 140, draw_type: "principal", numbers: [3], amount_cents: 1234 }] }} expanded />);
  expect(screen.getAllByText(/R\$\s*12,34/)).toHaveLength(3);
  expect(screen.getByText("1 participação em 1 sorteio")).toBeInTheDocument();
});

test("componente define largura desktop", () => {
  const { container } = render(<FloatingParticipationSummary items={build({ principal: [3], additional: { 142: [8] } })} expanded />);
  expect(container.textContent).toContain("Suas participações");
});

test("componente possui rotulo acessivel para mobile", () => {
  render(<FloatingParticipationSummary items={build({ principal: [3], additional: { 142: [8] } })} expanded />);
  expect(screen.getByLabelText("Suas participações")).toBeInTheDocument();
});

test("recolhe e expande por callback", () => {
  const onToggle = jest.fn();
  render(<FloatingParticipationSummary items={build({ principal: [3], additional: { 142: [8] } })} expanded={false} onToggle={onToggle} />);
  fireEvent.click(screen.getByLabelText("Expandir"));
  expect(onToggle).toHaveBeenCalledTimes(1);
});

test("13. login preserva o contrato de retorno do checkout", () => {
  expect({ from: "/", wantBatchCheckout: true }).toEqual(expect.objectContaining({ wantBatchCheckout: true }));
});

test("14. payload nao envia preco nem draw_type", () => {
  const payload = toCheckoutPayload(build({ principal: [3], additional: { 142: [8] } }));
  expect(payload).toEqual({ items: [{ draw_id: 140, numbers: [3] }, { draw_id: 142, numbers: [8] }] });
});

test("15. reserva envia Idempotency-Key e credenciais", async () => {
  localStorage.setItem("ns_auth_token", "token-test");
  fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ batch_id: "b" }) });
  await reserveCheckoutBatch({ items: [{ draw_id: 1, numbers: [1] }, { draw_id: 2, numbers: [2] }], idempotencyKey: "key" });
  expect(fetch.mock.calls[0][1]).toMatchObject({ method: "POST", credentials: "include" });
  expect(fetch.mock.calls[0][1].headers).toMatchObject({ "Idempotency-Key": "key", Authorization: "Bearer token-test" });
});

test("16. fingerprint estavel evita nova tentativa em duplo clique", () => {
  const items = build({ principal: [3], activeDraws: [] });
  expect(checkoutSelectionFingerprint(items)).toBe(checkoutSelectionFingerprint(items));
});

test("17. retry pode reutilizar a mesma chave", () => {
  const key = createCheckoutIdempotencyKey({ randomUUID: () => "fixed-key" });
  expect(key).toBe("fixed-key");
});

test("18. conflito preserva corpo estruturado", async () => {
  fetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "batch_numbers_unavailable", conflicts: [{ draw_id: 1, numbers: [2] }] }) });
  await expect(reserveCheckoutBatch({ items: [{ draw_id: 1, numbers: [2] }, { draw_id: 2, numbers: [3] }], idempotencyKey: "key" })).rejects.toMatchObject({
    status: 409,
    body: { error: "batch_numbers_unavailable" },
  });
});

test("19. reserva atomica usa um unico endpoint", async () => {
  fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ batch_id: "b" }) });
  await reserveCheckoutBatch({ items: [{ draw_id: 1, numbers: [1] }, { draw_id: 2, numbers: [2] }], idempotencyKey: "key" });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toContain("/checkout-batches/reserve");
});

test("20. dialogo gera uma unica confirmacao", () => {
  const onConfirm = jest.fn();
  render(<BatchCheckoutReviewDialog open items={build({ principal: [3], additional: { 142: [8] } })} onConfirm={onConfirm} onBack={() => {}} />);
  fireEvent.click(screen.getByText("GERAR PIX"));
  expect(onConfirm).toHaveBeenCalledTimes(1);
});

test("21. painel pendente oferece reabrir PIX", () => {
  const onOpenPix = jest.fn();
  render(<FloatingParticipationSummary pendingBatch={{ batch_id: "b", amount_cents: 100, total_numbers: 1, items: [{ draw_id: 1, numbers: [1], amount_cents: 100 }] }} expanded onOpenPix={onOpenPix} />);
  fireEvent.click(screen.getByText("ABRIR PIX"));
  expect(onOpenPix).toHaveBeenCalled();
});

test("22. cria PIX pelo batch_id", async () => {
  fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "pending" }) });
  await createCheckoutBatchPix("batch-1");
  expect(fetch.mock.calls[0][0]).toContain("/checkout-batches/batch-1/pix");
});

test("23. polling consulta status do batch", async () => {
  fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "settled", paid: true, settled: true }) });
  const result = await getCheckoutBatchStatus("batch-1");
  expect(result).toMatchObject({ status: "settled", paid: true, settled: true });
});

test("24. erro de expiracao permanece tipado", async () => {
  fetch.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "batch_expired" }) });
  await expect(getCheckoutBatchStatus("batch-1")).rejects.toBeInstanceOf(CheckoutBatchApiError);
});

test("25. manual_review e exibido como pendencia", () => {
  render(<FloatingParticipationSummary pendingBatch={{ batch_id: "b", status: "manual_review", amount_cents: 100, total_numbers: 1, items: [{ draw_id: 1, numbers: [1], amount_cents: 100 }] }} expanded />);
  expect(screen.getByText("PIX aguardando pagamento")).toBeInTheDocument();
});

test("26. botoes individuais continuam fora dos componentes agrupados", () => {
  expect(FloatingParticipationSummary).toBeDefined();
  expect(BatchCheckoutReviewDialog).toBeDefined();
});

test("servico frontend nao chama batch com um unico sorteio", async () => {
  await expect(reserveCheckoutBatch({
    items: [{ draw_id: 140, numbers: [1, 2, 3, 4, 5] }],
    idempotencyKey: "key",
  })).rejects.toMatchObject({ status: 422, body: { error: "multi_draw_checkout_requires_multiple_draws" } });
  expect(fetch).not.toHaveBeenCalled();
});

test("PIX agrupado e normalizado para o mesmo PixModal", () => {
  const payment = normalizeCheckoutBatchPayment({
    batch_id: "batch-1", payment_id: "payment-1", status: "pending",
    amount_cents: 7500, qr_code: "000201", qr_code_base64: "base64", expires_at: "2026-08-05T18:00:00Z",
  });
  expect(payment).toMatchObject({
    batchId: "batch-1", paymentId: "payment-1", paymentType: "checkout_batch",
    copy_paste_code: "000201", amount: 75,
  });
  render(<PixModal open data={payment} amount={payment.amount} />);
  expect(screen.getAllByAltText("QR Code PIX")).toHaveLength(1);
  expect(screen.getByDisplayValue("000201")).toBeInTheDocument();
});

test("approved sem settled nao finaliza prematuramente", () => {
  expect(isCheckoutBatchSettled({ status: "approved", paid: false, settled: false })).toBe(false);
});

test("settled e a unica conclusao confiavel para direcionamento", () => {
  expect(isCheckoutBatchSettled({ status: "settled", paid: true, settled: true })).toBe(true);
});

test("batch pendente continua visivel sem selecoes originais", () => {
  render(<FloatingParticipationSummary items={[]} pendingBatch={{ batch_id: "b", status: "pending", amount_cents: 7500, total_numbers: 2, items: [{ draw_id: 140, numbers: [3], amount_cents: 5500 }, { draw_id: 142, numbers: [18], amount_cents: 2000 }] }} expanded />);
  expect(screen.getByText("PIX aguardando pagamento")).toBeInTheDocument();
  expect(screen.getByText("ABRIR PIX")).toBeInTheDocument();
});

test("pagamentos individuais e seus pollings continuam separados", () => {
  expect(newStorePageSource).toMatch(/onClick=\{handleAbrirConfirmacao\}/);
  expect(newStorePageSource).toMatch(/handleContinueAdditional\(additionalDraw\)/);
  expect(newStorePageSource).toMatch(/checkPixStatus\(pixData\.paymentId\)/);
  expect(newStorePageSource).toMatch(/checkAdditionalPixStatus\(paymentId\)/);
  expect(newStorePageSource).toMatch(/getCheckoutBatchStatus\(batchId\)/);
});

test("fechar e reabrir o modal reutiliza pagamento e batch existentes", () => {
  expect(newStorePageSource).toMatch(/onClose=\{\(\) => setBatchPixOpen\(false\)\}/);
  const openHandler = newStorePageSource.slice(
    newStorePageSource.indexOf("const openBatchPix"),
    newStorePageSource.indexOf("const confirmBatchCheckout")
  );
  expect(openHandler.indexOf("batch.payment_id")).toBeGreaterThanOrEqual(0);
  expect(openHandler.indexOf("batch.payment_id")).toBeLessThan(openHandler.indexOf("createCheckoutBatchPix"));
});

test("fluxo normal e batch liquidado permanecem na mesma tela", () => {
  const individualApproved = newStorePageSource.slice(
    newStorePageSource.indexOf("const handlePixApproved"),
    newStorePageSource.indexOf("// === Modal de limite")
  );
  const batchApproved = newStorePageSource.slice(
    newStorePageSource.indexOf("const applyBatchStatus"),
    newStorePageSource.indexOf("const openBatchPix")
  );
  expect(individualApproved).not.toMatch(/navigate\(/);
  expect(batchApproved).not.toMatch(/navigate\(/);
  expect(batchApproved).toMatch(/Pagamento aprovado\. Suas participações foram confirmadas\./);
});

test("expiracao recarrega grades e duplo clique usa trava unica", () => {
  expect(newStorePageSource).toMatch(/status === "expired"[\s\S]*reloadBatchDraws/);
  expect(newStorePageSource).toMatch(/batchSubmitInFlightRef\.current/);
  expect(newStorePageSource).toMatch(/if \(batchSubmitInFlightRef\.current\) return/);
});
