import { CoreError } from "../errors";

const MILLI_PER_UNIT = 1000n;

/**
 * Turn a quantity typed in an alternate unit into the base unit, in thousandths (research D3).
 *
 * `factorMilli` says how many thousandths of the base unit one alternate unit holds: 1 roll of 90 m
 * is 90000. Base quantity = entered quantity x factor / 1000, and it must be a whole number of
 * thousandths, or the entry is refused. Example: 2 rolls (2000) at 90000 give 180000 (180 m).
 * The product is worked out exactly, so a large quantity is never rounded on the way.
 */
export function convertToBaseMilli(enteredMilli: number, factorMilli: number): number {
  if (!Number.isSafeInteger(enteredMilli) || enteredMilli <= 0) {
    throw new CoreError("INVALID_QUANTITY", "The quantity must be a whole number above zero");
  }
  if (!Number.isSafeInteger(factorMilli) || factorMilli <= 0) {
    throw new CoreError("INVALID_FIELD", "The unit conversion factor must be above zero");
  }
  const product = BigInt(enteredMilli) * BigInt(factorMilli);
  if (product % MILLI_PER_UNIT !== 0n) {
    throw new CoreError(
      "INEXACT_CONVERSION",
      "That quantity does not convert to a whole number of thousandths of the base unit",
    );
  }
  const baseMilli = product / MILLI_PER_UNIT;
  if (baseMilli > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new CoreError("INVALID_QUANTITY", "The converted quantity is too large");
  }
  return Number(baseMilli);
}
