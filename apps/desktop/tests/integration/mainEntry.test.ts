import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const electronMocks = vi.hoisted(() => ({
  setPath: vi.fn(),
  userDataFolder: { value: "" },
  constructedWindows: [] as unknown[],
  listeners: new Map<string, () => void>(),
  focusedWindow: { value: null as unknown },
  showOpenDialog: vi.fn(async (_parentWindow?: unknown) => ({
    canceled: true,
    filePaths: [] as string[],
  })),
  handle: vi.fn(),
}));

vi.mock("electron", () => {
  class FakeBrowserWindow {
    static getAllWindows = () => electronMocks.constructedWindows;
    static getFocusedWindow = () => electronMocks.focusedWindow.value;
    webContents = { setWindowOpenHandler: vi.fn(), on: vi.fn() };
    loadURL = vi.fn(async () => {});
    loadFile = vi.fn(async () => {});
    constructor(public readonly options: unknown) {
      electronMocks.constructedWindows.push(this);
    }
  }
  return {
    app: {
      isPackaged: false,
      setPath: electronMocks.setPath,
      getPath: () => electronMocks.userDataFolder.value,
      whenReady: async () => {},
      on: (eventName: string, listener: () => void) =>
        void electronMocks.listeners.set(eventName, listener),
      quit: vi.fn(),
      relaunch: vi.fn(),
      exit: vi.fn(),
    },
    BrowserWindow: FakeBrowserWindow,
    dialog: {
      showOpenDialog: electronMocks.showOpenDialog,
      showSaveDialog: vi.fn(),
      showErrorBox: vi.fn(),
    },
    session: { defaultSession: { webRequest: { onHeadersReceived: vi.fn() } } },
    ipcMain: { handle: electronMocks.handle },
  };
});

beforeAll(async () => {
  vi.useFakeTimers();
  electronMocks.userDataFolder.value = fs.mkdtempSync(path.join(os.tmpdir(), "shopos-entry-"));
  process.env["SHOPOS_USER_DATA"] = electronMocks.userDataFolder.value;
  await import("../../src/main/index"); // importing the entry file starts the app, as Electron does
  await vi.waitFor(() => expect(electronMocks.constructedWindows).toHaveLength(1));
});

afterAll(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  delete process.env["SHOPOS_USER_DATA"];
});

describe("main entry file", () => {
  it("points the app at the test data folder", () => {
    expect(electronMocks.setPath).toHaveBeenCalledWith(
      "userData",
      electronMocks.userDataFolder.value,
    );
  });

  it("creates the database in that folder", () => {
    expect(fs.existsSync(path.join(electronMocks.userDataFolder.value, "shopos.sqlite"))).toBe(
      true,
    );
  });

  it("opens the main window with the security defaults", () => {
    const { options } = electronMocks.constructedWindows[0] as {
      options: { webPreferences: object };
    };
    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    });
  });

  it("listens for the app events that keep the data safe on quit", () => {
    expect([...electronMocks.listeners.keys()].sort()).toEqual([
      "activate",
      "before-quit",
      "window-all-closed",
    ]);
  });
  it("does not open a second window when the dock icon is clicked and one is open", () => {
    electronMocks.listeners.get("activate")?.();
    expect(electronMocks.constructedWindows).toHaveLength(1);
  });

  it("opens native dialogs on top of the window that has focus", async () => {
    const focused = { name: "focused window" };
    electronMocks.focusedWindow.value = focused;
    const listener = electronMocks.handle.mock.calls[0]?.[1] as (
      event: unknown,
      name: string,
      input: unknown,
    ) => Promise<unknown>;
    const result = await listener({}, "system.pickFolder", {});
    expect(electronMocks.showOpenDialog.mock.calls[0]?.[0]).toBe(focused);
    expect(result).toEqual({ ok: true, data: { path: null } });
  });

  it("opens native dialogs without a parent when no window has focus", async () => {
    electronMocks.focusedWindow.value = null;
    electronMocks.showOpenDialog.mockClear();
    const listener = electronMocks.handle.mock.calls[0]?.[1] as (
      event: unknown,
      name: string,
      input: unknown,
    ) => Promise<unknown>;
    await listener({}, "system.pickFolder", {});
    expect(electronMocks.showOpenDialog.mock.calls[0]?.[0]).toBeUndefined();
  });
});
