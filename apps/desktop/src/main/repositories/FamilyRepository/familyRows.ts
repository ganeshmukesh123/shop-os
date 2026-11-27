import type { FamilyKind, IFamily, IVariant, PetroleumClass } from "@shopos/core";
import type { itemFamily, itemVariant } from "../../db/itemSchema";

export type FamilyRow = typeof itemFamily.$inferSelect;
export type VariantRow = typeof itemVariant.$inferSelect;
export type NewVariantRow = Omit<
  typeof itemVariant.$inferInsert,
  "id" | "businessId" | "shopId" | "createdAt" | "updatedAt" | "itemCode" | "familyId"
>;

const parseJson = <TValue>(text: string): TValue => JSON.parse(text) as TValue;

export function toFamily(familyRow: FamilyRow): IFamily {
  return {
    id: familyRow.id,
    name: familyRow.name,
    kind: familyRow.kind as FamilyKind,
    categoryId: familyRow.categoryId,
    brandId: familyRow.brandId,
    spec: parseJson<Record<string, string>>(familyRow.spec),
    axisKeys: parseJson<string[]>(familyRow.axisKeys),
  };
}

export function toVariant(variantRow: VariantRow): IVariant {
  return {
    id: variantRow.id,
    familyId: variantRow.familyId,
    itemCode: variantRow.itemCode,
    displayName: variantRow.displayName,
    axes: parseJson<Record<string, string>>(variantRow.axes),
    axisSignature: variantRow.axisSignature,
    baseUom: variantRow.baseUom,
    allowDecimal: variantRow.allowDecimal === 1,
    sellingPricePaise: variantRow.sellingPricePaise,
    purchasePricePaise: variantRow.purchasePricePaise,
    reorderLevelMilli: variantRow.reorderLevelMilli,
    stockMilli: variantRow.stockMilli,
    isActive: variantRow.isActive === 1,
    locationTag: variantRow.locationTag,
    petroleumClass: variantRow.petroleumClass as PetroleumClass | null,
    declaredQtyMilli: variantRow.declaredQtyMilli,
    declaredUom: variantRow.declaredUom,
    tradeLabel: variantRow.tradeLabel,
    sealedPackOnly: variantRow.sealedPackOnly === 1,
    warrantyMonths: variantRow.warrantyMonths,
    isSerialTracked: variantRow.isSerialTracked === 1,
    mergedIntoId: variantRow.mergedIntoId,
  };
}
