import type { App } from "electron";
import { SettingsRepository } from "../repositories/SettingsRepository";
import { stopBackupTimer, type IAppState } from "./appState";

/** Runs a backup if a folder is chosen; a failure is logged and shown in Settings, never thrown. */
export async function runBackupQuietly(
  state: IAppState,
  logError: (message: string, detail: unknown) => void = console.error,
): Promise<void> {
  try {
    const isBackupConfigured =
      state.backup &&
      new SettingsRepository(state.connection!.db, state.context!).get().backupFolder;
    if (isBackupConfigured) await state.backup!.run();
  } catch (caughtError) {
    logError(
      "Backup failed (shown in Settings):",
      caughtError instanceof Error ? caughtError.message : caughtError,
    );
  }
}

export function startBackupTimer(
  state: IAppState,
  everyMilliseconds: number,
  setIntervalFunction: typeof setInterval = setInterval,
): void {
  state.backupTimer = setIntervalFunction(() => void runBackupQuietly(state), everyMilliseconds);
}

/** Back up once more on close, then quit. */
export function registerQuitHooks(app: Pick<App, "on" | "quit">, state: IAppState): void {
  app.on("before-quit", (quitEvent) => {
    if (state.isQuitting || !state.backup) return;
    state.isQuitting = true;
    quitEvent.preventDefault();
    stopBackupTimer(state);
    void runBackupQuietly(state).finally(() => {
      state.connection?.sqlite.close();
      app.quit();
    });
  });
  app.on("window-all-closed", () => {
    app.quit();
  });
}
