import { CoreError } from "./errors";
import { computeBill, computeLine, discountFromPercent, type LineInput } from "./billing";
import { mulQtyRate, parseRupees } from "./money";
import { isValidQuantity, parseQuantity } from "./quantity";
import { convertToBaseMilli } from "./units/unitConversion";

/** What the New bill screen holds while typing: raw strings, so half-typed numbers are fine. */
export interface DraftLine {
  key: string;
  itemId: string;
  name: string;
  unit: string;
  allowsDecimal: boolean;
  qty: string;
  rate: string;
  disc: string;
  discMode: "rupees" | "percent";
  /** Spec 002 T039: the item's family (to read its other units), those units, and the one `qty`
   * is typed in (null = its own unit). `conversions` stays undefined until they are read. */
  familyId?: string;
  conversions?: { uomCode: string; factorMilli: number }[];
  enteredUom?: string | null;
}

export interface DraftBill {
  lines: DraftLine[];
  billDisc: string;
  billDiscMode: "rupees" | "percent";
}

export interface DraftLineResult {
  amountPaise: number | null;
  error: string | null;
  /** The quantity in the item's own unit, for "2 roll (180 m)"; present when the line is valid */
  baseQtyMilli?: number;
}

/** A wire line: always in the base unit; with the typed unit and quantity when one was chosen. */
export type DraftInputLine = LineInput & {
  itemId: string;
  enteredUom?: string;
  qtyEnteredMilli?: number;
};

export interface DraftEvaluation {
  lines: DraftLineResult[];
  linesTotalPaise: number;
  billDiscountPaise: number;
  grandTotalPaise: number;
  errors: string[];
  valid: boolean;
  /** Wire-format lines, present only when the whole bill is valid. */
  input: DraftInputLine[] | null;
}

/** "12.5" -> 1250 basis points. Max 100%, up to two decimals. */
export function parsePercentBp(percentText: string): number | null {
  const trimmedText = percentText.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmedText)) return null;
  const [wholeText, fractionText = ""] = trimmedText.split(".");
  const bp = Number(wholeText) * 100 + Number(fractionText.padEnd(2, "0"));
  return bp <= 10000 ? bp : null;
}

function lineDiscount(
  draftLine: DraftLine,
  grossPaise: number,
): { paise: number } | { error: string } {
  if (draftLine.disc.trim() === "") return { paise: 0 };
  if (draftLine.discMode === "percent") {
    const bp = parsePercentBp(draftLine.disc);
    return bp === null
      ? { error: "Discount % must be 0 to 100" }
      : { paise: discountFromPercent(grossPaise, bp) };
  }
  const discountPaise = parseRupees(draftLine.disc);
  if (discountPaise === null) return { error: "Enter the discount in rupees" };
  if (discountPaise > grossPaise) return { error: "Discount cannot be more than the line amount" };
  return { paise: discountPaise };
}

/**
 * The typed quantity in the item's own unit: unchanged for the base unit, else converted exactly
 * with the chosen unit's factor (spec 002 T039; the main process converts again when saving).
 */
function baseQuantity(draftLine: DraftLine, enteredMilli: number): number | string {
  const chosen = draftLine.enteredUom;
  if (!chosen || chosen === draftLine.unit) return enteredMilli;
  const conversion = draftLine.conversions?.find((candidate) => candidate.uomCode === chosen);
  if (!conversion) return `This item is not sold in ${chosen}`;
  try {
    return convertToBaseMilli(enteredMilli, conversion.factorMilli);
  } catch (caughtError) {
    return caughtError instanceof CoreError ? caughtError.message : "Invalid quantity";
  }
}

/** The typed unit and quantity to send with the line, when it is not the item's own unit. */
function enteredFields(draftLine: DraftLine, enteredMilli: number) {
  const chosen = draftLine.enteredUom;
  const isAlternate = Boolean(chosen) && chosen !== draftLine.unit;
  return isAlternate ? { enteredUom: chosen!, qtyEnteredMilli: enteredMilli } : {};
}

/** Evaluate a draft with the same core rules used when saving. Never throws. */
export function evaluateDraft(draftBill: DraftBill): DraftEvaluation {
  const errors: string[] = [];
  const inputs: DraftInputLine[] = [];
  let allLinesOk = true;

  const lines: DraftLineResult[] = draftBill.lines.map((draftLine) => {
    const enteredMilli = parseQuantity(draftLine.qty);
    if (enteredMilli === null || enteredMilli <= 0) return fail("Quantity must be more than 0");
    const converted = baseQuantity(draftLine, enteredMilli);
    if (typeof converted === "string") return fail(converted);
    const quantityMilli = converted;
    if (!isValidQuantity(quantityMilli, draftLine.allowsDecimal))
      return fail("This unit accepts whole numbers only");
    const rate = parseRupees(draftLine.rate);
    if (rate === null) return fail("Enter the rate in rupees");
    try {
      // Inside the try: an amount too large to hold exactly must become a line error, never a throw.
      const gross = mulQtyRate(quantityMilli, rate);
      const disc = lineDiscount(draftLine, gross);
      if ("error" in disc) return fail(disc.error);
      const amount = computeLine({
        quantityMilli: quantityMilli,
        ratePaise: rate,
        lineDiscountPaise: disc.paise,
      });
      inputs.push({
        itemId: draftLine.itemId,
        quantityMilli: quantityMilli,
        ratePaise: rate,
        lineDiscountPaise: disc.paise,
        ...enteredFields(draftLine, enteredMilli),
      });
      return { amountPaise: amount, error: null, baseQtyMilli: quantityMilli };
    } catch (caughtError) {
      return fail(caughtError instanceof CoreError ? caughtError.message : "Invalid line");
    }
  });

  function fail(error: string): DraftLineResult {
    allLinesOk = false;
    return { amountPaise: null, error };
  }

  const linesTotalPaise = lines.reduce(
    (runningTotalPaise, lineResult) => runningTotalPaise + (lineResult.amountPaise ?? 0),
    0,
  );
  let billDiscountPaise = 0;
  if (draftBill.billDisc.trim() !== "") {
    if (draftBill.billDiscMode === "percent") {
      const bp = parsePercentBp(draftBill.billDisc);
      if (bp === null) errors.push("Bill discount % must be 0 to 100");
      else billDiscountPaise = discountFromPercent(linesTotalPaise, bp);
    } else {
      const enteredBillDiscountPaise = parseRupees(draftBill.billDisc);
      if (enteredBillDiscountPaise === null) errors.push("Enter the bill discount in rupees");
      else if (enteredBillDiscountPaise > linesTotalPaise)
        errors.push("Bill discount cannot be more than the total");
      else billDiscountPaise = enteredBillDiscountPaise;
    }
  }
  if (draftBill.lines.length === 0) errors.push("Add at least one item");
  if (!allLinesOk) errors.push("Fix the highlighted lines");

  const valid = errors.length === 0;
  if (valid) computeBill({ lines: inputs, billDiscountPaise }); // final cross-check against the saving rules
  return {
    lines,
    linesTotalPaise,
    billDiscountPaise,
    grandTotalPaise: linesTotalPaise - billDiscountPaise,
    errors,
    valid,
    input: valid ? inputs : null,
  };
}
