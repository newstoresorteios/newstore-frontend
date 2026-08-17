import * as React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import NotificationCatalog from "./NotificationCatalog";
import {
  getNotificationCatalog,
  listPushRules,
} from "../../../services/adminNotifications";

jest.mock("../../../services/adminNotifications", () => ({
  createPushRule: jest.fn(),
  getNotificationCatalog: jest.fn(),
  listPushRules: jest.fn(),
  seedDefaultPushRules: jest.fn(),
  syncBrevoWhatsAppTemplates: jest.fn(),
  updateNotificationTemplate: jest.fn(),
  updatePushRule: jest.fn(),
}));

const remainingTemplates = [75, 50, 30, 15].map((remaining) => ({
  template_key: `EMAIL_DRAW_REMAINING_${remaining}`,
  name: `Restam ${remaining} números`,
  description: `Aviso por e-mail para divulgar que ainda existem ${remaining} números disponíveis.`,
  subject_template: `Restam ${remaining} números no sorteio {{draw_name}}`,
  text_template: `Restam ${remaining} números`,
  html_template: `<p>Restam ${remaining} números</p>`,
  source: "builtin",
  editable: false,
  manual_send_allowed: true,
}));

const catalog = {
  channels: {
    whatsapp: { templates: [] },
    push: { templates: [] },
    email: {
      audiences: ["selected", "all_with_email"],
      templates: [
        { template_key: "GENERIC_ADMIN_EMAIL", name: "E-mail administrativo", source: "builtin" },
        ...remainingTemplates,
      ],
    },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
  getNotificationCatalog.mockResolvedValue(catalog);
  listPushRules.mockResolvedValue([]);
});

test("exibe os quatro modelos vindos do catálogo e ações somente neles", async () => {
  const onUseTemplate = jest.fn();
  const onSendAll = jest.fn();
  render(
    <NotificationCatalog
      initialChannel="email"
      onUseTemplate={onUseTemplate}
      onSendAll={onSendAll}
    />
  );

  for (const remaining of [75, 50, 30, 15]) {
    expect(await screen.findByText(`Restam ${remaining} números`, { selector: "h6" })).toBeInTheDocument();
  }
  expect(screen.getByText("E-mail administrativo")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Usar modelo" })).toHaveLength(4);
  expect(screen.getAllByRole("button", { name: "Enviar para todos" })).toHaveLength(4);
  expect(screen.getAllByText("E-mail SMTP")).toHaveLength(5);
  expect(screen.getAllByText("Origem: Modelo padrão")).toHaveLength(5);

  const card = screen.getByText("Restam 75 números", { selector: "h6" }).closest(".MuiPaper-root");
  fireEvent.click(within(card).getByRole("button", { name: "Enviar para todos" }));
  expect(onSendAll).toHaveBeenCalledWith(expect.objectContaining({
    template_key: "EMAIL_DRAW_REMAINING_75",
  }));
  expect(onUseTemplate).not.toHaveBeenCalled();
});

test("mostra estado vazio específico sem criar fallback local", async () => {
  getNotificationCatalog.mockResolvedValue({
    ...catalog,
    channels: {
      ...catalog.channels,
      email: { audiences: ["selected", "all_with_email"], templates: [] },
    },
  });

  render(<NotificationCatalog initialChannel="email" />);

  await waitFor(() => expect(getNotificationCatalog).toHaveBeenCalled());
  expect(
    await screen.findByText("Nenhum modelo de aviso de números restantes foi encontrado.")
  ).toBeInTheDocument();
  expect(screen.queryByText("Restam 75 números")).not.toBeInTheDocument();
});
