import type { FamilyKind } from "../catalogue/variantDraft";
import { CoreError } from "../errors";

/** A variant of a paint product that could be the can a shade is mixed in. */
export interface ITintBase {
  variantId: string;
  kind: FamilyKind;
  axes: Record<string, string>;
}

/** One colorant and how much of it, in thousandths of a ml (0.25 ml = 250). */
export interface ITintFormulaLine {
  colorantVariantId: string;
  qtyMilli: number;
}

/** A version of a shade's formula for one base can; the current one is the highest version. */
export interface ITintFormula {
  id: string;
  shadeId: string;
  baseVariantId: string;
  version: number;
  lines: ITintFormulaLine[];
}

export interface ITintRequest {
  shadeId: string;
  baseType: string;
  packSize: string;
}

/**
 * The base can for the product's base type and pack size, and the shade's current formula for it
 * (spec 002 research D11, FR-014). Refuses NOT_FOUND, NOT_A_BASE and NO_FORMULA.
 */
export function resolveTintFormula(
  request: ITintRequest,
  bases: readonly ITintBase[],
  formulas: readonly ITintFormula[],
): { base: ITintBase; formula: ITintFormula } {
  const base = bases.find(
    (candidate) =>
      candidate.axes.base_type === request.baseType &&
      candidate.axes.pack_size === request.packSize,
  );
  if (!base) {
    throw new CoreError("NOT_FOUND", `No ${request.baseType} base in ${request.packSize}`);
  }
  if (base.kind !== "base_paint") {
    throw new CoreError("NOT_A_BASE", "This item is not a base paint, so it cannot be tinted");
  }
  const current = formulas
    .filter(
      (formula) => formula.shadeId === request.shadeId && formula.baseVariantId === base.variantId,
    )
    .reduce<ITintFormula | null>(
      (highest, formula) => (!highest || formula.version > highest.version ? formula : highest),
      null,
    );
  if (!current) {
    throw new CoreError(
      "NO_FORMULA",
      `No formula for this shade in ${request.baseType} ${request.packSize}`,
    );
  }
  return { base, formula: current };
}
