import { COMMAND_NAMES } from "@shopos/core";
import { buildHandlersFixture } from "../helpers/handlersFixture";

const electronMocks = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock("electron", () => ({ ipcMain: { handle: electronMocks.handle } }));

import { CHANNEL, registerIpc } from "../../src/main/ipc";

const APP_PAGE_URL =
  "file:///Applications/Shop%20OS.app/Contents/Resources/app/renderer/index.html";
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
    pickFolder: async () => null,
    pickBackupFile: async () => null,
    pickPdfPath: async () => null,
    scheduleRestore: () => {},
  };
  registerIpc(services, shell, [APP_PAGE_URL], logRefusal);
  return electronMocks.handle.mock.calls[0]?.[1] as IpcListener;
}

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

  it("runs every command of the contract through its handler", async () => {
    const listener = registerAndGetListener();
    const results = await Promise.all(
      COMMAND_NAMES.map((commandName) => listener(TRUSTED_EVENT, commandName, {})),
    );
    expect(results.every((result) => (result as { ok: boolean }).ok !== undefined)).toBe(true);
  });

  it("validates input from the renderer and never trusts it", async () => {
    const listener = registerAndGetListener();
    expect(await listener(TRUSTED_EVENT, "items.create", { name: "" })).toMatchObject({
      ok: false,
      code: "INVALID_FIELD",
    });
  });

  it("returns real data for a valid command", async () => {
    const listener = registerAndGetListener();
    const created = await listener(TRUSTED_EVENT, "items.create", {
      name: "Pipe",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 0,
    });
    expect(created).toMatchObject({ ok: true, data: { item: { name: "Pipe" } } });
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

    it("logs the refusal with the page address and no command input", async () => {
      const logRefusal = vi.fn();
      const listener = registerAndGetListener(logRefusal);
      const customerInput = { customerName: "Ramesh Traders" };
      await listener(
        { senderFrame: FOREIGN_FRAME, sender: { mainFrame: FOREIGN_FRAME } },
        "bills.save",
        customerInput,
      );
      expect(logRefusal).toHaveBeenCalledOnce();
      const loggedText = JSON.stringify(logRefusal.mock.calls);
      expect(loggedText).toContain("evil.example");
      expect(loggedText).not.toContain("Ramesh");
    });
  });
});
