import fs from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  registerQuitHooks,
  runBackupQuietly,
  startBackupTimer,
} from "../../src/main/app/backupLifecycle";
import { buildAppStateFixture } from "../helpers/appStateFixture";

afterEach(() => {
  vi.restoreAllMocks();
});

/** A fake app that records the listeners registered with app.on(...). */
function buildFakeApp() {
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const app = {
    on: (eventName: string, listener: (...args: unknown[]) => void) =>
      void listeners.set(eventName, listener),
    quit: vi.fn(),
  } as unknown as Parameters<typeof registerQuitHooks>[0];
  return { app, listeners, quit: app.quit as unknown as ReturnType<typeof vi.fn> };
}

describe("runBackupQuietly", () => {
  it("writes a backup file when a backup folder is chosen", async () => {
    const { state, backupFolder } = buildAppStateFixture();
    await runBackupQuietly(state);
    expect(fs.readdirSync(backupFolder).filter((name) => name.endsWith(".sqlite"))).toHaveLength(1);
  });

  it("does nothing when no backup folder is chosen", async () => {
    const { state } = buildAppStateFixture({ chooseBackupFolder: false });
    const run = vi.spyOn(state.backup!, "run");
    await runBackupQuietly(state);
    expect(run).not.toHaveBeenCalled();
  });

  it("does nothing, and does not touch the database, before the backup service exists", async () => {
    const { state } = buildAppStateFixture({ withBackup: false });
    state.connection = null;
    const logError = vi.fn();
    await runBackupQuietly(state, logError);
    expect(logError).not.toHaveBeenCalled();
  });

  it("logs a failed backup instead of throwing, so closing the app is never blocked", async () => {
    const { state } = buildAppStateFixture();
    vi.spyOn(state.backup!, "run").mockRejectedValue(new Error("disk full"));
    const logError = vi.fn();
    await expect(runBackupQuietly(state, logError)).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith("Backup failed (shown in Settings):", "disk full");
  });

  it("logs a failure that is not an Error as it is", async () => {
    const { state } = buildAppStateFixture();
    vi.spyOn(state.backup!, "run").mockRejectedValue("plain text failure");
    const logError = vi.fn();
    await runBackupQuietly(state, logError);
    expect(logError).toHaveBeenCalledWith(
      "Backup failed (shown in Settings):",
      "plain text failure",
    );
  });

  it("logs to the console by default", async () => {
    const { state } = buildAppStateFixture();
    vi.spyOn(state.backup!, "run").mockRejectedValue(new Error("no space"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    await runBackupQuietly(state);
    expect(consoleError).toHaveBeenCalledOnce();
  });
});

describe("startBackupTimer", () => {
  it("backs up on every tick of the timer it starts", async () => {
    const { state } = buildAppStateFixture();
    const run = vi.spyOn(state.backup!, "run");
    let tick: (() => void) | undefined;
    const fakeSetInterval = vi.fn((callback: () => void) => {
      tick = callback;
      return 42 as unknown as NodeJS.Timeout;
    });
    startBackupTimer(state, 900_000, fakeSetInterval as unknown as typeof setInterval);
    expect(fakeSetInterval).toHaveBeenCalledWith(expect.any(Function), 900_000);
    expect(state.backupTimer).toBe(42);
    tick?.();
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
  });

  it("uses the real interval timer by default", () => {
    vi.useFakeTimers();
    const { state } = buildAppStateFixture();
    startBackupTimer(state, 1000);
    expect(vi.getTimerCount()).toBe(1);
    clearInterval(state.backupTimer!);
    vi.useRealTimers();
  });
});

describe("registerQuitHooks", () => {
  it("holds the quit, backs up once more, closes the database, then quits", async () => {
    const { state, backupFolder, testDb } = buildAppStateFixture();
    const { app, listeners, quit } = buildFakeApp();
    registerQuitHooks(app, state);
    const preventDefault = vi.fn();
    listeners.get("before-quit")?.({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(state.isQuitting).toBe(true);
    await vi.waitFor(() => expect(quit).toHaveBeenCalledOnce());
    expect(fs.readdirSync(backupFolder).filter((name) => name.endsWith(".sqlite"))).toHaveLength(1);
    expect(testDb.sqlite.open).toBe(false);
  });

  it("stops the periodic timer when quitting", () => {
    const { state } = buildAppStateFixture();
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    state.backupTimer = setInterval(() => {}, 100_000);
    const { app, listeners } = buildFakeApp();
    registerQuitHooks(app, state);
    listeners.get("before-quit")?.({ preventDefault: () => {} });
    expect(clearIntervalSpy).toHaveBeenCalledWith(state.backupTimer);
  });

  it("lets the app quit straight away once it is already quitting", () => {
    const { state } = buildAppStateFixture();
    state.isQuitting = true;
    const { app, listeners } = buildFakeApp();
    registerQuitHooks(app, state);
    const preventDefault = vi.fn();
    listeners.get("before-quit")?.({ preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("lets the app quit straight away when it never finished starting (no backup service)", () => {
    const { state } = buildAppStateFixture({ withBackup: false });
    const { app, listeners } = buildFakeApp();
    registerQuitHooks(app, state);
    const preventDefault = vi.fn();
    listeners.get("before-quit")?.({ preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("quits the app when the last window closes", () => {
    const { state } = buildAppStateFixture();
    const { app, listeners, quit } = buildFakeApp();
    registerQuitHooks(app, state);
    listeners.get("window-all-closed")?.();
    expect(quit).toHaveBeenCalledOnce();
  });
});
