import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import AdminNotificationsPage from "./AdminNotificationsPage";

jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock("./components/admin/notifications/NotificationsOverview", () => () => <div>Conteúdo da visão geral</div>);
jest.mock("./components/admin/notifications/ManualNotificationComposer", () => ({ initialPreset }) => (
  <div>
    Conteúdo do envio manual
    {initialPreset && <span data-testid="composer-preset">{JSON.stringify(initialPreset)}</span>}
  </div>
));
jest.mock("./components/admin/notifications/NotificationCatalog", () => ({ onSendAll }) => (
  <div>
    Conteúdo dos modelos
    <button type="button" onClick={() => onSendAll({ template_key: "EMAIL_DRAW_REMAINING_75" })}>Enviar para todos</button>
  </div>
));
jest.mock("./components/admin/notifications/NotificationAutomations", () => () => <div>Conteúdo das automações</div>);
jest.mock("./components/admin/notifications/NotificationHistory", () => () => <div>Conteúdo do histórico</div>);

test("troca as cinco abas internamente sem navegação de rota", () => {
  render(<AdminNotificationsPage />);
  expect(screen.getByText("Conteúdo da visão geral")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Enviar mensagem" }));
  expect(screen.getByText("Conteúdo do envio manual")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Modelos" }));
  expect(screen.getByText("Conteúdo dos modelos")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Automações" }));
  expect(screen.getByText("Conteúdo das automações")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Histórico" }));
  expect(screen.getByText("Conteúdo do histórico")).toBeInTheDocument();
});

test("atalho de modelo abre o compositor com e-mail e all_with_email sem enviar", () => {
  render(<AdminNotificationsPage />);
  fireEvent.click(screen.getByRole("tab", { name: "Modelos" }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar para todos" }));

  expect(screen.getByText("Conteúdo do envio manual")).toBeInTheDocument();
  expect(screen.getByTestId("composer-preset")).toHaveTextContent("EMAIL_DRAW_REMAINING_75");
  expect(screen.getByTestId("composer-preset")).toHaveTextContent("all_with_email");
  expect(screen.getByTestId("composer-preset")).toHaveTextContent("email");
});
