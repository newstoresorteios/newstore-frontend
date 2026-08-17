import { render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "fs";
import { MemoryRouter } from "react-router-dom";
import NewStorePage from "./NewStorePage";
import { AuthProvider } from "./authContext";
import { SelectionContext } from "./selectionContext";

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

const newStorePageSource = readFileSync(`${process.cwd()}/src/NewStorePage.jsx`, "utf8");

function draw({ id, status, banner_title, max_numbers_per_selection = 5 }) {
  return {
    id,
    status,
    draw_type: "adicional",
    product_name: banner_title,
    banner_title,
    promo_phrase: banner_title,
    ticket_price_cents: 500,
    max_numbers_per_selection,
    opened_at: "2026-07-01T12:00:00.000Z",
    closed_at: status === "closed" ? "2026-08-05T12:00:00.000Z" : null,
  };
}

function numberRow(n, extra = {}) {
  return { n, status: "available", reservation_id: null, owner_initials: null, buyer_initials: null, owner_name: null, ...extra };
}

function mockFetchWithDraws(draws, numbersByDrawId = {}) {
  global.fetch = jest.fn((url) => {
    const href = String(url);
    if (href.includes("/api/additional-draws/landing")) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ draws }) });
    }
    const numbersMatch = href.match(/\/api\/additional-draws\/(\d+)\/numbers/);
    if (numbersMatch) {
      const drawId = Number(numbersMatch[1]);
      const numbers = numbersByDrawId[drawId] || Array.from({ length: 100 }, (_, n) => numberRow(n));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ draw_id: drawId, numbers }),
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: async () => ({}), text: async () => "" });
  });
}

function renderNewStorePage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <SelectionContext.Provider
          value={{ selecionados: [], setSelecionados: jest.fn(), limparSelecao: jest.fn() }}
        >
          <NewStorePage />
        </SelectionContext.Provider>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// A pagina sempre renderiza a grade do sorteio principal tambem (00..99,
// botoes LIMPAR SELEÇÃO/CONTINUAR proprios). Para nao confundir com o card
// do adicional/secundario sob teste, escopamos as consultas ao Paper que
// contem o banner daquele draw especifico.
function cardFor(bannerText) {
  const banner = screen.getByText(bannerText);
  const paper = banner.closest(".MuiPaper-root");
  if (!paper) throw new Error(`Paper do card nao encontrado para "${bannerText}"`);
  return within(paper);
}

test("1. draw open continua aparecendo", async () => {
  mockFetchWithDraws([draw({ id: 143, status: "open", banner_title: "SORTEIO ABERTO" })]);
  renderNewStorePage();
  expect(await screen.findByText("SORTEIO ABERTO")).toBeInTheDocument();
});

test("2. draw closed aparece", async () => {
  mockFetchWithDraws([draw({ id: 145, status: "closed", banner_title: "SORTEIO DE R$ 2500,00 EM COMPRAS NO SITE." })]);
  renderNewStorePage();
  expect(await screen.findByText("SORTEIO DE R$ 2500,00 EM COMPRAS NO SITE.")).toBeInTheDocument();
});

test("3. dois draws closed aparecem simultaneamente", async () => {
  mockFetchWithDraws([
    draw({ id: 144, status: "closed", banner_title: "ENCERRADO A" }),
    draw({ id: 145, status: "closed", banner_title: "ENCERRADO B" }),
  ]);
  renderNewStorePage();
  expect(await screen.findByText("ENCERRADO A")).toBeInTheDocument();
  expect(await screen.findByText("ENCERRADO B")).toBeInTheDocument();
});

test("4. três draws closed aparecem simultaneamente", async () => {
  mockFetchWithDraws([
    draw({ id: 143, status: "closed", banner_title: "ENCERRADO 1" }),
    draw({ id: 144, status: "closed", banner_title: "ENCERRADO 2" }),
    draw({ id: 145, status: "closed", banner_title: "ENCERRADO 3" }),
  ]);
  renderNewStorePage();
  expect(await screen.findByText("ENCERRADO 1")).toBeInTheDocument();
  expect(await screen.findByText("ENCERRADO 2")).toBeInTheDocument();
  expect(await screen.findByText("ENCERRADO 3")).toBeInTheDocument();
});

test("5. texto 'Sorteio encerrado' aparece para draw closed", async () => {
  mockFetchWithDraws([draw({ id: 145, status: "closed", banner_title: "ENCERRADO" })]);
  renderNewStorePage();
  expect(await screen.findByText("Sorteio encerrado")).toBeInTheDocument();
});

test("6. número closed não é clicável", async () => {
  mockFetchWithDraws([draw({ id: 145, status: "closed", banner_title: "ENCERRADO" })]);
  renderNewStorePage();
  await screen.findByText("ENCERRADO");
  const card = cardFor("ENCERRADO");
  await waitFor(() => {
    const cell = card.getByText("00").closest("button");
    expect(cell).toBeDisabled();
  });
});

test("7. botão CONTINUAR fica desabilitado no closed", async () => {
  mockFetchWithDraws([draw({ id: 145, status: "closed", banner_title: "ENCERRADO" })]);
  renderNewStorePage();
  await screen.findByText("ENCERRADO");
  const card = cardFor("ENCERRADO");
  expect(card.getByText("CONTINUAR").closest("button")).toBeDisabled();
});

test("8. botão LIMPAR SELEÇÃO fica desabilitado no closed", async () => {
  mockFetchWithDraws([draw({ id: 145, status: "closed", banner_title: "ENCERRADO" })]);
  renderNewStorePage();
  await screen.findByText("ENCERRADO");
  const card = cardFor("ENCERRADO");
  expect(card.getByText("LIMPAR SELEÇÃO").closest("button")).toBeDisabled();
});

