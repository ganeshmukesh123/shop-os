import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IAppConfig } from "../../src/main/app/appConfig";
import type { IMainWindow } from "../../src/main/app/mainWindow";
import { MIGRATIONS } from "../helpers/testDb";
import { makeTempFolder } from "../helpers/appStateFixture";

const electronMocks = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock("electron", () => ({ ipcMain: { handle: electronMocks.handle }, BrowserWindow: class {} }));

import { startApp, type IStartAppDependencies } from "../../src/main/app/startApp";

beforeEach(() => {
  vi.useFakeTimers();
  electronMocks.handle.mockReset();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

function buildConfig(overrides: Partial<IAppConfig> = {}): IAppConfig {
  return {
    isDev: false,
    rendererUrl: undefined,
    databasePath: path.join(makeTempFolder("shopos-start-"), "data", "shopos.sqlite"),
    migrationsFolder: MIGRATIONS,
    preloadPath: "/app/preload/index.js",
    rendererHtmlPath: "/app/renderer/index.html",
    ...overrides,
  };
}

const buildFakeWindow = () =>
  ({
    webContents: { setWindowOpenHandler: vi.fn(), on: vi.fn() },
    loadURL: vi.fn(async () => {}),
    loadFile: vi.fn(async () => {}),
  }) as unknown as IMainWindow;

/** Fake Electron pieces that record what startApp does with them. */
function buildDependencies(
  overrides: { whenReady?: () => Promise<void>; windows?: unknown[] } = {},
) {
  const appListeners = new Map<string, () => void>();
  const onHeadersReceived = vi.fn();
  const windows = overrides.windows ?? [];
  const dependencies = {
    app: {
      whenReady: overrides.whenReady ?? (async () => {}),
      on: (eventName: string, listener: () => void) => void appListeners.set(eventName, listener),
      quit: vi.fn(),
      relaunch: vi.fn(),
      exit: vi.fn(),
    },
    dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn(), showErrorBox: vi.fn() },
    getDefaultSession: () => ({ webRequest: { onHeadersReceived } }),
    createBrowserWindow: vi.fn(() => buildFakeWindow()),
    getAllWindows: () => windows,
    getFocusedWindow: () => undefined,
  };
  return {
    dependencies: dependencies as unknown as IStartAppDependencies,
    parts: dependencies,
    appListeners,
    onHeadersReceived,
  };
}

describe("startApp", () => {
  it("creates the data folder and a migrated, seeded database", async () => {
    const config = buildConfig();
    await startApp(buildDependencies().dependencies, config);
    expect(fs.existsSync(config.databasePath)).toBe(true);
  });

  it("registers the commands, installs the security headers and opens the window", async () => {
    const { dependencies, parts, onHeadersReceived } = buildDependencies();
    await startApp(dependencies, buildConfig());
    expect(electronMocks.handle).toHaveBeenCalledWith("shopos:invoke", expect.any(Function));
    expect(onHeadersReceived).toHaveBeenCalledOnce();
    expect(parts.createBrowserWindow).toHaveBeenCalledOnce();
  });

  it("starts the periodic backup timer", async () => {
    await startApp(buildDependencies().dependencies, buildConfig());
    expect(vi.getTimerCount()).toBe(1);
  });

  it("listens for activate, before-quit and window-all-closed", async () => {
    const { dependencies, appListeners } = buildDependencies();
    await startApp(dependencies, buildConfig());
    expect([...appListeners.keys()].sort()).toEqual([
      "activate",
      "before-quit",
      "window-all-closed",
    ]);
  });

  it("opens a window again when the dock icon is clicked and none is open", async () => {
    const { dependencies, parts, appListeners } = buildDependencies({ windows: [] });
    await startApp(dependencies, buildConfig());
    appListeners.get("activate")?.();
    expect(parts.createBrowserWindow).toHaveBeenCalledTimes(2);
  });

  it("does not open a second window when one is already open", async () => {
    const { dependencies, parts, appListeners } = buildDependencies({ windows: [{}] });
    await startApp(dependencies, buildConfig());
    appListeners.get("activate")?.();
    expect(parts.createBrowserWindow).toHaveBeenCalledOnce();
  });

  it("shows why the app could not start, then exits with code 1", async () => {
    const { dependencies, parts } = buildDependencies({
      whenReady: () => Promise.reject(new Error("no display")),
    });
    await startApp(dependencies, buildConfig());
    expect(parts.dialog.showErrorBox).toHaveBeenCalledWith("Shop OS could not start", "no display");
    expect(parts.app.exit).toHaveBeenCalledWith(1);
  });

  it("shows a start failure that is not an Error as text", async () => {
    const { dependencies, parts } = buildDependencies({
      whenReady: () => Promise.reject("plain failure"),
    });
    await startApp(dependencies, buildConfig());
    expect(parts.dialog.showErrorBox).toHaveBeenCalledWith(
      "Shop OS could not start",
      "plain failure",
    );
  });

  it("fails to start, with a message, when the database cannot be opened", async () => {
    const { dependencies, parts } = buildDependencies();
    await startApp(dependencies, buildConfig({ migrationsFolder: "/definitely/not/here" }));
    expect(parts.dialog.showErrorBox).toHaveBeenCalledOnce();
    expect(parts.app.exit).toHaveBeenCalledWith(1);
    expect(parts.createBrowserWindow).not.toHaveBeenCalled();
  });
});
