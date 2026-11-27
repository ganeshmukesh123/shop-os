import {
  brandSaveInput,
  categorySaveInput,
  familiesAddVariantsInput,
  familiesCreateInput,
  familiesPreviewInput,
  familiesUpdateInput,
  variantsSetActiveInput,
  variantsSetConversionsInput,
  variantsUpdateInput,
} from "../../src/catalogue/familyCommands";

/** Spec 002 T031: the input schemas of catalogue.*, families.* and variants.* (contracts table 1). */
const ONE_INCH_PIPE = {
  axes: { size: "1 in", class: "4 kg" },
  baseUom: "metre",
  allowDecimal: true,
  sellingPricePaise: 12_000,
  openingQtyMilli: 30_000,
};

describe("catalogue inputs (spec 002 T031)", () => {
  it("trims a category and accepts its optional defaults", () => {
    expect(
      categorySaveInput.parse({
        name: "  PVC Pipes ",
        parentId: "pipes",
        defaultHsn: "3917",
        defaultBaseUom: "metre",
        titleTemplate: "{brand} {size} {class}",
      }),
    ).toMatchObject({ name: "PVC Pipes", defaultHsn: "3917" });
  });

  it("refuses an empty category name, an 81-character one and a 5-digit HSN", () => {
    expect(categorySaveInput.safeParse({ name: " " }).success).toBe(false);
    expect(categorySaveInput.safeParse({ name: "C".repeat(81) }).success).toBe(false);
    expect(categorySaveInput.safeParse({ name: "Pipes", defaultHsn: "39172" }).success).toBe(false);
  });

  it("refuses an empty or 61-character brand", () => {
    expect(brandSaveInput.safeParse({ name: "" }).success).toBe(false);
    expect(brandSaveInput.safeParse({ name: "B".repeat(61) }).success).toBe(false);
    expect(brandSaveInput.parse({ name: " Supreme " })).toEqual({ name: "Supreme" });
  });
});

describe("families inputs (spec 002 T031)", () => {
  it("accepts a preview of up to 4 axes; the 500 cap is core's job, not the schema's", () => {
    expect(
      familiesPreviewInput.parse({
        axisKeys: ["size", "class"],
        axisValues: { size: ["0.5 in", "1 in"], class: ["4 kg"] },
      }),
    ).toEqual({
      axisKeys: ["size", "class"],
      axisValues: { size: ["0.5 in", "1 in"], class: ["4 kg"] },
    });
  });

  it("accepts a family of general kind with its variants, defaulting the optional flags", () => {
    const parsed = familiesCreateInput.parse({
      family: { name: "PVC Pipe Supreme", kind: "general", axisKeys: ["size", "class"] },
      variants: [ONE_INCH_PIPE],
    });

    expect(parsed.family.spec).toEqual({});
    expect(parsed.variants[0]).toMatchObject({ sealedPackOnly: false, isSerialTracked: false });
  });

  it("refuses an unknown kind, no variants, a negative price and a fractional quantity", () => {
    const family = { name: "Pipe", kind: "general", axisKeys: [] };

    expect(
      familiesCreateInput.safeParse({
        family: { ...family, kind: "glue" },
        variants: [ONE_INCH_PIPE],
      }).success,
    ).toBe(false);
    expect(familiesCreateInput.safeParse({ family, variants: [] }).success).toBe(false);
    expect(
      familiesCreateInput.safeParse({
        family,
        variants: [{ ...ONE_INCH_PIPE, sellingPricePaise: -1 }],
      }).success,
    ).toBe(false);
    expect(
      familiesCreateInput.safeParse({
        family,
        variants: [{ ...ONE_INCH_PIPE, openingQtyMilli: 0.5 }],
      }).success,
    ).toBe(false);
  });

  it("updates a family's name, category, brand or spec, and adds variants to it", () => {
    expect(familiesUpdateInput.parse({ id: "family-1", name: " Pipe " })).toEqual({
      id: "family-1",
      name: "Pipe",
    });
    expect(
      familiesAddVariantsInput.safeParse({ familyId: "family-1", variants: [ONE_INCH_PIPE] })
        .success,
    ).toBe(true);
  });
});

describe("variants inputs (spec 002 T031)", () => {
  it("updates a variant's price and paint fields, never its axes", () => {
    const parsed = variantsUpdateInput.parse({
      id: "variant-1",
      sellingPricePaise: 13_000,
      petroleumClass: "B",
      axes: { size: "2 in" },
    });

    expect(parsed).toEqual({ id: "variant-1", sellingPricePaise: 13_000, petroleumClass: "B" });
  });

  it("sets a variant active or not", () => {
    expect(variantsSetActiveInput.parse({ id: "variant-1", isActive: false })).toEqual({
      id: "variant-1",
      isActive: false,
    });
  });

  it("takes conversions above zero and refuses the same unit twice", () => {
    expect(
      variantsSetConversionsInput.safeParse({
        variantId: "wire",
        conversions: [{ uomCode: "roll", factorMilli: 90_000 }],
      }).success,
    ).toBe(true);
    expect(
      variantsSetConversionsInput.safeParse({
        variantId: "wire",
        conversions: [{ uomCode: "roll", factorMilli: 0 }],
      }).success,
    ).toBe(false);
    expect(
      variantsSetConversionsInput.safeParse({
        variantId: "wire",
        conversions: [
          { uomCode: "roll", factorMilli: 90_000 },
          { uomCode: "roll", factorMilli: 45_000 },
        ],
      }).success,
    ).toBe(false);
  });
});
