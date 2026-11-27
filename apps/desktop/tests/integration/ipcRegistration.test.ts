import { COMMAND_NAMES, type CommandName } from "@shopos/core";
import { buildHandlersFixture } from "../helpers/handlersFixture";

const electronMocks = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock("electron", () => ({ ipcMain: { handle: electronMocks.handle } }));

import { CHANNEL, registerIpc } from "../../src/main/ipc";

const APP_PAGE_URL =
  "file:///Applications/Shop%20OS.app/Contents/Resources/app/renderer/index.html";
const PICKED_FOLDER = "/test/backups";
const PICKED_BACKUP_FILE = "/test/backups/shop.sqlite";
const PICKED_PDF_PATH = "/test/bill.pdf";

const MAIN_FRAME = { url: APP_PAGE_URL };
/** An event from the app's own page, as Electron would deliver it. */
const TRUSTED_EVENT = { senderFrame: MAIN_FRAME, sender: { mainFrame: MAIN_FRAME } };

type IpcListener = (
  event: unknown,
  commandName: unknown,
  input: unknown,
) => Promise<unknown> | unknown;

/** Registers the real handlers on a fake ipcMain and returns the one listener the app registered. */
function registerAndGetListener(logRefusal: (message: string) => void = () => {}): IpcListener {
  const { services } = buildHandlersFixture();
  const shell = {
    pickFolder: async () => PICKED_FOLDER,
    pickBackupFile: async () => PICKED_BACKUP_FILE,
    pickPdfPath: async () => PICKED_PDF_PATH,
    scheduleRestore: () => {},
  };
  registerIpc(services, shell, [APP_PAGE_URL], logRefusal);
  return electronMocks.handle.mock.calls[0]?.[1] as IpcListener;
}

const invalidField = (message: string) => ({ ok: false, code: "INVALID_FIELD", message });

const INVALID_PRINT_TARGET = 'Invalid option: expected one of "receipt"|"a4"|"a5"';

const DISPATCH_CASES = {
  "items.list": {
    input: { limit: 10, offset: 0 },
    expected: { ok: true, data: { items: [], total: 0 } },
  },
  "items.create": {
    input: { name: "Pipe", unit: "pcs", pricePaise: 100, openingQtyMilli: 0 },
    expected: { ok: true, data: { item: expect.objectContaining({ name: "Pipe" }) } },
  },
  "items.update": {
    input: { id: "item-id", name: "" },
    expected: invalidField("Name is required"),
  },
  "stock.adjust": {
    input: { itemId: "item-id", mode: "invalid", quantityMilli: 1000, note: "Stock count" },
    expected: invalidField('Invalid option: expected one of "add"|"set"'),
  },
  "bills.draft.save": { input: { payload: { lines: [] } }, expected: { ok: true, data: {} } },
  "bills.draft.load": { input: {}, expected: { ok: true, data: { payload: null } } },
  "bills.save": {
    input: { clientBillId: "invalid", paymentMode: "cash", billDiscountPaise: 0, lines: [] },
    expected: invalidField("Invalid UUID"),
  },
  "bills.list": {
    input: { limit: 10, offset: 0 },
    expected: { ok: true, data: { bills: [], total: 0 } },
  },
  "bills.get": {
    input: { id: "missing-bill" },
    expected: { ok: false, code: "NOT_FOUND", message: "Bill not found" },
  },
  "bills.cancel": {
    input: { id: "missing-bill", reason: "Wrong items" },
    expected: { ok: false, code: "NOT_FOUND", message: "Bill not found" },
  },
  "bills.print": {
    input: { id: "bill-id", target: "invalid" },
    expected: invalidField(INVALID_PRINT_TARGET),
  },
  "bills.exportPdf": {
    input: { id: "bill-id", target: "invalid", filePath: "" },
    expected: invalidField(
      `${INVALID_PRINT_TARGET}; Too small: expected string to have >=1 characters`,
    ),
  },
  "settings.get": {
    input: {},
    expected: {
      ok: true,
      data: expect.objectContaining({ name: "My Shop", seriesCode: "C1", backupFolder: "" }),
    },
  },
  "settings.update": {
    input: {
      name: "",
      address: "",
      phone: "",
      seriesCode: "C1",
      numberTemplate: "{series}/{seq}",
      footer: "",
      receiptWidth: "80mm",
      backupFolder: "",
      docTitle: "Estimate",
      roundBillTotal: true,
      timeZone: "Asia/Kolkata",
    },
    expected: invalidField("Shop name is required"),
  },
  "settings.clockCheck": {
    input: { deviceTimeZone: "Asia/Kolkata" },
    expected: { ok: true, data: { warnings: [] } },
  },
  "settings.getTheme": { input: {}, expected: { ok: true, data: { theme: null } } },
  "settings.setTheme": {
    input: { theme: "dark" },
    expected: { ok: true, data: { theme: "dark" } },
  },
  "backup.run": {
    input: {},
    expected: { ok: false, code: "BACKUP_FAILED", message: "No backup folder is set" },
  },
  "backup.status": {
    input: {},
    expected: { ok: true, data: { folder: "", lastOkAt: null, lastError: null } },
  },
  "backup.planRestore": {
    input: { filePath: 0 },
    expected: invalidField("Invalid input: expected string, received number"),
  },
  "backup.restore": {
    input: { filePath: 0, confirmedPreview: { nextBillNo: "C1/26-27/000002" } },
    expected: invalidField("Invalid input: expected string, received number"),
  },
  "system.pickFolder": { input: {}, expected: { ok: true, data: { path: PICKED_FOLDER } } },
  "system.pickBackupFile": {
    input: {},
    expected: { ok: true, data: { path: PICKED_BACKUP_FILE } },
  },
  "system.pickPdfPath": {
    input: { defaultName: "bill.pdf" },
    expected: { ok: true, data: { path: PICKED_PDF_PATH } },
  },
} satisfies Record<CommandName, { input: unknown; expected: object }>;

