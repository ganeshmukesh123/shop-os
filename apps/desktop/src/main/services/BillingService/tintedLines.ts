import {
  CoreError,
  mulQtyRate,
  tintChargeFor,
  tintCostPaise,
  tintLinePrice,
  type BillLineInput,
  type IVariant,
} from "@shopos/core";
import type { Handle } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { BillTintRepository, type ISavedColorant } from "../../repositories/BillTintRepository";
import { FamilyRepository } from "../../repositories/FamilyRepository";
import { TintRepository } from "../../repositories/TintRepository";
import { finalSurvivorOf } from "../barcode";

/** What a tinted line saves besides the line itself (contracts "Bills (changed)"). */
export interface ITintedLine {
  formulaId: string;
  chargePaise: number;
  /** Null when the base's purchase price is not known */
  costPaise: number | null;
  colorants: ISavedColorant[];
}

type ITintRef = NonNullable<BillLineInput["tint"]>;
type IColorantAmount = { colorantVariantId: string; qtyMilli: number };

/** The formula and colorant amounts per can: the current formula, or a billed line's snapshot. */
function formulaAndAmounts(handle: Handle, ctx: Ctx, itemId: string, tint: ITintRef) {
  const families = new FamilyRepository(handle, ctx);
  const tints = new TintRepository(handle, ctx);
  if ("sourceBillLineId" in tint) {
    const source = new BillTintRepository(handle, ctx).sourceLine(tint.sourceBillLineId);
    if (!source)
      throw new CoreError("INVALID_TINT_REPEAT_SOURCE", "That earlier tinted line is not here");
    const formula = tints.getFormula(source.formulaId)!;
    if (finalSurvivorOf(families, source.variantId) !== itemId) throw baseMismatch();
    return { formula, amounts: source.colorants as IColorantAmount[] };
  }
  const formula = tints.getFormula(tint.formulaId);
  if (!formula) throw new CoreError("NOT_FOUND", "This formula is not here any more");
  if (finalSurvivorOf(families, formula.baseVariantId) !== itemId) throw baseMismatch();
  if (tints.highestVersion(formula.shadeId, formula.baseVariantId) !== formula.version) {
    throw new CoreError(
      "FORMULA_NOT_CURRENT",
      "This shade's formula has changed. Choose the shade again",
    );
  }
  return { formula, amounts: formula.lines as IColorantAmount[] };
}

const baseMismatch = () =>
  new CoreError("FORMULA_BASE_MISMATCH", "This formula is for a different base can");

/** The shade price wins; otherwise the tint charge for the can's declared size (FR-015). */
function chargeFor(handle: Handle, ctx: Ctx, base: IVariant, shadeId: string): number {
  const tints = new TintRepository(handle, ctx);
  const rules = tints
    .listCharges()
    .filter((rule) => rule.declaredUom === base.declaredUom)
    .map((rule) => ({ packQtyMilli: rule.declaredQtyMilli, chargePaise: rule.chargePaise }));
  return tintLinePrice({
    basePricePaise: base.sellingPricePaise,
    shadePricePaise: tints.shadePrice(shadeId, base.id),
    tintChargePaise: tintChargeFor(base.declaredQtyMilli ?? 0, rules),
  }).tintChargePaise;
}

/** Check and price one tinted line before anything is written; null for an ordinary line. */
export function prepareTintedLine(
  handle: Handle,
  ctx: Ctx,
  line: Pick<BillLineInput, "itemId" | "tint">,
): ITintedLine | null {
  if (!line.tint) return null;
  const families = new FamilyRepository(handle, ctx);
  const base = families.getVariant(line.itemId)!;
  const { formula, amounts } = formulaAndAmounts(handle, ctx, line.itemId, line.tint);
  const pricePerMl = (colorantVariantId: string) =>
    families.getVariant(colorantVariantId)?.purchasePricePaise ?? 0;
  const colorants: ISavedColorant[] = amounts.map(({ colorantVariantId, qtyMilli }) => ({
    colorantVariantId,
    colorantNameSnapshot: families.getVariant(colorantVariantId)?.displayName ?? "",
    qtyMilli,
    costPaise: mulQtyRate(qtyMilli, pricePerMl(colorantVariantId)),
  }));
  const colorantCosts = amounts.map(({ colorantVariantId, qtyMilli }) => ({
    pricePerMlPaise: pricePerMl(colorantVariantId),
    qtyMilli,
  }));
  const costPaise =
    base.purchasePricePaise === null
      ? null
      : tintCostPaise({ basePurchasePaise: base.purchasePricePaise, colorants: colorantCosts });
  return {
    formulaId: formula.id,
    chargePaise: chargeFor(handle, ctx, base, formula.shadeId),
    costPaise,
    colorants,
  };
}

/** A tinted line's own columns; an ordinary line keeps the defaults. */
export const tintColumns = (tintedLine: ITintedLine | null | undefined) =>
  tintedLine
    ? {
        tintFormulaId: tintedLine.formulaId,
        tintChargePaise: tintedLine.chargePaise,
        costPaise: tintedLine.costPaise,
        isReturnable: false,
      }
    : {};

/** Run a write for a tinted line; an ordinary line writes nothing more. */
export const tintedOf = (
  tintedLine: ITintedLine | null | undefined,
  write: (tintedLine: ITintedLine) => string[],
): string[] => (tintedLine ? write(tintedLine) : []);
