import { compactStampAtOffset } from "@shopos/core";

/**
 * The stamp in a backup file name (`shopos-YYYYMMDD-HHmmss.sqlite`): the computer's own date and
 * time, because the file sits on the owner's disk. Bills use the shop's zone instead (FR-019a).
 * The device's offset at that moment is read here, at the edge, so the core rule stays free of
 * hidden inputs. The offset always exists; a zone name may not (TZ=UTC+3), so it is not used.
 */
export function backupStampOf(backupTime: Date): string {
  // getTimezoneOffset counts minutes behind UTC (India gives -330), so flip the sign.
  const deviceOffsetMinutes = -backupTime.getTimezoneOffset();
  return compactStampAtOffset(backupTime.getTime(), deviceOffsetMinutes);
}
