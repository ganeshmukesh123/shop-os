import { COMMAND_NAMES } from "@shopos/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IPC_CHANNEL, buildShopOsApi } from "../../src/preload/bridge";

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("electron");
});

describe("buildShopOsApi", () => {
  it("exposes exactly the commands of the contract and nothing else", () => {
    const api = buildShopOsApi(async () => ({}));
    expect(Object.keys(api).sort()).toEqual([...COMMAND_NAMES].sort());
  });

  it("sends the command name and its input over the one IPC channel", async () => {
    const invoke = vi.fn(async () => ({ ok: true }));
    const api = buildShopOsApi(invoke);
    await api["items.list"]({ limit: 10, offset: 0 });
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNEL, "items.list", { limit: 10, offset: 0 });
  });

  it("sends an empty object when a command is called without input", async () => {
    const invoke = vi.fn(async () => ({ ok: true }));
    const api = buildShopOsApi(invoke);
    await (api["settings.get"] as (input?: unknown) => Promise<unknown>)();
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNEL, "settings.get", {});
  });

  it("uses the same channel name as the main process", () => {
    expect(IPC_CHANNEL).toBe("shopos:invoke");
  });
});

describe("preload entry", () => {
  it("exposes the api to the page as window.shopos, wired to ipcRenderer", async () => {
    const exposeInMainWorld = vi.fn();
    const invoke = vi.fn(async () => ({ ok: true }));
    vi.doMock("electron", () => ({
      contextBridge: { exposeInMainWorld },
      ipcRenderer: { invoke },
    }));
    await import("../../src/preload/index");
    expect(exposeInMainWorld).toHaveBeenCalledOnce();
    const [globalName, api] = exposeInMainWorld.mock.calls[0] as [
      string,
      Record<string, (input: unknown) => Promise<unknown>>,
    ];
    expect(globalName).toBe("shopos");
    expect(Object.keys(api).sort()).toEqual([...COMMAND_NAMES].sort());
    await api["bills.get"]?.({ id: "b1" });
    expect(invoke).toHaveBeenCalledWith(IPC_CHANNEL, "bills.get", { id: "b1" });
  });
});
