import { DEFAULT_TIME_ZONE, isValidTimeZone, validateNumberTemplate } from "@shopos/core";
import type { ShopProfile } from "@shopos/core";

export type NumberTemplateCheck = ReturnType<typeof validateNumberTemplate>;

/**
 * Check the shop's bill-number template and give an example. The example's financial year follows
 * the shop's zone; a half-typed zone name must not break the preview, so it falls back to the default.
 */
export function checkNumberTemplate(shopProfile: ShopProfile, now: Date): NumberTemplateCheck {
  const previewZone = isValidTimeZone(shopProfile.timeZone)
    ? shopProfile.timeZone
    : DEFAULT_TIME_ZONE;
  return validateNumberTemplate(
    shopProfile.numberTemplate,
    shopProfile.seriesCode,
    now,
    previewZone,
  );
}
