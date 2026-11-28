import { CoreError } from "./errors";

/** Money is integer paise. No floating point anywhere. */
export type Paise = number;

export function assertPaise(amountPaise: number, label = "amount"): Paise {
  if (!Number.isSafeInteger(amountPaise)) {
    throw new CoreError("INVALID_AMOUNT", `${label} must be an integer number of paise`);
  }
  return amountPaise;
}

export function addPaise(firstPaise: Paise, secondPaise: Paise): Paise {
  return assertPaise(assertPaise(firstPaise) + assertPaise(secondPaise));
}

export function subPaise(firstPaise: Paise, secondPaise: Paise): Paise {
  return assertPaise(assertPaise(firstPaise) - assertPaise(secondPaise));
}

/** Divide a bigint by a positive bigint, rounding half up (values are non-negative). */
function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/** Percent given in basis points (12.5% = 1250). Rounds to nearest paisa, half up. */
export function percentOfPaise(paise: Paise, percentBp: number): Paise {
  assertPaise(paise);
  if (!Number.isSafeInteger(percentBp) || percentBp < 0) {
    throw new CoreError(
      "INVALID_DISCOUNT",
      "percent must be a non-negative integer in basis points",
    );
  }
  return Number(divRoundHalfUp(BigInt(paise) * BigInt(percentBp), 10000n));
}

/** quantity (thousandths) x rate (paise) -> paise, rounded half up. */
export function mulQtyRate(quantityMilli: number, ratePaise: Paise): Paise {
  if (!Number.isSafeInteger(quantityMilli) || quantityMilli < 0) {
    throw new CoreError(
      "INVALID_QUANTITY",
      "quantity must be a non-negative integer (thousandths)",
    );
  }
  assertPaise(ratePaise);
  if (ratePaise < 0) throw new CoreError("INVALID_AMOUNT", "rate cannot be negative");
  const roundedPaise = divRoundHalfUp(BigInt(quantityMilli) * BigInt(ratePaise), 1000n);
  if (roundedPaise > BigInt(Number.MAX_SAFE_INTEGER))
    throw new CoreError("INVALID_AMOUNT", "amount too large");
  return Number(roundedPaise);
}

/**
 * The sum of several quantity x rate amounts, rounded half up once at the end (a tinted can's
 * colorants: 0.25 ml x ₹0.02 twice is 1 paisa, not 2). Each part is checked as in mulQtyRate.
 */
export function sumQtyRatesRounded(
  parts: readonly { quantityMilli: number; ratePaise: Paise }[],
): Paise {
  const exactMilliPaise = parts.reduce((total, { quantityMilli, ratePaise }) => {
    mulQtyRate(quantityMilli, ratePaise);
    return total + BigInt(quantityMilli) * BigInt(ratePaise);
  }, 0n);
  const roundedPaise = divRoundHalfUp(exactMilliPaise, 1000n);
  if (roundedPaise > BigInt(Number.MAX_SAFE_INTEGER))
    throw new CoreError("INVALID_AMOUNT", "amount too large");
  return Number(roundedPaise);
}

const PAISE_PER_RUPEE = 100;
const HALF_RUPEE_PAISE = 50;

export interface IRoundedBillTotal {
  /** Signed difference added to the total: +40 for 849.60, -49 for 849.49, 0 when off. */
  roundOffPaise: Paise;
  roundedTotalPaise: Paise;
}

/**
 * Round a bill total to the nearest rupee, 50 paise and above up (FR-010a).
 * Lines keep exact paise; only the grand total is rounded, and the difference is kept apart.
 */
export function roundBillTotal(totalPaise: Paise, isRoundingOn: boolean): IRoundedBillTotal {
  assertPaise(totalPaise, "total");
  if (totalPaise < 0) throw new CoreError("INVALID_AMOUNT", "total cannot be negative");
  const leftoverPaise = totalPaise % PAISE_PER_RUPEE;
  const roundsUp = leftoverPaise >= HALF_RUPEE_PAISE;
  const roundOffPaise = roundsUp ? PAISE_PER_RUPEE - leftoverPaise : 0 - leftoverPaise;
  return isRoundingOn
    ? { roundOffPaise, roundedTotalPaise: assertPaise(totalPaise + roundOffPaise, "rounded total") }
    : { roundOffPaise: 0, roundedTotalPaise: totalPaise };
}

function groupIndian(intPart: string): string {
  if (intPart.length <= 3) return intPart;
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  return rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
}

/** Format paise as rupees with Indian grouping, e.g. ₹1,00,000.00 */
export function formatRupees(paise: Paise): string {
  assertPaise(paise);
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const paiseText = String(abs % 100).padStart(2, "0");
  return `${neg ? "-" : ""}₹${groupIndian(String(rupees))}.${paiseText}`;
}

/** A signed amount for the round-off line: 40 -> "+₹0.40", -49 -> "-₹0.49", 0 -> "₹0.00". */
export function formatSignedRupees(paise: Paise): string {
  const sign = paise > 0 ? "+" : "";
  return `${sign}${formatRupees(paise)}`;
}

/** Plain number string for form fields, e.g. 123450 -> "1234.50". */
export function paiseToInput(paise: Paise): string {
  assertPaise(paise);
  return `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, "0")}`;
}

/** Parse a rupee string ("1,234.50") to paise; null when invalid. Max 2 decimals. */
export function parseRupees(input: string): Paise | null {
  const cleanedInput = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleanedInput)) return null;
  const [rupeesText, paiseDigits = ""] = cleanedInput.split(".");
  const totalPaise = Number(rupeesText) * 100 + Number(paiseDigits.padEnd(2, "0"));
  return Number.isSafeInteger(totalPaise) ? totalPaise : null;
}
