import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import PushPermissionPrompt from "./PushPermissionPrompt";
import {
  getNotificationPermission,
  getPushAccess,
  isPushSupported,
  subscribeToPush,
} from "../services/pushNotifications";

jest.mock("../authContext", () => ({
  useAuth: () => ({ loading: false }),
}));

jest.mock("../services/pushNotifications", () => ({
  getNotificationPermission: jest.fn(),
  getPushAccess: jest.fn(),
  isPushSupported: jest.fn(),
  subscribeToPush: jest.fn(),
}));

const PROMPT_TITLE = "Receba avisos dos novos sorteios";
const BLOCKED_MESSAGE =
  "As notificações estão bloqueadas neste navegador. Ative-as nas configurações do site.";

let permission;
let requestPermission;

beforeEach(() => {
  localStorage.clear();
  permission = "default";
  requestPermission = jest.fn(() => Promise.resolve(permission));
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: {
      get permission() {
        return permission;
      },
      requestPermission,
    },
  });
  getNotificationPermission.mockImplementation(() => permission);
  getPushAccess.mockResolvedValue({ can_subscribe: true });
  isPushSupported.mockReturnValue(true);
  subscribeToPush.mockResolvedValue({ ok: true });
});

afterEach(() => {
  jest.clearAllMocks();
});

test("não exibe o popup nem solicita permissão quando o navegador já está autorizado", async () => {
  permission = "granted";

  render(<PushPermissionPrompt />);

  await waitFor(() => expect(getNotificationPermission).toHaveBeenCalled());
  expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument();
  expect(screen.queryByText(/unauthorized/i)).not.toBeInTheDocument();
  expect(requestPermission).not.toHaveBeenCalled();
  expect(getPushAccess).not.toHaveBeenCalled();
  expect(subscribeToPush).not.toHaveBeenCalled();
});

test("exibe normalmente o popup quando a permissão ainda está em default", async () => {
  render(<PushPermissionPrompt />);

  expect(await screen.findByText(PROMPT_TITLE)).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Permitir notificações" })
  ).toBeInTheDocument();
});

test("fecha o popup imediatamente após a permissão ser concedida", async () => {
  subscribeToPush.mockReturnValue(new Promise(() => {}));
  requestPermission.mockImplementation(async () => {
    permission = "granted";
    return "granted";
  });

  render(<PushPermissionPrompt />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Permitir notificações" })
  );

  await waitFor(() =>
    expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument()
  );
  expect(requestPermission).toHaveBeenCalledTimes(1);
  expect(subscribeToPush).toHaveBeenCalledTimes(1);
});

test("orienta o usuário quando a permissão está bloqueada sem pedir novamente", async () => {
  permission = "denied";

  render(<PushPermissionPrompt />);

  expect(await screen.findByText(BLOCKED_MESSAGE)).toBeInTheDocument();
  expect(screen.queryByText(/unauthorized/i)).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Permitir notificações" })
  ).not.toBeInTheDocument();
  expect(requestPermission).not.toHaveBeenCalled();
  expect(getPushAccess).not.toHaveBeenCalled();
});

test("ignora falha auxiliar de autenticação quando a permissão já foi concedida", async () => {
  permission = "granted";
  getPushAccess.mockRejectedValue(new Error("401 unauthorized"));

  render(<PushPermissionPrompt />);

  await waitFor(() => expect(getNotificationPermission).toHaveBeenCalled());
  expect(screen.queryByText(PROMPT_TITLE)).not.toBeInTheDocument();
  expect(screen.queryByText(/unauthorized|authentication_required|401/i)).not.toBeInTheDocument();
  expect(getPushAccess).not.toHaveBeenCalled();
  expect(subscribeToPush).not.toHaveBeenCalled();
});
