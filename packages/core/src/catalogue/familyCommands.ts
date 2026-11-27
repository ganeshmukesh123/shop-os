import { z } from "zod";
import { FAMILY_KINDS, PETROLEUM_CLASSES } from "./variantDraft";

/**
 * Input schemas of the catalogue.*, families.* and variants.* commands (spec 002
 * contracts/ipc-commands.md, first table; task T031). Rules that need more than one field or the
 * database (4 axes, 500 combinations, paint fields, duplicate signatures) are checked in core
 * and the services, which return the contract's error codes.
 */
const paise = z.number().int().safe().min(0);
const quantityMilli = z.number().int().safe();
const id = z.string().min(1);
const trimmedText = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalText = (maximum: number) => z.string().trim().max(maximum).nullish();

export const categorySaveInput = z.object({
  id: id.optional(),
  parentId: id.nullish(),
  name: trimmedText(80),
  defaultHsn: z
    .string()
    .regex(/^(\d{4}|\d{6}|\d{8})$/, "HSN must be 4, 6 or 8 digits")
    .nullish(),
  defaultBaseUom: z.string().trim().min(1).max(20).nullish(),
  titleTemplate: optionalText(120),
});
export type CategorySaveInput = z.infer<typeof categorySaveInput>;

export const brandSaveInput = z.object({ id: id.optional(), name: trimmedText(60) });
export type BrandSaveInput = z.infer<typeof brandSaveInput>;

export const familiesPreviewInput = z.object({
  axisKeys: z.array(z.string()),
  axisValues: z.record(z.string(), z.array(z.string())),
});
export type FamiliesPreviewInput = z.infer<typeof familiesPreviewInput>;

/** The fields a variant has besides its axes (data-model.md "item_variant (changed)"). */
const variantFields = {
  displayName: optionalText(120),
  allowDecimal: z.boolean(),
  sellingPricePaise: paise,
  purchasePricePaise: paise.nullish(),
  reorderLevelMilli: quantityMilli.min(0).nullish(),
  locationTag: optionalText(30),
  petroleumClass: z.enum(PETROLEUM_CLASSES).nullish(),
  declaredQtyMilli: quantityMilli.min(1).nullish(),
  declaredUom: z.string().trim().min(1).max(20).nullish(),
  tradeLabel: optionalText(20),
  sealedPackOnly: z.boolean().default(false),
  warrantyMonths: z.number().int().min(0).max(120).nullish(),
  isSerialTracked: z.boolean().default(false),
};

export const newVariantInput = z.object({
  axes: z.record(z.string(), z.string()),
  baseUom: z.string().trim().min(1).max(20),
  openingQtyMilli: quantityMilli.min(0),
  ...variantFields,
});
export type NewVariantInput = z.infer<typeof newVariantInput>;

export const familiesCreateInput = z.object({
  family: z.object({
    name: trimmedText(120),
    kind: z.enum(FAMILY_KINDS),
    categoryId: id.nullish(),
    brandId: id.nullish(),
    spec: z.record(z.string(), z.string()).default({}),
    axisKeys: z.array(z.string()),
  }),
  variants: z.array(newVariantInput).min(1),
});
export type FamiliesCreateInput = z.infer<typeof familiesCreateInput>;

export const familiesUpdateInput = z.object({
  id,
  name: trimmedText(120).optional(),
  categoryId: id.nullish(),
  brandId: id.nullish(),
  spec: z.record(z.string(), z.string()).optional(),
});
export type FamiliesUpdateInput = z.infer<typeof familiesUpdateInput>;

export const familiesAddVariantsInput = z.object({
  familyId: id,
  variants: z.array(newVariantInput).min(1),
});
export type FamiliesAddVariantsInput = z.infer<typeof familiesAddVariantsInput>;

/** Every variant field except its axes, which never change (a new axis value is a new variant). */
export const variantsUpdateInput = z.object({
  id,
  displayName: variantFields.displayName,
  allowDecimal: variantFields.allowDecimal.optional(),
  sellingPricePaise: paise.optional(),
  purchasePricePaise: variantFields.purchasePricePaise,
  reorderLevelMilli: variantFields.reorderLevelMilli,
  locationTag: variantFields.locationTag,
  petroleumClass: variantFields.petroleumClass,
  declaredQtyMilli: variantFields.declaredQtyMilli,
  declaredUom: variantFields.declaredUom,
  tradeLabel: variantFields.tradeLabel,
  sealedPackOnly: z.boolean().optional(),
  warrantyMonths: variantFields.warrantyMonths,
  isSerialTracked: z.boolean().optional(),
});
export type VariantsUpdateInput = z.infer<typeof variantsUpdateInput>;

export const variantsSetActiveInput = z.object({ id, isActive: z.boolean() });
export type VariantsSetActiveInput = z.infer<typeof variantsSetActiveInput>;

export const variantsSetConversionsInput = z.object({
  variantId: id,
  conversions: z
    .array(
      z.object({ uomCode: z.string().trim().min(1).max(20), factorMilli: quantityMilli.min(1) }),
    )
    .refine(
      (conversions) =>
        new Set(conversions.map(({ uomCode }) => uomCode)).size === conversions.length,
      "Each unit can be listed once",
    ),
});
export type VariantsSetConversionsInput = z.infer<typeof variantsSetConversionsInput>;
