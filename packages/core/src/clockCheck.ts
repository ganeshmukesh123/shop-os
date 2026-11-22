/** Things the app should tell the shop about, without ever stopping it from billing (constitution IV). */
export type ClockWarning = "TIME_ZONE_DIFFERS" | "CLOCK_BEFORE_LAST_BILL";

export interface IClockCheckInput {
  /** The time zone the computer reports for itself, for example Asia/Kolkata. */
  deviceTimeZone: string;
  /** The shop's named zone from its settings. */
  shopTimeZone: string;
  nowMs: number;
  /** When the newest saved bill was made, or null when there is none yet. */
  lastBilledAtMs: number | null;
}

const OFFSET_LABEL_PATTERN = /^GMT(?:([+-])(\d{2}):(\d{2}))?$/;
const MINUTES_PER_HOUR = 60;

/** Minutes the zone's clock is ahead of UTC at an instant, or null when the platform does not know the zone. */
function utcOffsetMinutes(timeZone: string, instantMs: number): number | null {
  try {
    const offsetPart = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(new Date(instantMs))
      .find((datePart) => datePart.type === "timeZoneName");
    const offsetMatch = OFFSET_LABEL_PATTERN.exec(offsetPart?.value ?? "");
    if (!offsetMatch) return null;
    const [, sign, hours, minutes] = offsetMatch;
    const absoluteMinutes = Number(hours ?? 0) * MINUTES_PER_HOUR + Number(minutes ?? 0);
    return sign === "-" ? -absoluteMinutes : absoluteMinutes;
  } catch {
    return null;
  }
}

/**
 * Two zones count as the same when their clocks agree right now, so the old and new names of one
 * zone (Asia/Calcutta, Asia/Kolkata) do not raise a warning. An unknown device zone gives no warning:
 * the check cannot tell.
 */
function isDeviceZoneDifferent(input: IClockCheckInput): boolean {
  const deviceOffset = utcOffsetMinutes(input.deviceTimeZone, input.nowMs);
  const shopOffset = utcOffsetMinutes(input.shopTimeZone, input.nowMs);
  return deviceOffset !== null && shopOffset !== null && deviceOffset !== shopOffset;
}

/** Warnings for the shop owner: the device zone is not the shop's zone, or the clock went back. */
export function findClockWarnings(input: IClockCheckInput): ClockWarning[] {
  const warnings: ClockWarning[] = [];
  if (isDeviceZoneDifferent(input)) warnings.push("TIME_ZONE_DIFFERS");
  const isClockBehindLastBill = input.lastBilledAtMs !== null && input.nowMs < input.lastBilledAtMs;
  if (isClockBehindLastBill) warnings.push("CLOCK_BEFORE_LAST_BILL");
  return warnings;
}
