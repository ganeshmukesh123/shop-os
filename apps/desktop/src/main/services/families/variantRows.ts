import {
  CoreError,
  MAX_COMBINATIONS,
  assertQuantity,
  buildAxisSignature,
  cleanAxisValue,
  renderTitle,
  validateVariantDraft,
  type FamilyKind,
  type NewVariantInput,
} from "@shopos/core";
import type { NewVariantRow } from "../../repositories/FamilyRepository";

/** What naming a variant needs from its family: the template it inherits and the brand. */
export interface IVariantNaming {
  familyName: string;
  brandName: string | null;
  titleTemplate: string | null;
}

export interface IFamilyShape {
  kind: FamilyKind;
  axisKeys: readonly string[];
}

/** The name a variant gets unless the owner typed one: the template, else family + axis values. */
export function variantName(naming: IVariantNaming, axes: Record<string, string>): string {
  const fromTemplate = naming.titleTemplate
    ? renderTitle(naming.titleTemplate, {
        ...axes,
        brand: axes.brand ?? naming.brandName ?? undefined,
      })
    : "";
  return fromTemplate || [naming.familyName, ...Object.values(axes)].join(" ");
}

/** The variant's axes, trimmed, keyed exactly by the family's axes (INVALID_FIELD otherwise). */
function cleanAxes(family: IFamilyShape, axes: Record<string, string>): Record<string, string> {
  const givenKeys = Object.keys(axes).sort();
  const familyKeys = [...family.axisKeys].sort();
  if (givenKeys.join() !== familyKeys.join()) {
    throw new CoreError(
      "INVALID_FIELD",
      `A variant needs a value for each of: ${familyKeys.join(", ")}`,
    );
  }
  return Object.fromEntries(family.axisKeys.map((key) => [key, cleanAxisValue(key, axes[key]!)]));
}

/** One variant, checked (FR-009, FR-010) and turned into the row to insert. */
function toVariantRow(
  family: IFamilyShape,
  naming: IVariantNaming,
  variant: NewVariantInput,
): NewVariantRow {
  const axes = cleanAxes(family, variant.axes);
  assertQuantity(variant.openingQtyMilli, variant.allowDecimal);
  return {
    axes: JSON.stringify(axes),
    axisSignature: buildAxisSignature(axes),
    displayName: variant.displayName?.trim() || variantName(naming, axes),
    baseUom: variant.baseUom,
    allowDecimal: variant.allowDecimal ? 1 : 0,
    sellingPricePaise: variant.sellingPricePaise,
    sealedPackOnly: variant.sealedPackOnly ? 1 : 0,
    isSerialTracked: variant.isSerialTracked ? 1 : 0,
    ...optionalFields(family, variant),
  };
}

/** The fields a variant may leave empty, after the draft rules (paint fields, limits). */
function optionalFields(family: IFamilyShape, variant: NewVariantInput) {
  const draft = validateVariantDraft({ ...variant, familyKind: family.kind });
  const orNull = <TValue>(value: TValue | null | undefined): TValue | null => value ?? null;
  return {
    purchasePricePaise: orNull(variant.purchasePricePaise),
    reorderLevelMilli: orNull(variant.reorderLevelMilli),
    locationTag: orNull(draft.locationTag),
    petroleumClass: orNull(draft.petroleumClass),
    declaredQtyMilli: orNull(draft.declaredQtyMilli),
    declaredUom: orNull(draft.declaredUom),
    tradeLabel: orNull(draft.tradeLabel),
    warrantyMonths: orNull(draft.warrantyMonths),
  };
}

/**
 * Check every new variant and refuse the lot if any fails: more than 500 at once
 * (TOO_MANY_COMBINATIONS), two with the same axis values, or one whose values a variant already
 * in the family has (DUPLICATE_SIGNATURE).
 */
export function toVariantRows(
  family: IFamilyShape,
  naming: IVariantNaming,
  variants: readonly NewVariantInput[],
  existingSignatures: readonly string[] = [],
): NewVariantRow[] {
  if (variants.length > MAX_COMBINATIONS) {
    throw new CoreError(
      "TOO_MANY_COMBINATIONS",
      `That is ${variants.length} variants; one step makes at most ${MAX_COMBINATIONS}`,
    );
  }
  const rows = variants.map((variant) => toVariantRow(family, naming, variant));
  const signatures = [
    ...existingSignatures,
    ...rows.map((variantRow) => variantRow.axisSignature!),
  ];
  const repeated = signatures.find((signature, index) => signatures.indexOf(signature) !== index);
  if (repeated !== undefined) {
    throw new CoreError(
      "DUPLICATE_SIGNATURE",
      `Two variants have the same values: ${repeated || "none"}`,
    );
  }
  return rows;
}
