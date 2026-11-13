import { CoreError } from "./errors";

export const UNITS = ["pcs", "metre", "kg", "litre", "box"] as const;
const DECIMAL_UNITS = new Set(["metre", "kg", "litre"]);

export function defaultAllowsDecimal(unit: string): boolean {
  return DECIMAL_UNITS.has(unit.trim().toLowerCase());
}

/** Quantity is integer thousandths of the unit. */
export function isValidQuantity(quantityMilli: number, allowsDecimal: boolean): boolean {
  if (!Number.isSafeInteger(quantityMilli)) return false;
  return allowsDecimal ? true : quantityMilli % 1000 === 0;
}

export function assertQuantity(quantityMilli: number, allowsDecimal: boolean): void {
  if (!isValidQuantity(quantityMilli, allowsDecimal)) {
    throw new CoreError(
      "INVALID_QUANTITY",
      allowsDecimal
        ? "quantity must be a whole number of thousandths"
        : "this unit accepts whole numbers only",
    );
  }
}

/** Parse "2.5" to 2500. Max 3 decimals, non-negative. */
export function parseQuantity(input: string): number | null {
  const trimmedInput = input.trim();
  if (!/^\d+(\.\d{1,3})?$/.test(trimmedInput)) return null;
  const [wholeText, fractionText = ""] = trimmedInput.split(".");
  const totalMilli = Number(wholeText) * 1000 + Number(fractionText.padEnd(3, "0"));
  return Number.isSafeInteger(totalMilli) ? totalMilli : null;
}

/** 2500 -> "2.5", 2000 -> "2", 1 -> "0.001". */
export function formatQuantity(quantityMilli: number): string {
  const neg = quantityMilli < 0;
  const abs = Math.abs(quantityMilli);
  const whole = Math.floor(abs / 1000);
  const frac = String(abs % 1000)
    .padStart(3, "0")
    .replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}
