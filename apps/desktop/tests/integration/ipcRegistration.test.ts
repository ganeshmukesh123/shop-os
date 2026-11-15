import { COMMAND_NAMES } from "@shopos/core";
import { buildHandlersFixture } from "../helpers/handlersFixture";

const electronMocks = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock("electron", () => ({ ipcMain: { handle: electronMocks.handle } }));

import { CHANNEL, registerIpc } from "../../src/main/ipc";

type IpcListener = (
  event: unknown,
  commandName: unknown,
  input: unknown,
) => Promise<unknown> | unknown;

/** Registers the real handlers on a fake ipcMain and returns the one listener the app registered. */
function registerAndGetListener(): IpcListener {
  const { services } = buildHandlersFixture();
  registerIpc(services, {
    pickFolder: async () => null,
    pickBackupFile: async () => null,
    pickPdfPath: async () => null,
    scheduleRestore: () => {},
  });
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
    expect(await listener({}, "system.formatDisk", {})).toEqual({
      ok: false,
      code: "INTERNAL",
      message: "Unknown command",
    });
  });

  it("refuses a command name that is not a string", async () => {
    const listener = registerAndGetListener();
    expect(await listener({}, { toString: () => "items.list" }, {})).toMatchObject({
      ok: false,
      code: "INTERNAL",
    });
    expect(await listener({}, undefined, {})).toMatchObject({ ok: false, code: "INTERNAL" });
  });

  it("refuses names that only exist on every object, such as constructor", async () => {
    const listener = registerAndGetListener();
    expect(await listener({}, "constructor", {})).toMatchObject({ ok: false, code: "INTERNAL" });
  });

  it("runs every command of the contract through its handler", async () => {
    const listener = registerAndGetListener();
    const results = await Promise.all(
      COMMAND_NAMES.map((commandName) => listener({}, commandName, {})),
    );
    expect(results.every((result) => (result as { ok: boolean }).ok !== undefined)).toBe(true);
  });

  it("validates input from the renderer and never trusts it", async () => {
    const listener = registerAndGetListener();
    expect(await listener({}, "items.create", { name: "" })).toMatchObject({
      ok: false,
      code: "INVALID_FIELD",
    });
  });

  it("returns real data for a valid command", async () => {
    const listener = registerAndGetListener();
    const created = await listener({}, "items.create", {
      name: "Pipe",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 0,
    });
    expect(created).toMatchObject({ ok: true, data: { item: { name: "Pipe" } } });
  });
});
