import {
  validateVariantDraft,
  type FamilyKind,
  type IVariant,
  type VariantsUpdateInput,
} from "@shopos/core";
import type { NewVariantRow } from "../../repositories/FamilyRepository";

/** `given` when the caller sent it (null clears), else the variant's current value. */
const pick = <TValue>(given: TValue | undefined, current: TValue): TValue =>
  given === undefined ? current : given;

const asFlag = (isOn: boolean) => (isOn ? 1 : 0);

const orNull = <TValue>(value: TValue | null | undefined): TValue | null => value ?? null;

/**
 * The row patch for variants.update: the variant as it would be after the change is checked by
 * the same draft rules as a new one (paint fields, sealed pack, limits). Axes are never patched.
 */
export function toVariantPatch(
  familyKind: FamilyKind,
  current: IVariant,
  input: VariantsUpdateInput,
): Partial<NewVariantRow> {
  const allowDecimal = pick(input.allowDecimal, current.allowDecimal);
  const sealedPackOnly = pick(input.sealedPackOnly, current.sealedPackOnly);
  const draft = validateVariantDraft({
    familyKind,
    allowDecimal,
    sealedPackOnly,
    petroleumClass: pick(input.petroleumClass, current.petroleumClass),
    declaredQtyMilli: pick(input.declaredQtyMilli, current.declaredQtyMilli),
    declaredUom: pick(input.declaredUom, current.declaredUom),
    warrantyMonths: pick(input.warrantyMonths, current.warrantyMonths),
    tradeLabel: pick(input.tradeLabel, current.tradeLabel),
    locationTag: pick(input.locationTag, current.locationTag),
  });
  return {
    displayName: input.displayName?.trim() || current.displayName,
    allowDecimal: asFlag(allowDecimal),
    sealedPackOnly: asFlag(sealedPackOnly),
    isSerialTracked: asFlag(pick(input.isSerialTracked, current.isSerialTracked)),
    sellingPricePaise: pick(input.sellingPricePaise, current.sellingPricePaise),
    purchasePricePaise: orNull(pick(input.purchasePricePaise, current.purchasePricePaise)),
    reorderLevelMilli: orNull(pick(input.reorderLevelMilli, current.reorderLevelMilli)),
    petroleumClass: orNull(draft.petroleumClass),
    declaredQtyMilli: orNull(draft.declaredQtyMilli),
    declaredUom: orNull(draft.declaredUom),
    warrantyMonths: orNull(draft.warrantyMonths),
    tradeLabel: orNull(draft.tradeLabel),
    locationTag: orNull(draft.locationTag),
  };
}
