import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import AdminNotificationsPage from "./AdminNotificationsPage";

jest.mock("react-router-dom", () => ({ useNavigate: () => jest.fn() }), { virtual: true });
jest.mock("./components/admin/notifications/NotificationsOverview", () => () => <div>Conteúdo da visão geral</div>);
jest.mock("./components/admin/notifications/ManualNotificationComposer", () => () => <div>Conteúdo do envio manual</div>);
jest.mock("./components/admin/notifications/NotificationCatalog", () => () => <div>Conteúdo dos modelos</div>);
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
