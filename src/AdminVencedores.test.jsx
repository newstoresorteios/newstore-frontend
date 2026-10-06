import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

jest.mock(
  "react-router-dom",
  () => ({
    useNavigate: () => jest.fn(),
    Link: ({ children, to }) => <a href={to}>{children}</a>,
  }),
  { virtual: true }
);
jest.mock("./authContext", () => ({ useAuth: () => ({ logout: jest.fn() }) }));

import AdminVencedores from "./AdminVencedores";

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

const callsTo = (fragment) =>
  global.fetch.mock.calls.filter(([url]) => String(url).includes(fragment));

const patchCall = () => global.fetch.mock.calls.find(([, init]) => init?.method === "PATCH");

const principalPayload = {
  winners: [
    {
      draw_id: 10,
      winner_name: "Principal Cliente",
      winner_number: 5,
      realized_at: "2026-07-15T12:00:00Z",
      product_name: "Produto P",
      product_link: "https://p.example",
      status: "NAO RESGATADO",
      days_since: 1,
    },
  ],
};

const additionalPayload = {
  winners: [
    {
      type: "additional",
      draw_id: 150,
      winner_user_id: 7,
      winner_name: "Adicional Cliente",
      winner_number: 0,
      realized_at: "2026-07-16T12:00:00Z",
      product_name: "Produto A",
      product_link: "https://a.example",
      status: "NAO RESGATADO",
      days_since: 2,
    },
  ],
};

const winnersFetch = (patchBody = { product_name: "X" }) => async (url, init) => {
  if (init?.method === "PATCH") return jsonResponse(patchBody);
  return jsonResponse(
    String(url).includes("draw_type=adicional") ? additionalPayload : principalPayload
  );
};

beforeEach(() => {
  global.fetch = jest.fn();
});

test("principal continua usando o contrato atual /api/admin/winners", async () => {
  global.fetch.mockImplementation(winnersFetch());
  render(<AdminVencedores />);
  expect(await screen.findByText("Principal Cliente")).toBeInTheDocument();
  expect(String(global.fetch.mock.calls[0][0])).toMatch(/\/api\/admin\/winners$/);
  expect(callsTo("draw_type")).toHaveLength(0);
});

test("adicional carrega /api/admin/winners?draw_type=adicional e nao o catalogo de adicionais", async () => {
  global.fetch.mockImplementation(winnersFetch());
  render(<AdminVencedores />);
  await screen.findByText("Principal Cliente");

  fireEvent.click(screen.getByRole("button", { name: /Ganhadores Sorteios Adicionais/i }));
  expect(await screen.findByText("Adicional Cliente")).toBeInTheDocument();

  expect(callsTo("/api/admin/winners?draw_type=adicional")).toHaveLength(1);
  expect(callsTo("additional-draws")).toHaveLength(0);
  expect(screen.getByText("0")).toBeInTheDocument(); // winner_number 0 e valido
});

test("PATCH de premio adicional usa winners/:id?draw_type=adicional e envia somente produto", async () => {
  global.fetch.mockImplementation(
    winnersFetch({ draw_id: 150, product_name: "Novo", product_link: "https://novo.example" })
  );
  render(<AdminVencedores />);
  await screen.findByText("Principal Cliente");
  fireEvent.click(screen.getByRole("button", { name: /Ganhadores Sorteios Adicionais/i }));
  await screen.findByText("Adicional Cliente");

  fireEvent.change(screen.getByPlaceholderText("Nome do produto"), { target: { value: "Novo" } });
  fireEvent.click(screen.getByRole("button", { name: /Salvar/i }));

  await waitFor(() => expect(patchCall()).toBeTruthy());
  const [url, init] = patchCall();
  expect(String(url)).toMatch(/\/api\/admin\/winners\/150\?draw_type=adicional$/);
  const body = JSON.parse(init.body);
  expect(Object.keys(body).sort()).toEqual(["product_link", "product_name"]);
  expect(body.product_name).toBe("Novo");
  for (const forbidden of ["winner_number", "winner_user_id", "winner_name", "realized_at", "status"]) {
    expect(body).not.toHaveProperty(forbidden);
  }
  expect(callsTo("additional-draws")).toHaveLength(0);
});

test("PATCH do principal continua em winners/:id sem draw_type e so com produto", async () => {
  global.fetch.mockImplementation(winnersFetch());
  render(<AdminVencedores />);
  await screen.findByText("Principal Cliente");
  fireEvent.click(screen.getByRole("button", { name: /Salvar/i }));
  await waitFor(() => expect(patchCall()).toBeTruthy());
  const [url, init] = patchCall();
  expect(String(url)).toMatch(/\/api\/admin\/winners\/10$/);
  expect(Object.keys(JSON.parse(init.body)).sort()).toEqual(["product_link", "product_name"]);
});

test("erro HTTP mostra estado de erro e nao 'nenhum vencedor encontrado'", async () => {
  global.fetch.mockResolvedValue(jsonResponse({ error: "boom" }, false, 500));
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  render(<AdminVencedores />);
  expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível carregar/i);
  expect(screen.queryByText(/Nenhum vencedor encontrado/i)).not.toBeInTheDocument();
  consoleError.mockRestore();
});

test("erro ao carregar adicionais tambem mostra erro, nao lista vazia", async () => {
  global.fetch.mockImplementation(async (url) =>
    String(url).includes("draw_type=adicional")
      ? jsonResponse({ error: "boom" }, false, 500)
      : jsonResponse(principalPayload)
  );
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  render(<AdminVencedores />);
  await screen.findByText("Principal Cliente");
  fireEvent.click(screen.getByRole("button", { name: /Ganhadores Sorteios Adicionais/i }));
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  expect(screen.queryByText(/Nenhum vencedor encontrado/i)).not.toBeInTheDocument();
  consoleError.mockRestore();
});

test("lista vazia valida mostra 'nenhum vencedor encontrado' sem erro", async () => {
  global.fetch.mockResolvedValue(jsonResponse({ winners: [] }));
  render(<AdminVencedores />);
  expect(await screen.findByText(/Nenhum vencedor encontrado/i)).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
