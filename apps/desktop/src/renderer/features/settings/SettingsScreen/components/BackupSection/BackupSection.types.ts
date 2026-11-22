import type { BackupStatus } from "@shopos/core";

export interface IBackupSectionProps {
  backupFolder: string;
  /** Null until the first status has been read. */
  status: BackupStatus | null;
  isBackingUp: boolean;
  onChooseFolder: () => void;
  onBackUpNow: () => void;
  onRestore: () => void;
}
