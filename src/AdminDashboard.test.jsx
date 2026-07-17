import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AdminDashboard from "./AdminDashboard";

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  Link: "a",
}), { virtual: true });

jest.mock("./authContext", () => ({
  useAuth: () => ({ logout: jest.fn() }),
}));

const jsonResponse = (body, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  });

const setupFetch = ({
  drawId = 135,
  patchResponse,
  patchError,
  patchPromise,
} = {}) => {
  let storedConfig = {
    ticket_price_cents: 5500,
    banner_title: "Promoção atual",
    max_numbers_per_selection: 5,
  };

  global.fetch = jest.fn((url, options = {}) => {
    const requestUrl = String(url);
    const method = options.method || "GET";

    if (method === "PATCH" && requestUrl.endsWith(`/admin/dashboard/draws/${drawId}/config`)) {
      if (patchPromise) return patchPromise;
      if (patchError) return jsonResponse(patchError.body, patchError.status);

      const requestedConfig = JSON.parse(options.body);
      storedConfig = patchResponse?.config || requestedConfig;
      return jsonResponse(
        patchResponse || {
          ok: true,
          draw: { id: drawId, status: "open", draw_type: "principal" },
          config: storedConfig,
          sync: { global: true, draw: true },
        }
      );
    }

    if (method === "GET" && requestUrl.endsWith("/admin/dashboard/summary")) {
      return jsonResponse({
        draw_id: drawId,
        status: "open",
        draw_type: "principal",
        sold: 2,
        remaining: 98,
        price_cents: storedConfig.ticket_price_cents,
      });
    }

    if (method === "GET" && requestUrl.endsWith("/config")) {
      return jsonResponse(storedConfig);
    }

    throw new Error(`Request inesperado: ${method} ${requestUrl}`);
  });
};

const renderDashboard = async () => {
  render(<AdminDashboard />);

  await waitFor(() => {
    expect(screen.getByPlaceholderText("em centavos (ex.: 100 = R$ 1,00)")).toHaveValue("5500");
    expect(screen.getByPlaceholderText("Ex.: 5")).toHaveValue(5);
    expect(screen.getByPlaceholderText(/Sorteio de um Watch Winder/)).toHaveValue("Promoção atual");
  });
};

const patchCalls = () =>
  global.fetch.mock.calls.filter(([, options = {}]) => options.method === "PATCH");

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  window.alert = jest.fn();
  setupFetch();
});

afterEach(() => {
  console.error.mockRestore();
  delete global.fetch;
});

test("atualiza o principal com um único PATCH atômico e recarrega o resumo", async () => {
  setupFetch({
    patchResponse: {
      ok: true,
      draw: { id: 135, status: "open", draw_type: "principal" },
      config: {
        ticket_price_cents: 5600,
        banner_title: "Valor persistido",
        max_numbers_per_selection: 8,
      },
      sync: { global: true, draw: true },
    },
  });
  await renderDashboard();

  fireEvent.change(screen.getByPlaceholderText("em centavos (ex.: 100 = R$ 1,00)"), {
    target: { value: "5500" },
  });
  fireEvent.change(screen.getByPlaceholderText("Ex.: 5"), { target: { value: "7" } });
  fireEvent.change(screen.getByPlaceholderText(/Sorteio de um Watch Winder/), {
    target: { value: "  Nova promoção  " },
  });
  fireEvent.click(screen.getByRole("button", { name: "ATUALIZAR" }));

  await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Configurações atualizadas."));

  expect(patchCalls()).toHaveLength(1);
  const [url, options] = patchCalls()[0];
  expect(url).toMatch(/\/admin\/dashboard\/draws\/135\/config$/);
  expect(options.method).toBe("PATCH");
  expect(JSON.parse(options.body)).toEqual({
    ticket_price_cents: 5500,
    banner_title: "Nova promoção",
    max_numbers_per_selection: 7,
  });

  expect(
    global.fetch.mock.calls.some(
      ([requestUrl, requestOptions = {}]) =>
        requestOptions.method === "POST" &&
        String(requestUrl).endsWith("/admin/dashboard/ticket-price")
    )
  ).toBe(false);
  expect(
    global.fetch.mock.calls.some(
      ([requestUrl, requestOptions = {}]) =>
        requestOptions.method === "POST" && String(requestUrl).endsWith("/config")
    )
  ).toBe(false);
  expect(
    global.fetch.mock.calls.some(([requestUrl]) =>
      /\/admin\/(dashboard\/new|additional-draws)/.test(String(requestUrl))
    )
  ).toBe(false);
  expect(
    global.fetch.mock.calls.filter(([requestUrl]) =>
      String(requestUrl).endsWith("/admin/dashboard/summary")
    )
  ).toHaveLength(2);
  expect(screen.getByPlaceholderText("em centavos (ex.: 100 = R$ 1,00)")).toHaveValue("5600");
  expect(screen.getByPlaceholderText("Ex.: 5")).toHaveValue(8);
  expect(screen.getByPlaceholderText(/Sorteio de um Watch Winder/)).toHaveValue("Valor persistido");
});

