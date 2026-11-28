import type { IFamilyCommandMap } from "@shopos/core";

/**
 * One dispatch case per spec 002 US1 command for ipcRegistration.test.ts: an input and the part of
 * the result that proves the command reached its own handler on an empty shop.
 */
const invalid = { ok: false, code: "INVALID_FIELD" };
const notFound = { ok: false, code: "NOT_FOUND" };

export const FAMILY_DISPATCH_CASES = {
  "catalogue.categories.list": { input: {}, expected: { ok: true, data: { categories: [] } } },
  "catalogue.categories.save": { input: { name: "" }, expected: invalid },
  "catalogue.brands.list": { input: {}, expected: { ok: true, data: { brands: [] } } },
  "catalogue.brands.save": { input: { name: "" }, expected: invalid },
  "catalogue.units.list": { input: {}, expected: { ok: true } },
  "families.previewVariants": {
    input: { axisKeys: ["size"], axisValues: { size: ["1 in"] } },
    expected: {
      ok: true,
      data: {
        combinations: [{ axes: { size: "1 in" }, axisSignature: "size=1 in", displayName: "1 in" }],
      },
    },
  },
  "families.create": { input: { family: { name: "" }, variants: [] }, expected: invalid },
  "families.get": { input: { id: "no-such-family" }, expected: notFound },
  "families.update": { input: { id: "no-such-family", name: "Pipe" }, expected: notFound },
  "families.addVariants": { input: { familyId: "x", variants: [] }, expected: invalid },
  "variants.update": { input: { id: "no-such-variant" }, expected: notFound },
  "variants.setActive": { input: { id: "no-such-variant", isActive: false }, expected: notFound },
  "items.search": {
    input: { query: "pipe", limit: 5 },
    expected: { ok: true, data: { results: [] } },
  },
  "families.grid": { input: { familyId: "no-such-family" }, expected: notFound },
  "variants.setConversions": {
    input: { variantId: "no-such-variant", conversions: [] },
    expected: notFound,
  },
} satisfies Record<keyof IFamilyCommandMap, { input: unknown; expected: object }>;