beforeEach(() => {
  electronMocks.handle.mockReset();
});

describe("registerIpc", () => {
  it("registers exactly one entry point, on the shopos:invoke channel", () => {
    registerAndGetListener();
    expect(electronMocks.handle).toHaveBeenCalledOnce();
    expect(electronMocks.handle.mock.calls[0]?.[0]).toBe(CHANNEL);
    expect(CHANNEL).toBe("shopos:invoke");
  });

  it("answers a command outside the contract with INTERNAL and runs nothing", async () => {
    const listener = registerAndGetListener();
    expect(await listener(TRUSTED_EVENT, "system.formatDisk", {})).toEqual({
      ok: false,
      code: "INTERNAL",
      message: "Unknown command",
    });
  });

  it("refuses a command name that is not a string", async () => {
    const listener = registerAndGetListener();
    expect(await listener(TRUSTED_EVENT, { toString: () => "items.list" }, {})).toMatchObject({
      ok: false,
      code: "INTERNAL",
    });
    expect(await listener(TRUSTED_EVENT, undefined, {})).toMatchObject({
      ok: false,
      code: "INTERNAL",
    });
  });

  it("refuses names that only exist on every object, such as constructor", async () => {
    const listener = registerAndGetListener();
    expect(await listener(TRUSTED_EVENT, "constructor", {})).toMatchObject({
      ok: false,
      code: "INTERNAL",
    });
  });

  it.each(COMMAND_NAMES)("dispatches %s to its handler", async (commandName) => {
    const { input, expected } = DISPATCH_CASES[commandName];
    const listener = registerAndGetListener();
    const result = await listener(TRUSTED_EVENT, commandName, input);

    expect(result).toEqual(expect.objectContaining(expected));
  });

  it("validates input from the renderer and never trusts it", async () => {
    const listener = registerAndGetListener();
    expect(await listener(TRUSTED_EVENT, "items.create", { name: "" })).toMatchObject({
      ok: false,
      code: "INVALID_FIELD",
    });
  });

  describe("sender check", () => {
    const FOREIGN_FRAME = { url: "https://evil.example/index.html" };
    const REFUSED = { ok: false, code: "INTERNAL", message: "Command refused" };

    it.each([
      ["a foreign page", { senderFrame: FOREIGN_FRAME, sender: { mainFrame: FOREIGN_FRAME } }],
      ["a missing frame", { senderFrame: null, sender: { mainFrame: MAIN_FRAME } }],
      [
        "a child frame of the app page",
        { senderFrame: { url: APP_PAGE_URL }, sender: { mainFrame: MAIN_FRAME } },
      ],
      ["an event with no sender at all", {}],
    ])("refuses a command from %s and saves nothing", async (_caseName, event) => {
      const listener = registerAndGetListener();
      const itemCreateInput = {
        name: "Pipe",
        unit: "pcs",
        pricePaise: 12000,
        openingQtyMilli: 2000,
      };
      expect(await listener(event, "items.create", itemCreateInput)).toEqual(REFUSED);
      const listed = await listener(TRUSTED_EVENT, "items.list", { limit: 10, offset: 0 });
      expect(listed).toMatchObject({ ok: true, data: { items: [] } });
    });

    // The sender is checked first, so a foreign page learns nothing about names or input rules.
    it.each([
      ["a command outside the contract", "no.such.command", {}],
      ["a command with invalid input", "backup.restore", { filePath: 0 }],
    ])("refuses %s from a foreign page before checking it", async (_caseName, name, input) => {
      const listener = registerAndGetListener();
      const foreignEvent = { senderFrame: FOREIGN_FRAME, sender: { mainFrame: FOREIGN_FRAME } };

      expect(await listener(foreignEvent, name, input)).toEqual(REFUSED);
    });

    it("logs the refusal with the page address and no command input", async () => {
      const logRefusal = vi.fn();
      const listener = registerAndGetListener(logRefusal);
      const customerInput = { customerName: "Ramesh Traders" };
      // Made-up credentials and customer data the log must never show; not a real secret.
      const privateFrame = {
        url: "https://user:password@evil.example/Ramesh?token=secret#private", // trufflehog:ignore
      };
      await listener(
        { senderFrame: privateFrame, sender: { mainFrame: privateFrame } },
        "bills.save",
        customerInput,
      );
      expect(logRefusal).toHaveBeenCalledOnce();
      const loggedText = JSON.stringify(logRefusal.mock.calls);
      expect(loggedText).toContain("evil.example");
      expect(logRefusal).toHaveBeenCalledWith(
        "Refused a command from an untrusted sender: https://evil.example",
      );
      expect(loggedText).not.toContain("Ramesh");
    });
  });
});
