import {
  CoreError,
  resolveTintFormula,
  type ITintResolved,
  type TintResolveInput,
} from "@shopos/core";
import type { Handle } from "../../db/connection";
import type { Ctx } from "../../db/seed";
import { FamilyRepository } from "../../repositories/FamilyRepository";
import { TintRepository } from "../../repositories/TintRepository";
import { finalSurvivorOf } from "../barcode";
import { prepareTintedLine } from "../BillingService/tintedLines";

/**
 * tint.resolve (spec 002 T060, FR-014): the base can for the chosen pack, the shade's current
 * formula, the colorant amounts with their stock, and the price and cost of one can.
 */
/** The shade's current formula for the chosen pack of the product (NOT_FOUND, NO_FORMULA...). */
function formulaFor(families: FamilyRepository, tints: TintRepository, input: TintResolveInput) {
  const family = families.getFamily(input.productFamilyId);
  const variants = family ? families.listVariants(family.id) : [];
  const pack = variants.find((variant) => variant.id === input.packVariantId);
  if (!family || !pack) throw new CoreError("NOT_FOUND", "This paint is not here any more");
  const bases = variants.map((variant) => ({
    variantId: variant.id,
    kind: family.kind,
    axes: variant.axes,
  }));
  return resolveTintFormula(
    {
      shadeId: input.shadeId,
      baseType: pack.axes.base_type ?? "",
      packSize: pack.axes.pack_size ?? "",
    },
    bases,
    tints.formulasFor(
      input.shadeId,
      variants.map(({ id }) => id),
    ),
  ).formula;
}

/**
 * tint.resolve (spec 002 T060, FR-014): the base can for the chosen pack, the shade's current
 * formula, the colorant amounts with their stock, and the price and cost of one can.
 */
export function resolveTint(handle: Handle, ctx: Ctx, input: TintResolveInput): ITintResolved {
  const families = new FamilyRepository(handle, ctx);
  const formula = formulaFor(families, new TintRepository(handle, ctx), input);
  const tinted = prepareTintedLine(handle, ctx, {
    itemId: formula.baseVariantId,
    tint: { formulaId: formula.id },
  })!;
  const stockOf = (colorantId: string) =>
    families.getVariant(finalSurvivorOf(families, colorantId))?.stockMilli ?? 0;
  return {
    baseVariant: families.getVariant(formula.baseVariantId)!,
    formula,
    lines: tinted.colorants.map((colorant) => ({
      colorantVariantId: colorant.colorantVariantId,
      name: colorant.colorantNameSnapshot,
      qtyMilli: colorant.qtyMilli,
      stockMilli: stockOf(colorant.colorantVariantId),
    })),
    unitPricePaise: tinted.unitPricePaise,
    chargePaise: tinted.chargePaise,
    costPaise: tinted.costPaise,
  };
}
