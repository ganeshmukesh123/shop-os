import type { Connection } from "../db/connection";
import type { Ctx } from "../db/seed";
import type { BackupService } from "../services/BackupService";

/** What the running app holds between start-up, the backup timer, restore and quit. */
export interface IAppState {
  connection: Connection | null;
  context: Ctx | null;
  backup: BackupService | null;
  backupTimer: NodeJS.Timeout | null;
  isQuitting: boolean;
}

export function createAppState(): IAppState {
  return { connection: null, context: null, backup: null, backupTimer: null, isQuitting: false };
}

export function stopBackupTimer(state: IAppState): void {
  if (state.backupTimer) clearInterval(state.backupTimer);
}
