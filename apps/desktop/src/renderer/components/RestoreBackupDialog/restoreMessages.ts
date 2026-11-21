import {
  DEFAULT_TIME_ZONE,
  businessDateOf,
  financialYearOfBusinessDate,
  formatBillNumber,
  isValidTimeZone,
  type IBackupRestoreResult,
} from "@shopos/core";
import { uiText } from "../../strings";
import { EXAMPLE_SEQUENCE } from "./RestoreBackupDialog.constants";
import type { RestoreExampleProfile } from "./RestoreBackupDialog.types";

/** Fill {name} places in a screen text: fillText("from {a}", { a: "1" }) gives "from 1". */
export function fillText(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (filledText, [name, value]) => filledText.replaceAll(`{${name}}`, String(value)),
    text,
  );
}

/**
 * A bill number in the shop's format and financial year, to show what to type. The year follows the
 * shop's zone; an unfinished zone name falls back to the default so the example never breaks.
 */
export function restoreExampleNumber(profile: RestoreExampleProfile, now: Date): string {
  const zone = isValidTimeZone(profile.timeZone) ? profile.timeZone : DEFAULT_TIME_ZONE;
  const financialYear = financialYearOfBusinessDate(businessDateOf(now.getTime(), zone));
  return formatBillNumber(
    profile.numberTemplate,
    profile.seriesCode,
    financialYear,
    EXAMPLE_SEQUENCE,
  );
}

/** What the owner is told before the app restarts: the next bill number and the numbers recorded as lost. */
export function restoreStartedMessage(result: IBackupRestoreResult): string {
  const text = uiText.restore;
  const { gapRecorded } = result;
  const parts = [
    fillText(text.started, { next: result.nextBillNo }),
    gapRecorded && fillText(text.lostRange, { from: gapRecorded.seqFrom, to: gapRecorded.seqTo }),
    gapRecorded?.isEstimated && text.lostGuess,
  ];
  return parts.filter((part): part is string => typeof part === "string").join(" ");
}
