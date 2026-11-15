import type { BrowserWindow, Dialog } from "electron";
import type { Shell } from "../ipc/handlers";
import { restoreBackup } from "../services/BackupService";
import { stopBackupTimer, type IAppState } from "./appState";

const RESTORE_DELAY_MILLISECONDS = 200;

export interface IShellDependencies {
  dialog: Pick<Dialog, "showOpenDialog" | "showSaveDialog" | "showErrorBox">;
  getFocusedWindow: () => BrowserWindow | undefined;
  /** The app functions a restore needs: start again, then exit. */
  app: { relaunch(): void; exit(exitCode: number): void };
  state: IAppState;
  databasePath: string;
  scheduleLater?: (task: () => void, delayMilliseconds: number) => unknown;
}

function messageOf(caughtError: unknown): string {
  return caughtError instanceof Error ? caughtError.message : String(caughtError);
}

/** Close the database, put the backup file in place, and restart. Runs after the reply reached the renderer. */
function restoreAndRelaunch(filePath: string, dependencies: IShellDependencies): void {
  const { app, dialog, state, databasePath } = dependencies;
  try {
    state.isQuitting = true;
    stopBackupTimer(state);
    state.connection?.sqlite.close();
    restoreBackup(filePath, databasePath);
    app.relaunch();
  } catch (caughtError) {
    dialog.showErrorBox("Restore failed", messageOf(caughtError));
  }
  app.exit(0);
}

/** The things only the Electron shell can do (native dialogs, restart), as the handlers expect them. */
export function createShell(dependencies: IShellDependencies): Shell {
  const { dialog, getFocusedWindow } = dependencies;
  const scheduleLater = dependencies.scheduleLater ?? setTimeout;
  return {
    async pickFolder() {
      const openDialogResult = await dialog.showOpenDialog(getFocusedWindow()!, {
        properties: ["openDirectory", "createDirectory"],
      });
      return openDialogResult.canceled ? null : (openDialogResult.filePaths[0] ?? null);
    },
    async pickBackupFile() {
      const openDialogResult = await dialog.showOpenDialog(getFocusedWindow()!, {
        properties: ["openFile"],
        filters: [{ name: "Shop OS backup", extensions: ["sqlite"] }],
      });
      return openDialogResult.canceled ? null : (openDialogResult.filePaths[0] ?? null);
    },
    async pickPdfPath(defaultName) {
      const saveDialogResult = await dialog.showSaveDialog(getFocusedWindow()!, {
        defaultPath: defaultName,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      return saveDialogResult.canceled ? null : (saveDialogResult.filePath ?? null);
    },
    scheduleRestore(filePath) {
      scheduleLater(() => restoreAndRelaunch(filePath, dependencies), RESTORE_DELAY_MILLISECONDS);
    },
  };
}
