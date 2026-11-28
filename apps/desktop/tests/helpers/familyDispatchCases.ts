import type { IFamilyCommandMap, IMergeCommandMap } from "@shopos/core";

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

/** The same for the US2 lookup, duplicate and merge commands. */
export const MERGE_DISPATCH_CASES = {
  "items.lookupBarcode": {
    input: { code: "0000" },
    expected: { ok: true, data: { variants: [] } },
  },
  "items.checkDuplicates": {
    input: { draft: { name: "Gate valve", axisSignature: "" } },
    expected: { ok: true, data: { candidates: [] } },
  },
  "items.merge": { input: { survivorId: "a", mergedId: "b", reason: "x" }, expected: notFound },
  "items.merge.reverse": {
    input: { mergeLogId: "no-such-merge", reason: "x" },
    expected: notFound,
  },
} satisfies Record<keyof IMergeCommandMap, { input: unknown; expected: object }>;