test("bloqueia o submit quando não existe draw_id principal", async () => {
  setupFetch({ drawId: null });
  await renderDashboard();

  fireEvent.click(screen.getByRole("button", { name: "ATUALIZAR" }));

  expect(patchCalls()).toHaveLength(0);
  expect(window.alert).toHaveBeenCalledWith(
    "Não foi possível identificar o sorteio principal atual."
  );
});

test.each([
  ["preço inválido", "em centavos (ex.: 100 = R$ 1,00)", "0"],
  ["limite decimal", "Ex.: 5", "1.5"],
  ["limite vazio", "Ex.: 5", ""],
])("%s impede o request e preserva o formulário", async (_, placeholder, value) => {
  await renderDashboard();
  const input = screen.getByPlaceholderText(placeholder);
  fireEvent.change(input, { target: { value } });

  fireEvent.click(screen.getByRole("button", { name: "ATUALIZAR" }));

  expect(patchCalls()).toHaveLength(0);
  const expectedValue = placeholder === "Ex.: 5" ? (value === "" ? null : Number(value)) : value;
  expect(input).toHaveValue(expectedValue);
});

test("frase acima de 255 caracteres impede o request", async () => {
  await renderDashboard();
  const banner = screen.getByPlaceholderText(/Sorteio de um Watch Winder/);
  fireEvent.change(banner, { target: { value: "x".repeat(256) } });

  fireEvent.click(screen.getByRole("button", { name: "ATUALIZAR" }));

  expect(patchCalls()).toHaveLength(0);
  expect(banner).toHaveValue("x".repeat(256));
  expect(window.alert).toHaveBeenCalledWith(
    "A frase promocional deve ter no máximo 255 caracteres."
  );
});

test("duplo clique durante o salvamento produz somente um request", async () => {
  let resolvePatch;
  const deferredPatch = new Promise((resolve) => {
    resolvePatch = resolve;
  });
  setupFetch({ patchPromise: deferredPatch });
  await renderDashboard();

  const updateButton = screen.getByRole("button", { name: "ATUALIZAR" });
  fireEvent.click(updateButton);
  fireEvent.click(updateButton);

  expect(patchCalls()).toHaveLength(1);

  resolvePatch({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({
      ok: true,
      draw: { id: 135, status: "open", draw_type: "principal" },
      config: {
        ticket_price_cents: 5500,
        banner_title: "Promoção atual",
        max_numbers_per_selection: 5,
      },
      sync: { global: true, draw: true },
    }),
  });

  await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Configurações atualizadas."));
});

test("preço bloqueado mostra a orientação e mantém os campos", async () => {
  setupFetch({
    patchError: { status: 409, body: { error: "draw_ticket_price_locked" } },
  });
  await renderDashboard();
  const price = screen.getByPlaceholderText("em centavos (ex.: 100 = R$ 1,00)");
  const limit = screen.getByPlaceholderText("Ex.: 5");
  const banner = screen.getByPlaceholderText(/Sorteio de um Watch Winder/);
  fireEvent.change(price, { target: { value: "6000" } });
  fireEvent.change(limit, { target: { value: "6" } });
  fireEvent.change(banner, { target: { value: "Promo mantida" } });

  fireEvent.click(screen.getByRole("button", { name: "ATUALIZAR" }));

  await waitFor(() =>
    expect(window.alert).toHaveBeenCalledWith(
      "O valor da cota não pode ser alterado após o início das vendas. A frase promocional e o limite podem ser atualizados mantendo o preço atual."
    )
  );
  expect(price).toHaveValue("6000");
  expect(limit).toHaveValue(6);
  expect(banner).toHaveValue("Promo mantida");
});

test.each([
  [
    "draw_config_sync_failed",
    "Não foi possível sincronizar a configuração do sorteio. Nenhuma alteração foi salva.",
  ],
  ["principal_draw_required", "O sorteio selecionado não é o principal."],
  ["draw_not_found", "O sorteio principal não foi encontrado."],
])("erro %s não mostra sucesso", async (error, expectedMessage) => {
  setupFetch({ patchError: { status: error === "draw_not_found" ? 404 : 500, body: { error } } });
  await renderDashboard();

  fireEvent.click(screen.getByRole("button", { name: "ATUALIZAR" }));

  await waitFor(() => expect(window.alert).toHaveBeenCalledWith(expectedMessage));
  expect(window.alert).not.toHaveBeenCalledWith("Configurações atualizadas.");
});

test("resposta sem confirmação das duas fontes é tratada como falha", async () => {
  setupFetch({
    patchResponse: {
      ok: true,
      config: {
        ticket_price_cents: 5500,
        banner_title: "Promoção atual",
        max_numbers_per_selection: 5,
      },
      sync: { global: true, draw: false },
    },
  });
  await renderDashboard();

  fireEvent.click(screen.getByRole("button", { name: "ATUALIZAR" }));

  await waitFor(() =>
    expect(window.alert).toHaveBeenCalledWith(
      "Não foi possível atualizar o sorteio. Nenhuma alteração foi salva."
    )
  );
  expect(window.alert).not.toHaveBeenCalledWith("Configurações atualizadas.");
});
