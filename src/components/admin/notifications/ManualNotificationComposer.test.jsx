import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ManualNotificationComposer from "./ManualNotificationComposer";
import {
  getNotificationCatalog,
  getNotificationHealth,
  previewManualNotification,
  searchNotificationRecipients,
  sendManualNotification,
} from "../../../services/adminNotifications";

jest.mock("../../../services/adminNotifications", () => ({
  getNotificationCatalog: jest.fn(),
  getNotificationHealth: jest.fn(),
  previewManualNotification: jest.fn(),
  searchNotificationRecipients: jest.fn(),
  sendManualNotification: jest.fn(),
}));

jest.setTimeout(15000);

const catalog = {
  ok: true,
  channels: {
    whatsapp: { enabled: true, templates: [] },
    push: {
      enabled: true,
      templates: [{
        id: 7,
        event_key: "PUSH_TEST",
        name: "Aviso Push",
        title_template: "Título teste",
        body_template: "Mensagem teste",
        url_template: "/",
        is_active: true,
      }],
    },
    email: { enabled: true, templates: [] },
  },
};

const health = {
  manual_channels: {
    whatsapp: { enabled: true, brevo_configured: true },
    push: { enabled: true, vapid_configured: true },
    email: { enabled: true, smtp_configured: true },
  },
};

const preview = {
  ok: true,
  can_send: true,
  channel: "push",
  provider: "web_push",
  template: catalog.channels.push.templates[0],
  title_preview: "Título teste",
  message_preview: "Mensagem teste",
  requested_users: 1,
  eligible_users: 1,
  eligible_devices: 1,
  valid_emails: 0,
  valid_phones: 0,
  blocked_by_consent: 0,
  missing_contact: 0,
  inactive_subscriptions: 0,
  warnings: [],
  requires_bulk_confirmation: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  getNotificationCatalog.mockResolvedValue(catalog);
  getNotificationHealth.mockResolvedValue(health);
  searchNotificationRecipients.mockResolvedValue([{ id: 1, name: "Cliente Teste", email: "cliente@example.com", has_active_push: true }]);
  previewManualNotification.mockResolvedValue(preview);
});

async function reachPushModel() {
  render(<ManualNotificationComposer />);
  const pushText = await screen.findByText("Push", { selector: "h6" });
  fireEvent.click(pushText.closest("button"));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Modelo" }));
  fireEvent.click(await screen.findByRole("option", { name: "Aviso Push" }));
}

test("gera somente a prévia de Push para um usuário e não envia", async () => {
  await reachPushModel();
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

  const search = screen.getByLabelText("Buscar destinatário");
  userEvent.type(search, "Cliente");
  fireEvent.click(await screen.findByText("Cliente Teste", { selector: "p" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(screen.getByRole("button", { name: "Gerar prévia" }));

  await waitFor(() => expect(previewManualNotification).toHaveBeenCalledTimes(1));
  expect(previewManualNotification).toHaveBeenCalledWith(expect.objectContaining({
    channel: "push",
    audience: "selected",
    user_ids: [1],
    template_key: "PUSH_TEST",
  }));
  expect(sendManualNotification).not.toHaveBeenCalled();
  expect(await screen.findByText("Pronto para confirmação")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  expect(screen.getByText(/único usuário e não exige confirmação de lote/i)).toBeInTheDocument();
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Enviar Push" })).toBeEnabled();
  expect(sendManualNotification).not.toHaveBeenCalled();
});

test("can_send falso mantém a confirmação bloqueada", async () => {
  previewManualNotification.mockResolvedValue({ ...preview, can_send: false, warnings: ["no_active_push_recipients"] });
  await reachPushModel();
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Audiência" }));
  fireEvent.click(await screen.findByRole("option", { name: "Todos com Push ativo" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(screen.getByRole("button", { name: "Gerar prévia" }));

  expect(await screen.findByText("Envio bloqueado")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  expect(sendManualNotification).not.toHaveBeenCalled();
});

test("all_active_push exige checkbox e evita envio duplicado", async () => {
  previewManualNotification.mockResolvedValue({ ...preview, eligible_users: 3, eligible_devices: 5, requires_bulk_confirmation: true });
  sendManualNotification.mockResolvedValue({ ok: true, campaign_id: 99, requested_users: null, eligible_users: 3, eligible_devices: 5, sent: 5, failed: 0, skipped: 0 });
  await reachPushModel();
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Audiência" }));
  fireEvent.click(await screen.findByRole("option", { name: "Todos com Push ativo" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(screen.getByRole("button", { name: "Gerar prévia" }));
  expect(await screen.findByText("Pronto para confirmação")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

  const sendButton = screen.getByRole("button", { name: "Enviar Push" });
  expect(sendButton).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /3 usuários e 5 dispositivos/i }));
  expect(sendButton).toBeEnabled();
  fireEvent.click(sendButton);
  fireEvent.click(sendButton);

  await waitFor(() => expect(sendManualNotification).toHaveBeenCalledTimes(1));
  expect(sendManualNotification).toHaveBeenCalledWith(expect.objectContaining({
    audience: "all_active_push",
    confirm_bulk_send: true,
  }));
  expect(sendManualNotification.mock.calls[0][0]).not.toHaveProperty("user_ids");
});
