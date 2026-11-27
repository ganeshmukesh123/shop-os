import { DateTime, FixedOffsetZone, IANAZone } from "luxon";
import { CoreError } from "./errors";

/** The shop's time zone until it sets its own (research D22). IST has no daylight saving. */
export const DEFAULT_TIME_ZONE = "Asia/Kolkata";

const BUSINESS_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const APRIL_MONTH_NUMBER = 4;
const MAX_DATE_INSTANT_MS = 8_640_000_000_000_000;
const ONE_DAY_MS = 86_400_000;
const ONE_DAY_MINUTES = 1_440;
// One day inside the Date range: Luxon adds the zone offset (under a day everywhere) before it
// builds the wall-clock fields, and past the range edge it formats "Invalid DateTime".
const MAX_SHOP_INSTANT_MS = MAX_DATE_INSTANT_MS - ONE_DAY_MS;
// Machine dates are ASCII Gregorian whatever Luxon's global Settings say (no hidden inputs).
export const MACHINE_FORMAT = {
  locale: "en-US",
  numberingSystem: "latn",
  outputCalendar: "gregory",
} as const;
const BUSINESS_DATE_FORMAT = "yyyy-LL-dd";
const LOCAL_ISO_FORMAT = "yyyy-LL-dd'T'HH:mm:ss";
const COMPACT_STAMP_FORMAT = "yyyyLLdd-HHmmss";

function twoDigits(yearNumber: number): string {
  return String(yearNumber % 100).padStart(2, "0");
}

function assertInstant(instantMs: number): void {
  const isInvalidInstant =
    !Number.isSafeInteger(instantMs) || Math.abs(instantMs) > MAX_SHOP_INSTANT_MS;
  if (isInvalidInstant) {
    throw new CoreError(
      "INVALID_FIELD",
      "instant must be integer milliseconds within the supported Date range, less one day",
    );
  }
}

/** True when the platform knows this named time zone (for example Asia/Kolkata). */
export function isValidTimeZone(timeZone: string): boolean {
  // An offset such as "+05:30" is not a named zone: its daylight-saving rules are unknown.
  const isBlankOrOffset = timeZone.trim() === "" || /^[+-]/.test(timeZone);
  return !isBlankOrOffset && IANAZone.isValidZone(timeZone);
}

/** The instant seen in a named zone. Only named zones are allowed: never "local" or an offset. */
function inShopZone(instantMs: number, timeZone: string): DateTime {
  assertInstant(instantMs);
  if (!isValidTimeZone(timeZone)) {
    throw new CoreError("INVALID_FIELD", `unknown time zone "${timeZone}"`);
  }
  return DateTime.fromMillis(instantMs, { zone: timeZone, ...MACHINE_FORMAT });
}

/**
 * The calendar date (YYYY-MM-DD) in the shop's named time zone at a UTC instant.
 * Works out once when a bill is saved; the device's own zone is never used (FR-019a).
 */
export function businessDateOf(instantMs: number, timeZone: string): string {
  return inShopZone(instantMs, timeZone).toFormat(BUSINESS_DATE_FORMAT);
}

/**
 * The wall-clock time (YYYY-MM-DDTHH:mm:ss, no zone suffix) in the shop's zone at a UTC instant:
 * what the shop's clock showed. Fractions of a second are dropped. Used to show a stored bill time.
 */
export function localIsoOf(instantMs: number, timeZone: string): string {
  return inShopZone(instantMs, timeZone).toFormat(LOCAL_ISO_FORMAT);
}

/**
 * The date and time with no separators (YYYYMMDD-HHmmss) at a fixed UTC offset in minutes (India is
 * +330), for file names such as `shopos-20261205-083405.sqlite`. Names sort in time order. It takes
 * an offset, not a zone name, because a computer's own zone may have no name (TZ=UTC+3), and that
 * must never stop a backup.
 */
export function compactStampAtOffset(instantMs: number, offsetMinutes: number): string {
  assertInstant(instantMs);
  const isInvalidOffset =
    !Number.isSafeInteger(offsetMinutes) || Math.abs(offsetMinutes) >= ONE_DAY_MINUTES;
  if (isInvalidOffset) {
    throw new CoreError("INVALID_FIELD", "offset must be whole minutes within one day of UTC");
  }
  const offsetZone = FixedOffsetZone.instance(offsetMinutes);
  return DateTime.fromMillis(instantMs, { zone: offsetZone, ...MACHINE_FORMAT }).toFormat(
    COMPACT_STAMP_FORMAT,
  );
}

/** The calendar date in a YYYY-MM-DD string, or null when it is not a real date (2027-02-29). */
function calendarDateOf(businessDate: string): DateTime | null {
  const matchedParts = BUSINESS_DATE_PATTERN.exec(businessDate);
  const isWrongShape = matchedParts === null;
  if (isWrongShape) {
    return null;
  }
  try {
    const calendarDate = DateTime.fromObject(
      {
        year: Number(matchedParts[1]),
        month: Number(matchedParts[2]),
        day: Number(matchedParts[3]),
      },
      { zone: "utc", ...MACHINE_FORMAT },
    );
    return calendarDate.isValid ? calendarDate : null;
  } catch {
    // With Luxon's global Settings.throwOnInvalid, an impossible date throws instead.
    return null;
  }
}

/** Indian financial year (1 April to 31 March) of a business date: 2027-04-01 -> "27-28". */
export function financialYearOfBusinessDate(businessDate: string): string {
  const calendarDate = calendarDateOf(businessDate);
  const isNotADate = calendarDate === null;
  if (isNotADate) {
    throw new CoreError("INVALID_FIELD", "business date must look like 2027-03-31");
  }
  const startYear =
    calendarDate.month >= APRIL_MONTH_NUMBER ? calendarDate.year : calendarDate.year - 1;
  return `${twoDigits(startYear)}-${twoDigits(startYear + 1)}`;
}
