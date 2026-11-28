import { CoreError, type FamilyKind, type ITintFormulaLine } from "@shopos/core";
import type { FamilyRepository } from "../../repositories/FamilyRepository";

/** The kind of the variant's family, or NOT_FOUND. */
function kindOf(families: FamilyRepository, variantId: string): FamilyKind {
  const variant = families.getVariant(variantId);
  const family = variant ? families.getFamily(variant.familyId) : null;
  if (!family) throw new CoreError("NOT_FOUND", "This item is not here any more");
  return family.kind;
}

/** A formula is mixed in a base paint, from colorants only (research D11). */
export function requireTintable(
  families: FamilyRepository,
  baseVariantId: string,
  lines: readonly ITintFormulaLine[],
): void {
  if (kindOf(families, baseVariantId) !== "base_paint") {
    throw new CoreError("NOT_A_BASE", "This item is not a base paint, so it cannot be tinted");
  }
  const notColorant = lines.find((line) => kindOf(families, line.colorantVariantId) !== "colorant");
  if (notColorant) {
    throw new CoreError("NOT_A_COLORANT", "Only colorants can go into a formula");
  }
}

/** FR-016: a custom shade says whose it is or which site it is for. */
export function customShadeLabels(customerLabel?: string, siteLabel?: string) {
  const customer = customerLabel?.trim() || null;
  const site = siteLabel?.trim() || null;
  if (!customer && !site) {
    throw new CoreError(
      "LABEL_REQUIRED",
      "Give the customer's name or the site for a custom shade",
    );
  }
  return { customerLabel: customer, siteLabel: site };
}
