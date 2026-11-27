import { DateTime } from "luxon";

/**
 * A stored time (ISO text) shown as the computer's own date and time, in its own language and
 * order, for example "15/11/2026, 3:00:00 pm". For times that are not a bill's business date:
 * a bill's date comes from the shop's zone (FR-019a).
 */
export function formatDeviceDateTime(isoText: string): string {
  return DateTime.fromISO(isoText).toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS);
}
