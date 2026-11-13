import { CoreError } from "./errors";

export const DEFAULT_NUMBER_TEMPLATE = "{series}/{fy}/{seq}";
export const SEQ_WIDTH = 6;
export const MAX_NUMBER_LENGTH = 16;

/** Indian financial year: 1 April to 31 March. 1 Apr 2026 .. 31 Mar 2027 -> "26-27" */
export function financialYear(date: Date): string {
  const startYear = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  const two = (yearNumber: number) => String(yearNumber % 100).padStart(2, "0");
  return `${two(startYear)}-${two(startYear + 1)}`;
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

export function validateNumberTemplate(
  template: string,
  series: string,
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
  return { ok: true, example: formatBillNumber(template, series, financialYear(new Date()), 1) };
}
