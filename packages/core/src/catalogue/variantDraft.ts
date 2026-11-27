import { CoreError } from "../errors";

export const FAMILY_KINDS = [
  "general",
  "base_paint",
  "colorant",
  "paint",
  "thinner_solvent",
] as const;
export type FamilyKind = (typeof FAMILY_KINDS)[number];

export const PETROLEUM_CLASSES = ["A", "B", "C", "NA"] as const;
export type PetroleumClass = (typeof PETROLEUM_CLASSES)[number];

export const MAX_WARRANTY_MONTHS = 120;
export const MAX_TRADE_LABEL_LENGTH = 20;
export const MAX_LOCATION_TAG_LENGTH = 30;

/** What the owner typed for one variant, before it is saved (data-model: item_variant). */
export interface IVariantDraft {
  familyKind: FamilyKind;
  petroleumClass?: PetroleumClass | null;
  /** The "litres per unit" of FR-009, in thousandths of the declared unit. */
  declaredQtyMilli?: number | null;
  declaredUom?: string | null;
  sealedPackOnly: boolean;
  allowDecimal: boolean;
  warrantyMonths?: number | null;
  tradeLabel?: string | null;
  locationTag?: string | null;
}

function cleanText(text: string | null | undefined): string | null {
  const trimmed = text?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

/** A paint, base paint, colorant or thinner must say its petroleum class and declared quantity. */
function assertPaintFields(draft: IVariantDraft, declaredUom: string | null): void {
  if (draft.familyKind === "general") return;
  const missing = [
    draft.petroleumClass == null ? "petroleumClass" : null,
    draft.declaredQtyMilli == null ? "declaredQtyMilli" : null,
    declaredUom === null ? "declaredUom" : null,
  ].filter((fieldName) => fieldName !== null);
  if (missing.length > 0) {
    throw new CoreError(
      "MISSING_PAINT_FIELDS",
      "Paint items need the petroleum class, the declared quantity and its unit",
      { missing },
    );
  }
}

function assertPaintValues(draft: IVariantDraft): void {
  const { petroleumClass, declaredQtyMilli } = draft;
  if (petroleumClass != null && !PETROLEUM_CLASSES.includes(petroleumClass)) {
    throw new CoreError("INVALID_FIELD", "The petroleum class must be A, B, C or NA");
  }
  const isBadQuantity =
    declaredQtyMilli != null && (!Number.isSafeInteger(declaredQtyMilli) || declaredQtyMilli <= 0);
  if (isBadQuantity) {
    throw new CoreError(
      "INVALID_QUANTITY",
      "The declared quantity must be a whole number above zero",
    );
  }
}

function assertWarranty(months: number | null | undefined): void {
  const isBadWarranty =
    months != null && (!Number.isInteger(months) || months < 0 || months > MAX_WARRANTY_MONTHS);
  if (isBadWarranty) {
    throw new CoreError("INVALID_FIELD", `The warranty must be 0 to ${MAX_WARRANTY_MONTHS} months`);
  }
}

function assertLimits(draft: IVariantDraft, tradeLabel: string | null, locationTag: string | null) {
  assertWarranty(draft.warrantyMonths);
  if ((tradeLabel?.length ?? 0) > MAX_TRADE_LABEL_LENGTH) {
    throw new CoreError(
      "INVALID_FIELD",
      `The trade label can have at most ${MAX_TRADE_LABEL_LENGTH} characters`,
    );
  }
  if ((locationTag?.length ?? 0) > MAX_LOCATION_TAG_LENGTH) {
    throw new CoreError(
      "INVALID_FIELD",
      `The location tag can have at most ${MAX_LOCATION_TAG_LENGTH} characters`,
    );
  }
}

/**
 * Check a variant before it is saved and return it with the text trimmed (an empty text becomes
 * null). The rules are FR-009 and FR-010: paint fields for paint families, no decimals in a sealed
 * pack, a warranty of 0 to 120 months, a trade label up to 20 characters, a location tag up to 30.
 */
export function validateVariantDraft(draft: IVariantDraft): IVariantDraft {
  const declaredUom = cleanText(draft.declaredUom);
  const tradeLabel = cleanText(draft.tradeLabel);
  const locationTag = cleanText(draft.locationTag);
  assertPaintFields(draft, declaredUom);
  assertPaintValues(draft);
  if (draft.sealedPackOnly && draft.allowDecimal) {
    throw new CoreError("SEALED_PACK_DECIMAL", "A sealed pack cannot be sold in decimals");
  }
  assertLimits(draft, tradeLabel, locationTag);
  return {
    ...draft,
    petroleumClass: draft.petroleumClass ?? null,
    declaredQtyMilli: draft.declaredQtyMilli ?? null,
    declaredUom,
    warrantyMonths: draft.warrantyMonths ?? null,
    tradeLabel,
    locationTag,
  };
}
