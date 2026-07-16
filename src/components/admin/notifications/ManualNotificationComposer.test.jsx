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
    email: {
      enabled: true,
      audiences: ["selected", "all_with_email"],
      templates: [75, 50, 30, 15].map((remaining) => ({
        template_key: `EMAIL_DRAW_REMAINING_${remaining}`,
        name: `Restam ${remaining} números`,
        description: `Aviso por e-mail para divulgar que ainda existem ${remaining} números disponíveis.`,
        subject_template: `Restam ${remaining} números no sorteio {{draw_name}}`,
        text_template: `Olá, {{name}}! Restam ${remaining} números no sorteio {{draw_name}}. {{draw_url}}`,
        html_template: `<p>Olá, {{name}}! Restam ${remaining} números no sorteio {{draw_name}}. {{draw_url}}</p>`,
        default_params: { remaining_numbers: remaining, draw_name: "New Store", draw_url: "/" },
        source: "builtin",
        editable: false,
      })),
    },
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

const emailPreview = {
  ok: true,
  can_send: true,
  channel: "email",
  provider: "brevo_smtp",
  template: catalog.channels.email.templates[0],
  subject_preview: "Restam 75 números no sorteio New Store",
  text_preview: "Restam 75 números no sorteio New Store.",
  html_preview: "<p>Restam 75 números no sorteio New Store.</p>",
  requested_users: 127,
  eligible_users: 120,
  valid_emails: 120,
  invalid_emails: 2,
  missing_contact: 3,
  duplicate_emails_removed: 2,
  estimated_batches: 3,
  warnings: [],
  requires_bulk_confirmation: true,
};

async function reachBulkEmailPreview() {
  previewManualNotification.mockResolvedValue(emailPreview);
  render(
    <ManualNotificationComposer
      initialChannel="email"
      initialPreset={{
        channel: "email",
        templateKey: "EMAIL_DRAW_REMAINING_75",
        audience: "all_with_email",
      }}
    />
  );
  await screen.findByDisplayValue("75 números");
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(screen.getByRole("button", { name: "Gerar prévia" }));
  expect(await screen.findByText("Pronto para confirmação")).toBeInTheDocument();
}

test("all_with_email oculta o seletor, usa parâmetros fixos e envia somente após confirmação", async () => {
  previewManualNotification.mockResolvedValue(emailPreview);
  sendManualNotification.mockResolvedValue({
    ok: true,
    campaign_id: 88,
    requested_users: 127,
    valid_emails: 120,
    sent: 119,
    accepted: 119,
    failed: 1,
    skipped: 7,
    duplicate_emails_removed: 2,
    batches_processed: 3,
  });

  render(
    <ManualNotificationComposer
      initialChannel="email"
      initialPreset={{
        channel: "email",
        templateKey: "EMAIL_DRAW_REMAINING_75",
        audience: "all_with_email",
      }}
    />
  );

  expect(await screen.findByDisplayValue("75 números")).toHaveAttribute("readonly");
  expect(screen.getByRole("textbox", { name: /Assunto/ })).toHaveValue("Restam 75 números no sorteio {{draw_name}}");
  expect(screen.getByRole("textbox", { name: /Nome do sorteio/ })).toHaveValue("New Store");
  expect(screen.getByRole("textbox", { name: /Link do sorteio/ })).toHaveValue("/");
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

  expect(screen.getByRole("combobox", { name: "Audiência" })).toHaveTextContent("Todos os usuários com e-mail válido");
  expect(screen.queryByLabelText("Buscar destinatário")).not.toBeInTheDocument();
  expect(screen.getByText(/a audiência será calculada pelo backend/i)).toBeInTheDocument();
  expect(screen.queryByText(/consentimento de e-mail|autorização de e-mail|usuários autorizados/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(screen.getByRole("button", { name: "Gerar prévia" }));

  await waitFor(() => expect(previewManualNotification).toHaveBeenCalledTimes(1));
  expect(previewManualNotification).toHaveBeenCalledWith(expect.objectContaining({
    channel: "email",
    template_key: "EMAIL_DRAW_REMAINING_75",
    audience: "all_with_email",
    user_ids: [],
    params: expect.objectContaining({
      remaining_numbers: 75,
      draw_name: "New Store",
      draw_url: "/",
    }),
  }));
  expect(await screen.findByText("E-mails inválidos")).toBeInTheDocument();
  expect(screen.getByText("Duplicados removidos")).toBeInTheDocument();
  expect(screen.getByText("Quantidade de lotes")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

  const sendButton = screen.getByRole("button", { name: "Enviar e-mail para todos" });
  expect(sendButton).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: /120 endereços de e-mail válidos/i }));
  expect(sendButton).toBeEnabled();
  fireEvent.click(sendButton);
  fireEvent.click(sendButton);

  await waitFor(() => expect(sendManualNotification).toHaveBeenCalledTimes(1));
  expect(sendManualNotification).toHaveBeenCalledWith(expect.objectContaining({
    audience: "all_with_email",
    user_ids: [],
    confirm_bulk_send: true,
  }));
  expect(await screen.findByText("Campanha de e-mail criada")).toBeInTheDocument();
  expect(screen.getByText("Aceitos pelo SMTP")).toBeInTheDocument();
  expect(screen.getByText("Lotes processados")).toBeInTheDocument();
  expect(screen.queryByText(/entregue/i)).not.toBeInTheDocument();
});

test("audiência selected de e-mail mantém o seletor e não mostra consentimento", async () => {
  render(
    <ManualNotificationComposer
      initialChannel="email"
      initialPreset={{
        channel: "email",
        templateKey: "EMAIL_DRAW_REMAINING_50",
        audience: "selected",
      }}
    />
  );

  await screen.findByDisplayValue("50 números");
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

  expect(screen.getByLabelText("Buscar destinatário")).toBeInTheDocument();
  expect(screen.queryByText(/consentimento de e-mail|autorização de e-mail|usuários autorizados/i)).not.toBeInTheDocument();
});

test("alterar o assunto invalida a prévia de e-mail", async () => {
  await reachBulkEmailPreview();
  fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
  fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
  fireEvent.change(screen.getByRole("textbox", { name: /Assunto/ }), { target: { value: "Novo assunto" } });
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

  expect(screen.getByText(/gere a prévia obrigatória/i)).toBeInTheDocument();
  expect(previewManualNotification).toHaveBeenCalledTimes(1);
});

test("alterar o modelo invalida a prévia de e-mail", async () => {
  await reachBulkEmailPreview();
  fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
  fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Modelo" }));
  fireEvent.click(await screen.findByRole("option", { name: "Restam 50 números" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

  expect(screen.getByText(/gere a prévia obrigatória/i)).toBeInTheDocument();
  expect(previewManualNotification).toHaveBeenCalledTimes(1);
});
