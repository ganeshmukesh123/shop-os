import fs from "node:fs";
import path from "node:path";
import type { IAppConfig } from "../../src/main/app/appConfig";
import type { IMainWindow } from "../../src/main/app/mainWindow";
import { MIGRATIONS } from "../helpers/testDb";
import { makeTempFolder } from "../helpers/appStateFixture";

const electronMocks = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock("electron", () => ({ ipcMain: { handle: electronMocks.handle }, BrowserWindow: class {} }));

import Database from "better-sqlite3";
import {
  PRE_MIGRATION_FOLDER_NAME,
  startApp,
  type IStartAppDependencies,
} from "../../src/main/app/startApp";
import { openDatabase } from "../../src/main/db/connection";

const START_TIME = new Date(2026, 10, 15, 9, 30, 0);

/** A counter PC that lost power mid-write: the file is there but is not a readable database. */
function writeDamagedDatabase(databasePath: string): void {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.writeFileSync(databasePath, "damaged bytes ".repeat(500));
}

function createBackupFile(): string {
  const backupPath = path.join(makeTempFolder("shopos-start-"), "shopos-20261114-180000.sqlite");
  openDatabase(backupPath, { migrationsFolder: MIGRATIONS }).sqlite.close();
  return backupPath;
}

beforeEach(() => {
  // Fake only the backup timer's clocks: SQLite's online backup steps through setImmediate.
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout"] });
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
  const setPermissionRequestHandler = vi.fn();
  const setPermissionCheckHandler = vi.fn();
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
    getDefaultSession: () => ({
      webRequest: { onHeadersReceived },
      setPermissionRequestHandler,
      setPermissionCheckHandler,
    }),
    createBrowserWindow: vi.fn(() => buildFakeWindow()),
    getAllWindows: () => windows,
    getFocusedWindow: () => undefined,
  };
  return {
    dependencies: dependencies as unknown as IStartAppDependencies,
    parts: dependencies,
    appListeners,
    onHeadersReceived,
    setPermissionRequestHandler,
    setPermissionCheckHandler,
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

  it("denies every permission request and check on the default session", async () => {
    const { dependencies, setPermissionRequestHandler, setPermissionCheckHandler } =
      buildDependencies();
    await startApp(dependencies, buildConfig());
    const respond = vi.fn();
    // The last handler set is the one in force, so a later permissive one would fail this test.
    setPermissionRequestHandler.mock.lastCall?.[0]({}, "media", respond);
    expect(respond).toHaveBeenCalledExactlyOnceWith(false);
    expect(setPermissionCheckHandler.mock.lastCall?.[0]({}, "media")).toBe(false);
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

  it("backs up the database before running a pending migration on shop data", async () => {
    const config = buildConfig();
    fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
    const olderInstall = openDatabase(config.databasePath, { migrationsFolder: MIGRATIONS });
    olderInstall.sqlite
      .prepare(
        "delete from __drizzle_migrations where created_at = (select max(created_at) from __drizzle_migrations)",
      )
      .run();
    olderInstall.sqlite.close();

    await startApp(buildDependencies().dependencies, config, () => START_TIME);

    const backupFolder = path.join(path.dirname(config.databasePath), PRE_MIGRATION_FOLDER_NAME);
    expect(fs.readdirSync(backupFolder)).toEqual(["shopos-pre-migrate-20261115-093000.sqlite"]);
  });

  it("takes no pre-migration copy for a brand-new database", async () => {
    const config = buildConfig();

    await startApp(buildDependencies().dependencies, config, () => START_TIME);

    const backupFolder = path.join(path.dirname(config.databasePath), PRE_MIGRATION_FOLDER_NAME);
    expect(fs.existsSync(backupFolder)).toBe(false);
  });

  it("offers a restore when the database is damaged, then restarts on the restored file", async () => {
    const config = buildConfig();
    writeDamagedDatabase(config.databasePath);
    const backupFile = createBackupFile();
    const { dependencies, parts } = buildDependencies();
    parts.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [backupFile] });

    await startApp(dependencies, config);

    const restored = new Database(config.databasePath, { readonly: true });
    expect(restored.pragma("integrity_check", { simple: true })).toBe("ok");
    restored.close();
    expect(parts.app.relaunch).toHaveBeenCalledOnce();
    expect(parts.app.exit).toHaveBeenCalledWith(0);
    expect(parts.createBrowserWindow).not.toHaveBeenCalled();
  });

  it("explains and exits when the owner cancels the restore of a damaged database", async () => {
    const config = buildConfig();
    writeDamagedDatabase(config.databasePath);
    const { dependencies, parts } = buildDependencies();
    parts.dialog.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

    await startApp(dependencies, config);

    expect(parts.dialog.showErrorBox).toHaveBeenCalledWith(
      "Shop OS database is damaged",
      expect.stringContaining("restore-guide"),
    );
    expect(parts.app.exit).toHaveBeenCalledWith(1);
    expect(parts.app.relaunch).not.toHaveBeenCalled();
  });

  it("reports a failed restore and leaves the app closed", async () => {
    const config = buildConfig();
    writeDamagedDatabase(config.databasePath);
    const notABackup = path.join(makeTempFolder("shopos-start-"), "notes.sqlite");
    fs.writeFileSync(notABackup, "not a backup");
    const { dependencies, parts } = buildDependencies();
    parts.dialog.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [notABackup] });

    await startApp(dependencies, config);

    expect(parts.dialog.showErrorBox).toHaveBeenCalledWith("Restore failed", expect.any(String));
    expect(parts.app.exit).toHaveBeenCalledWith(1);
  });

  it("fails to start, with a message, when the database cannot be opened", async () => {
    const { dependencies, parts } = buildDependencies();
    await startApp(dependencies, buildConfig({ migrationsFolder: "/definitely/not/here" }));
    expect(parts.dialog.showErrorBox).toHaveBeenCalledOnce();
    expect(parts.app.exit).toHaveBeenCalledWith(1);
    expect(parts.createBrowserWindow).not.toHaveBeenCalled();
  });
});
