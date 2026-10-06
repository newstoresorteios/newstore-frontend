import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => jest.fn(),
    useParams: () => ({ id: "133" }),
  }),
  { virtual: true }
);

const mockApiJoin = { current: null };
jest.mock("./lib/api", () => ({
  apiJoin: (path) =>
    (mockApiJoin.current || jest.requireActual("./lib/api").apiJoin)(path),
}));

import DrawBoardPage from "./DrawBoardPage";

const makeBoard = (total, width, winner = null) =>
  Array.from({ length: total }, (_, n) => ({
    n,
    label: String(n).padStart(width, "0"),
    state: "available",
    isMine: false,
    isWinner: winner !== null && Number(winner) === n,
  }));

function mockBoard({ winnerNumber = null, board, myNumbers = [] }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      draw: {
        id: 133,
        status: "sorteado",
        winner_number: winnerNumber,
        winner_name: "Cliente Vencedor",
        product_name: null,
        product_link: null,
      },
      my_numbers: myNumbers,
      board,
    }),
  });
}

function renderWinner(winnerNumber) {
  mockBoard({
    winnerNumber,
    myNumbers: [winnerNumber],
    board: [
      {
        n: winnerNumber,
        label: String(winnerNumber).padStart(2, "0"),
        state: "taken",
        isMine: true,
        isWinner: true,
      },
    ],
  });
  render(<DrawBoardPage />);
}

test("exibe o número vencedor 00", async () => {
  renderWinner(0);
  expect(await screen.findByText(/vencedor:\s*00/i)).toBeInTheDocument();
});

test("continua exibindo um número vencedor comum", async () => {
  renderWinner(7);
  expect(await screen.findByText(/vencedor:\s*07/i)).toBeInTheDocument();
});

test('exibe o vencedor serializado como string "0" como 00', async () => {
  mockBoard({ winnerNumber: "0", board: makeBoard(100, 2, "0") });
  render(<DrawBoardPage />);
  expect(await screen.findByText(/vencedor:\s*00/i)).toBeInTheDocument();
});

test("nao exibe chip de vencedor quando winner_number e null", async () => {
  mockBoard({ winnerNumber: null, board: makeBoard(100, 2) });
  render(<DrawBoardPage />);
  expect(await screen.findAllByRole("gridcell")).toHaveLength(100);
  expect(screen.queryByText(/Número vencedor/i)).not.toBeInTheDocument();
});

test("renderiza board com mais de 100 itens sem truncar nem aplicar modulo", async () => {
  mockBoard({ winnerNumber: 0, board: makeBoard(500, 3, 0), myNumbers: [499] });
  const { container } = render(<DrawBoardPage />);
  expect(await screen.findByText(/vencedor:\s*000/i)).toBeInTheDocument();
  const cells = container.querySelectorAll('[role="gridcell"]');
  expect(cells).toHaveLength(500);
  expect(cells[0]).toHaveTextContent("000");
  expect(cells[499]).toHaveTextContent("499");
}, 30000);

test("renderiza grade de 1000 itens", async () => {
  mockBoard({ winnerNumber: 999, board: makeBoard(1000, 3, 999) });
  const { container } = render(<DrawBoardPage />);
  expect(await screen.findByText(/vencedor:\s*999/i)).toBeInTheDocument();
  // querySelectorAll: queries por role ficam lentas no jsdom com 1000 celulas MUI
  expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(1000);
}, 30000);

// lib/api le a variavel de ambiente ao carregar: carregamos a implementacao real isolada
// por base e a pagina chama exatamente esse apiJoin.
function realApiJoinForBase(base) {
  const saved = {
    base: process.env.REACT_APP_API_BASE,
    baseUrl: process.env.REACT_APP_API_BASE_URL,
  };
  if (base === undefined) delete process.env.REACT_APP_API_BASE;
  else process.env.REACT_APP_API_BASE = base;
  delete process.env.REACT_APP_API_BASE_URL;
  let join;
  try {
    jest.isolateModules(() => {
      join = jest.requireActual("./lib/api").apiJoin;
    });
  } finally {
    for (const [key, value] of [
      ["REACT_APP_API_BASE", saved.base],
      ["REACT_APP_API_BASE_URL", saved.baseUrl],
    ]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  return join;
}

describe("URL do board", () => {
  afterEach(() => {
    mockApiJoin.current = null;
  });

  test.each([
    ["sem base definida", undefined, "/api/me/draws/133/board"],
    ["base sem /api", "https://api.example.com", "https://api.example.com/api/me/draws/133/board"],
    ["base terminada em /api", "https://api.example.com/api", "https://api.example.com/api/me/draws/133/board"],
    ["base com barra final", "https://api.example.com/api/", "https://api.example.com/api/me/draws/133/board"],
  ])("%s nunca gera /api/api", async (_name, base, expected) => {
    mockApiJoin.current = realApiJoinForBase(base);
    mockBoard({ board: makeBoard(100, 2) });
    render(<DrawBoardPage />);
    await screen.findAllByRole("gridcell");
    const url = String(global.fetch.mock.calls[0][0]);
    expect(url).not.toMatch(/\/api\/api/);
    expect(url).toBe(expected);
  });
});
