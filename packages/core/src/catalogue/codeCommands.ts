import { z } from "zod";

/** variants.setBarcodes and variants.setSearchNames (spec 002 contracts, T047; data-model D7). */
export const BARCODE_SOURCES = ["manufacturer", "shop_label"] as const;
export const SEARCH_NAME_LANGUAGES = ["en", "hi", "hinglish"] as const;
export const SEARCH_NAME_KINDS = ["alias", "trade", "spelling"] as const;

/** 1-48 digits, letters or hyphens (data-model item_barcode). */
const BARCODE_PATTERN = /^[0-9A-Za-z-]{1,48}$/;

export const isValidBarcode = (code: string): boolean => BARCODE_PATTERN.test(code);

export const variantsSetBarcodesInput = z.object({
  variantId: z.string().min(1),
  /** Codes are checked by the service, so a bad one is INVALID_BARCODE, not INVALID_FIELD */
  barcodes: z
    .array(z.object({ code: z.string().trim().max(64), source: z.enum(BARCODE_SOURCES) }))
    .max(20),
});
export type VariantsSetBarcodesInput = z.infer<typeof variantsSetBarcodesInput>;

export const variantsSetSearchNamesInput = z.object({
  variantIds: z.array(z.string().min(1)).min(1).max(200),
  names: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        language: z.enum(SEARCH_NAME_LANGUAGES),
        kind: z.enum(SEARCH_NAME_KINDS),
      }),
    )
    .max(30),
});
export type VariantsSetSearchNamesInput = z.infer<typeof variantsSetSearchNamesInput>;

export interface IBarcode {
  id: string;
  variantId: string;
  code: string;
  source: (typeof BARCODE_SOURCES)[number];
}

export interface ISearchName {
  id: string;
  variantId: string;
  name: string;
  language: (typeof SEARCH_NAME_LANGUAGES)[number];
  kind: (typeof SEARCH_NAME_KINDS)[number];
}

/** Another item holding one of the codes just saved. */
export interface IBarcodeShare {
  code: string;
  variantId: string;
  displayName: string;
}
