import type { ITintFormula, ITintRepeat, TintRepeatListInput } from "@shopos/core";
import type { Handle } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { BillTintRepository } from "../../repositories/BillTintRepository";
import { FamilyRepository } from "../../repositories/FamilyRepository";
import { TintRepository } from "../../repositories/TintRepository";
import { finalSurvivorOf } from "../barcode";

/** The highest version of each base can's formula for a shade. */
const currentByBase = (formulas: readonly ITintFormula[]) =>
  formulas.filter(
    (formula) =>
      !formulas.some(
        (other) => other.baseVariantId === formula.baseVariantId && other.version > formula.version,
      ),
  );

/** Billed tinted lines of the customer, newest first, one per shade and base can. */
function billedRepeats(handle: Handle, ctx: Ctx, customerName: string): ITintRepeat[] {
  const families = new FamilyRepository(handle, ctx);
  const tints = new TintRepository(handle, ctx);
  const billTints = new BillTintRepository(handle, ctx);
  const repeats = billTints.tintedLinesFor(customerName).flatMap((line): ITintRepeat[] => {
    const formula = tints.getFormula(line.formulaId!);
    const shade = formula ? tints.getShade(formula.shadeId) : null;
    const source = billTints.sourceLine(line.billLineId);
    const baseVariant = families.getVariant(finalSurvivorOf(families, line.variantId));
    if (!formula || !shade || !source || !baseVariant) return [];
    const lines = source.colorants.map((colorant) => ({
      colorantVariantId: colorant.colorantVariantId,
      qtyMilli: colorant.qtyMilli,
      name: colorant.colorantNameSnapshot,
    }));
    return [
      {
        shade,
        formula,
        lastBilledAt: line.billedAt,
        baseVariant,
        sourceBillLineId: line.billLineId,
        lines,
      },
    ];
  });
  return repeats.filter(
    (repeat, repeatIndex) =>
      repeats.findIndex(
        (other) =>
          other.shade.id === repeat.shade.id && other.baseVariant.id === repeat.baseVariant.id,
      ) === repeatIndex,
  );
}

/**
 * tint.repeat.list (spec 002 T058, FR-016): the shades a customer or site had, newest first. A
 * billed shade repeats its saved line; a custom shade never billed uses its current formula.
 */
export function repeatList(handle: Handle, ctx: Ctx, input: TintRepeatListInput): ITintRepeat[] {
  const customerName = input.customerName?.trim() ?? "";
  const siteLabel = input.siteLabel?.trim() ?? "";
  if (customerName === "" && siteLabel === "") return [];
  const billed = customerName === "" ? [] : billedRepeats(handle, ctx, customerName);
  const families = new FamilyRepository(handle, ctx);
  const tints = new TintRepository(handle, ctx);
  const unbilled = tints
    .customShadesFor(customerName || undefined, siteLabel || undefined)
    .filter((shade) => !billed.some((repeat) => repeat.shade.id === shade.id))
    .flatMap((shade) =>
      currentByBase(tints.formulasForShade(shade.id)).flatMap((formula): ITintRepeat[] => {
        const baseVariant = families.getVariant(finalSurvivorOf(families, formula.baseVariantId));
        const lines = formula.lines.map((line) => ({
          ...line,
          name: families.getVariant(line.colorantVariantId)?.displayName ?? "",
        }));
        return baseVariant ? [{ shade, formula, lastBilledAt: null, baseVariant, lines }] : [];
      }),
    );
  return [...billed, ...unbilled];
}
