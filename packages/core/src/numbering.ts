import { DateTime } from "luxon";
import { MACHINE_FORMAT, businessDateOf, financialYearOfBusinessDate } from "./businessDate";
import { CoreError } from "./errors";

export const DEFAULT_NUMBER_TEMPLATE = "{series}/{fy}/{seq}";
export const SEQ_WIDTH = 6;
export const MAX_NUMBER_LENGTH = 16;

/**
 * Indian financial year: 1 April to 31 March. 1 Apr 2026 .. 31 Mar 2027 -> "26-27".
 * It reads the date in the device's own zone, as before; bills use the shop's zone instead
 * (`financialYearOfBusinessDate`).
 */
export function financialYear(date: Date): string {
  return financialYearOfBusinessDate(
    DateTime.fromJSDate(date).reconfigure(MACHINE_FORMAT).toFormat("yyyy-LL-dd"),
  );
}

export function formatBillNumber(
  template: string,
  series: string,
  fy: string,
  seq: number,
): string {
  if (!Number.isSafeInteger(seq) || seq < 1)
    throw new CoreError("INVALID_FIELD", "sequence must be 1 or more");
  const padded = String(seq).padStart(SEQ_WIDTH, "0");
  if (padded.length > SEQ_WIDTH)
    throw new CoreError("INVALID_FIELD", "bill sequence overflowed its width");
  return template.replace("{series}", series).replace("{fy}", fy).replace("{seq}", padded);
}

const LEGAL = /^[A-Za-z0-9\-/]+$/;

/**
 * Check a number template and show an example. The example's financial year is the one of the
 * shop's zone at `now` (never the device's), so the preview matches the number the next bill gets.
 */
export function validateNumberTemplate(
  template: string,
  series: string,
  now: Date,
  timeZone: string,
): { ok: true; example: string } | { ok: false; reason: string } {
  if (!template.includes("{seq}")) return { ok: false, reason: "Template must contain {seq}" };
  if (!LEGAL.test(series))
    return { ok: false, reason: "Series may use letters, digits, - and / only" };
  const worst = formatBillNumber(template, series, "99-00", 10 ** SEQ_WIDTH - 1);
  if (!LEGAL.test(worst))
    return { ok: false, reason: "Number may use letters, digits, - and / only" };
  if (worst.length > MAX_NUMBER_LENGTH) {
    return {
      ok: false,
      reason: `Number could be ${worst.length} characters; the limit is ${MAX_NUMBER_LENGTH}`,
    };
  }
  const exampleFinancialYear = financialYearOfBusinessDate(businessDateOf(now.getTime(), timeZone));
  return { ok: true, example: formatBillNumber(template, series, exampleFinancialYear, 1) };
}
