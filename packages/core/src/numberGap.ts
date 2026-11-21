import { CoreError } from "./errors";
import { SEQ_WIDTH } from "./numbering";

/** The reason stored on a recorded gap: bills that were printed but are not in the restored database. */
export const GAP_REASON_LOST_IN_RESTORE = "lost_in_restore";

/** How far the counter jumps when the owner cannot say which bill was the last one issued (research D21). */
export const UNCONFIRMED_GAP_SIZE = 100;

const MAX_SEQ = 10 ** SEQ_WIDTH - 1;
const TOKEN_PATTERN = /(\{series\}|\{fy\}|\{seq\})/;
// A Map, not an object: literal text such as "toString" must never find an inherited property.
const GROUP_PATTERN_BY_TOKEN = new Map<string, string>([
  ["{series}", "(?<series>.+?)"],
  ["{fy}", "(?<fy>\\d{2}-\\d{2})"],
  ["{seq}", `(?<seq>\\d{${SEQ_WIDTH}})`],
]);

export interface IParsedBillNumber {
  /** null when the shop's number format has no series part. */
  seriesCode: string | null;
  /** null when the shop's number format has no financial-year part. */
  financialYear: string | null;
  seq: number;
}

function escapeRegex(literalText: string): string {
  return literalText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Read a bill number the owner typed back into its parts, using the shop's number format.
 * Example: format "{series}/{fy}/{seq}" and "C1/26-27/000126" give series C1, year 26-27, sequence 126.
 * Gives null when the text does not follow the format, or has sequence 0.
 */
export function parseBillNumber(template: string, text: string): IParsedBillNumber | null {
  try {
    return readMatch(new RegExp(`^${patternOf(template)}$`).exec(text.trim()));
  } catch {
    return null; // a template that names a part twice cannot be read back
  }
}

function patternOf(template: string): string {
  return template
    .split(TOKEN_PATTERN)
    .map((part) => GROUP_PATTERN_BY_TOKEN.get(part) ?? escapeRegex(part))
    .join("");
}

function readMatch(match: RegExpExecArray | null): IParsedBillNumber | null {
  const seq = Number(match?.groups?.seq);
  if (!match || !Number.isSafeInteger(seq) || seq < 1) return null;
  return {
    seriesCode: match.groups?.series ?? null,
    financialYear: match.groups?.fy ?? null,
    seq,
  };
}

export interface INumberGapPlan {
  /** First number that was lost (or skipped), inclusive. */
  seqFrom: number;
  /** Last number that was lost (or skipped), inclusive. */
  seqTo: number;
  /** The counter's value after the restore: the next bill is this plus one. */
  newLastSeq: number;
  /** True when the owner could not say, so the block of 100 is a guess. */
  isEstimated: boolean;
}

function assertWholeNumber(value: number, label: string, smallest: number): void {
  if (!Number.isSafeInteger(value) || value < smallest) {
    throw new CoreError("INVALID_FIELD", `${label} must be a whole number of ${smallest} or more`);
  }
}

/**
 * After a restore the counter must never issue a number that was already issued (FR-013b, EC-19).
 * `restoredLastSeq` is the last number the backup had; `lastIssuedSeq` is the last number the owner
 * says was really issued, or null when they cannot say.
 * Example: backup ended at 120, owner confirms 126: numbers 121 to 126 are recorded as lost and the
 * next bill is 127. Gives null when nothing was lost.
 */
export function planNumberGap(
  restoredLastSeq: number,
  lastIssuedSeq: number | null,
): INumberGapPlan | null {
  assertWholeNumber(restoredLastSeq, "The backup's last number", 0);
  const isEstimated = lastIssuedSeq === null;
  const newLastSeq = isEstimated ? restoredLastSeq + UNCONFIRMED_GAP_SIZE : lastIssuedSeq;
  assertWholeNumber(newLastSeq, "The last bill number", 1);
  if (newLastSeq > MAX_SEQ) {
    throw new CoreError(
      "INVALID_FIELD",
      "That would pass the largest bill number this format holds",
    );
  }
  if (newLastSeq < restoredLastSeq) {
    throw new CoreError(
      "INVALID_FIELD",
      "That number is older than the last number in this backup; enter the last bill you printed",
    );
  }
  if (newLastSeq === restoredLastSeq) return null;
  return { seqFrom: restoredLastSeq + 1, seqTo: newLastSeq, newLastSeq, isEstimated };
}
