import { getJSON, postJSON } from "../lib/api";
import {
  getNotificationCatalog,
  previewManualNotification,
  sendManualNotification,
} from "./adminNotifications";

jest.mock("../lib/api", () => ({
  apiJoin: jest.fn(),
  authHeaders: jest.fn(),
  getJSON: jest.fn(),
  patchJSON: jest.fn(),
  postJSON: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  getJSON.mockResolvedValue({ ok: true });
  postJSON.mockResolvedValue({ ok: true });
});

test("usa as rotas relativas do catálogo e do fluxo manual unificado", async () => {
  const payload = { channel: "push", audience: "selected", user_ids: [1] };
  await getNotificationCatalog();
  await previewManualNotification(payload);
  await sendManualNotification(payload);

  expect(getJSON).toHaveBeenCalledWith("/admin/notifications/catalog");
  expect(postJSON).toHaveBeenNthCalledWith(1, "/admin/notifications/manual/preview", payload);
  expect(postJSON).toHaveBeenNthCalledWith(2, "/admin/notifications/manual/send", payload);
});
