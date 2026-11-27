import { compactStampOf } from "@shopos/core";

/**
 * The stamp in a backup file name (`shopos-YYYYMMDD-HHmmss.sqlite`): the computer's own date and
 * time, because the file sits on the owner's disk. Bills use the shop's zone instead (FR-019a).
 * The device zone is read here, at the edge, so the core rule stays free of hidden inputs.
 */
export function backupStampOf(backupTime: Date): string {
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return compactStampOf(backupTime.getTime(), deviceZone);
}