test("10. vendido exibe número + iniciais no closed", async () => {
  mockFetchWithDraws(
    [draw({ id: 145, status: "closed", banner_title: "ENCERRADO" })],
    { 145: [numberRow(0, { status: "sold", owner_initials: "JL", buyer_initials: "JL", owner_name: "João Lima" })] }
  );
  renderNewStorePage();
  await screen.findByText("ENCERRADO");
  const card = cardFor("ENCERRADO");
  await waitFor(() => expect(card.getByText("00")).toBeInTheDocument());
  expect(card.getByText("JL")).toBeInTheDocument();
});

test("11. número sem comprador não inventa iniciais", async () => {
  mockFetchWithDraws(
    [draw({ id: 145, status: "closed", banner_title: "ENCERRADO" })],
    { 145: [numberRow(2, { status: "available" })] }
  );
  renderNewStorePage();
  await screen.findByText("ENCERRADO");
  const card = cardFor("ENCERRADO");
  await waitFor(() => expect(card.getByText("02")).toBeInTheDocument());
  expect(card.queryByText("JL")).not.toBeInTheDocument();
});

test("13. open continua selecionável (número disponível não fica desabilitado)", async () => {
  mockFetchWithDraws(
    [draw({ id: 143, status: "open", banner_title: "ABERTO" })],
    { 143: [numberRow(5, { status: "available" })] }
  );
  renderNewStorePage();
  await screen.findByText("ABERTO");
  const card = cardFor("ABERTO");
  await waitFor(() => {
    const cell = card.getByText("05").closest("button");
    expect(cell).not.toBeDisabled();
  });
});

// --- comportamento de implementação travado por assinatura de código (mesmo padrão de checkoutBatch.test.jsx) ---

test("guard: handleAdditionalNumberClick retorna imediatamente para draw closed antes de qualquer seleção", () => {
  const handlerBlock = newStorePageSource.slice(
    newStorePageSource.indexOf("const handleAdditionalNumberClick"),
    newStorePageSource.indexOf("const handleReserveAdditionalNumbers")
  );
  const guardIndex = handlerBlock.indexOf('String(draw?.status || "").toLowerCase() === "closed"');
  const selectionIndex = handlerBlock.indexOf("setSelectedAdditionalNumbersByDrawId");
  expect(guardIndex).toBeGreaterThan(-1);
  expect(selectionIndex).toBeGreaterThan(-1);
  expect(guardIndex).toBeLessThan(selectionIndex);
});

test("9. célula fica com estilo de indisponível (vermelho) quando isClosed, ignorando o status real", () => {
  const cellSxBlock = newStorePageSource.slice(
    newStorePageSource.indexOf("const getAdditionalCellSx"),
    newStorePageSource.indexOf("const isAdditionalSelected")
  );
  expect(cellSxBlock).toMatch(/if \(isClosed\) \{/);
  expect(cellSxBlock).toMatch(/borderColor: "error\.main"/);
  // o guard isClosed precisa vir antes dos ramos de status (available/reserved/sold)
  const closedGuardIndex = cellSxBlock.indexOf("if (isClosed)");
  const availableBranchIndex = cellSxBlock.indexOf('status === "available"');
  expect(closedGuardIndex).toBeLessThan(availableBranchIndex);
});

test("12. open mantém os ramos de status disponível/reservado/vendido intactos", () => {
  const cellSxBlock = newStorePageSource.slice(
    newStorePageSource.indexOf("const getAdditionalCellSx"),
    newStorePageSource.indexOf("const isAdditionalSelected")
  );
  expect(cellSxBlock).toMatch(/status === "available"/);
  expect(cellSxBlock).toMatch(/status === "reserved"/);
  expect(cellSxBlock).toMatch(/status === "sold"/);
});

test("14. mudança de open para closed limpa seleção local residual", () => {
  const effectBlock = newStorePageSource.slice(
    newStorePageSource.indexOf('const closedDrawIds = additionalDraws'),
    newStorePageSource.indexOf("const getAdditionalNumberItem")
  );
  expect(effectBlock).toMatch(/toLowerCase\(\)\s*===\s*"closed"/);
  expect(effectBlock).toMatch(/setSelectedAdditionalNumbersByDrawId/);
  expect(effectBlock).toMatch(/next\[drawId\] = \[\]/);
});

test("15. principal não sofre alteração visual (renderNumberContent/getAdditionalCellSx não são usados na grade principal)", () => {
  const principalGridStart = newStorePageSource.indexOf("closedInitials = principalOpen !== true && initials");
  const principalBlock = newStorePageSource.slice(principalGridStart - 400, principalGridStart + 800);
  expect(principalBlock).not.toMatch(/getAdditionalCellSx\(/);
  expect(principalBlock).not.toMatch(/renderNumberContent\(/);
});

test("closedBoard sempre mostra número e não usa o overlay antigo de sold", () => {
  const renderBlock = newStorePageSource.slice(
    newStorePageSource.indexOf("const renderNumberContent"),
    newStorePageSource.indexOf("const renderPixLoadingOverlay")
  );
  const closedBoardIndex = renderBlock.indexOf("if (closedBoard)");
  const showSoldOverlayIndex = renderBlock.indexOf("const showSoldOverlay = sold");
  expect(closedBoardIndex).toBeGreaterThan(-1);
  expect(closedBoardIndex).toBeLessThan(showSoldOverlayIndex);
  expect(renderBlock).toMatch(/\{initials && \(/);
});

test("legacy secondary flag permanece intocado", () => {
  expect(newStorePageSource).toMatch(/REACT_APP_ENABLE_LEGACY_SECONDARY/);
});
