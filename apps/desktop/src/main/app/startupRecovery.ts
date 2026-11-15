import type { Dialog } from "electron";
import { restoreBackup } from "../services/BackupService";

export interface IStartupRecoveryDependencies {
  app: { relaunch(): void; exit(exitCode: number): void };
  dialog: Pick<Dialog, "showOpenDialog" | "showErrorBox">;
}

const DAMAGED_TITLE = "Shop OS database is damaged";
const BACKUP_FILE_FILTER = { name: "Shop OS backup", extensions: ["sqlite"] };

function messageOf(caughtError: unknown): string {
  return caughtError instanceof Error ? caughtError.message : String(caughtError);
}

async function pickBackupFile(dialog: IStartupRecoveryDependencies["dialog"]): Promise<string> {
  const openDialogResult = await dialog.showOpenDialog({
    title: "Choose a Shop OS backup to restore",
    properties: ["openFile"],
    filters: [BACKUP_FILE_FILTER],
  });
  const isCancelled = openDialogResult.canceled;
  return isCancelled ? "" : (openDialogResult.filePaths[0] ?? "");
}

/**
 * The live database failed its integrity check, so the app cannot open it.
 * Example: the counter PC lost power mid-write and shopos.sqlite is damaged.
 *
 *   damaged --> pick a backup --> restore --> relaunch
 *                  | cancelled or restore failed
 *                  v
 *             explain, exit(1)  (the damaged file is left untouched)
 */
export async function offerRestoreForDamagedDatabase(
  dependencies: IStartupRecoveryDependencies,
  databasePath: string,
  damageMessage: string,
): Promise<void> {
  const { app, dialog } = dependencies;
  const backupFilePath = await pickBackupFile(dialog);
  const hasChosenBackup = backupFilePath.length > 0;
  if (hasChosenBackup) {
    try {
      restoreBackup(backupFilePath, databasePath);
      app.relaunch();
      app.exit(0);
      return;
    } catch (caughtError) {
      dialog.showErrorBox("Restore failed", messageOf(caughtError));
    }
  }
  dialog.showErrorBox(
    DAMAGED_TITLE,
    `${damageMessage} Start Shop OS again and choose a backup, or follow docs/restore-guide.md.`,
  );
  app.exit(1);
}
