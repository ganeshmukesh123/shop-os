import { z } from "zod";

/** tint.* inputs (spec 002 contracts, T063). Quantities are thousandths of a ml (0.25 ml = 250). */
const formulaLines = z
  .array(
    z.object({
      colorantVariantId: z.string().min(1),
      qtyMilli: z.number().int().positive(),
    }),
  )
  .min(1)
  .max(20);

export const tintSaveVersionInput = z.object({
  shadeId: z.string().min(1),
  baseVariantId: z.string().min(1),
  lines: formulaLines,
});
export type TintSaveVersionInput = z.infer<typeof tintSaveVersionInput>;

export const tintCustomShadeSaveInput = z.object({
  shadeName: z.string().trim().min(1).max(60),
  /** One of the two is required (FR-016); checked by the service as LABEL_REQUIRED */
  customerLabel: z.string().max(80).optional(),
  siteLabel: z.string().max(80).optional(),
  baseVariantId: z.string().min(1),
  lines: formulaLines,
});
export type TintCustomShadeSaveInput = z.infer<typeof tintCustomShadeSaveInput>;

export const tintShadesSearchInput = z.object({
  query: z.string().max(60),
  brandId: z.string().min(1).optional(),
});
export type TintShadesSearchInput = z.infer<typeof tintShadesSearchInput>;

export const tintChargesSaveInput = z.object({
  rules: z
    .array(
      z.object({
        declaredQtyMilli: z.number().int().positive(),
        declaredUom: z.string().trim().min(1).max(20),
        chargePaise: z.number().int().min(0),
      }),
    )
    .max(20),
});
export type TintChargesSaveInput = z.infer<typeof tintChargesSaveInput>;
export type ITintChargeRow = TintChargesSaveInput["rules"][number];

/** A shade from the library or a custom one mixed for a customer or site. */
export interface ITintShade {
  id: string;
  shadeCode: string;
  shadeName: string;
  brandId: string | null;
  shadeCard: string | null;
  source: "library" | "custom";
  customerLabel: string | null;
  siteLabel: string | null;
}
