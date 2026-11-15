import { CoreError } from "./errors";

const BUSINESS_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const APRIL_MONTH_NUMBER = 4;
const MAX_DATE_INSTANT_MS = 8_640_000_000_000_000;

function twoDigits(yearNumber: number): string {
  return String(yearNumber % 100).padStart(2, "0");
}

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    throw new CoreError("INVALID_FIELD", `unknown time zone "${timeZone}"`);
  }
}

/**
 * The calendar date (YYYY-MM-DD) in the shop's named time zone at a UTC instant.
 * Works out once when a bill is saved; the device's own zone is never used (FR-019a).
 */
export function businessDateOf(instantMs: number, timeZone: string): string {
  const isInvalidInstant =
    !Number.isSafeInteger(instantMs) || Math.abs(instantMs) > MAX_DATE_INSTANT_MS;
  if (isInvalidInstant) {
    throw new CoreError(
      "INVALID_FIELD",
      "instant must be integer milliseconds within the supported Date range",
    );
  }
  const dateParts = formatterFor(timeZone).formatToParts(new Date(instantMs));
  const partValue = (partType: string) =>
    dateParts.find((datePart) => datePart.type === partType)?.value ?? "";
  return `${partValue("year")}-${partValue("month")}-${partValue("day")}`;
}

function daysInMonth(yearNumber: number, monthNumber: number): number {
  const isLeapYear = yearNumber % 4 === 0 && (yearNumber % 100 !== 0 || yearNumber % 400 === 0);
  const februaryDays = isLeapYear ? 29 : 28;
  return [31, februaryDays, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][monthNumber - 1] ?? 0;
}

/** Indian financial year (1 April to 31 March) of a business date: 2027-04-01 -> "27-28". */
export function financialYearOfBusinessDate(businessDate: string): string {
  const matchedParts = BUSINESS_DATE_PATTERN.exec(businessDate);
  const yearNumber = Number(matchedParts?.[1]);
  const monthNumber = Number(matchedParts?.[2]);
  const dayNumber = Number(matchedParts?.[3]);
  const isInvalidDate =
    !matchedParts ||
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1 ||
    dayNumber > daysInMonth(yearNumber, monthNumber);
  if (isInvalidDate) {
    throw new CoreError("INVALID_FIELD", "business date must look like 2027-03-31");
  }
  const startYear = monthNumber >= APRIL_MONTH_NUMBER ? yearNumber : yearNumber - 1;
  return `${twoDigits(startYear)}-${twoDigits(startYear + 1)}`;
}
