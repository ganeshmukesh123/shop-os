import { CoreError, convertToBaseMilli, type BillLineInput } from "@shopos/core";
import type { Handle } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { ConversionRepository } from "../../repositories/FamilyRepository";

/** A bill line in the item's own unit, with what the cashier typed kept beside it (spec 002 T034). */
export interface IBaseLine extends Omit<BillLineInput, "enteredUom"> {
  /** The quantity in the base unit: what is billed and taken out of stock */
  quantityMilli: number;
  enteredUom: string | null;
  qtyEnteredMilli: number | null;
}

/**
 * Turn each line typed in an alternate unit into the base unit (2 rolls at 90 m = 180000 milli),
 * with core's exact conversion (INEXACT_CONVERSION otherwise). A unit the item has no
 * conversion for is UNKNOWN_UNIT. A line in the base unit, or with no unit, is unchanged.
 */
export function toBaseLines(
  handle: Handle,
  ctx: Ctx,
  lines: readonly BillLineInput[],
  baseUnitOf: (itemId: string) => string | undefined,
): IBaseLine[] {
  const conversions = new ConversionRepository(handle, ctx).listFor(
    lines.filter((line) => line.enteredUom).map((line) => line.itemId),
  );
  return lines.map((line) => {
    const isAlternate =
      line.enteredUom !== undefined && line.enteredUom !== baseUnitOf(line.itemId);
    if (!isAlternate) return { ...line, enteredUom: null, qtyEnteredMilli: null };
    const conversion = conversions.find(
      (candidate) => candidate.variantId === line.itemId && candidate.uomCode === line.enteredUom,
    );
    if (!conversion) {
      throw new CoreError("UNKNOWN_UNIT", `This item is not sold in ${line.enteredUom}`);
    }
    return {
      ...line,
      quantityMilli: convertToBaseMilli(line.quantityMilli, conversion.factorMilli),
      enteredUom: line.enteredUom!,
      qtyEnteredMilli: line.quantityMilli,
    };
  });
}
