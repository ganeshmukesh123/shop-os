import { CoreError, type NewVariantInput } from "@shopos/core";
import { createTestDb } from "../../../../tests/helpers/testDb";
import { FamilyService } from "./FamilyService";

/** Spec 002 T033: reading and changing a family after it is created (contracts families.*). */
const wire = (size: string, overrides: Partial<NewVariantInput> = {}): NewVariantInput => ({
  axes: { size },
  baseUom: "metre",
  allowDecimal: true,
  sellingPricePaise: 2_500,
  openingQtyMilli: 0,
  sealedPackOnly: false,
  isSerialTracked: false,
  ...overrides,
});

function wireFamily() {
  const testDb = createTestDb();
  const refreshed: string[] = [];
  const families = new FamilyService(testDb.db, testDb.ctx, {
    refreshVariant: (variantId) => refreshed.push(variantId),
  });
  const created = families.create({
    family: { name: "Copper Wire", kind: "general", spec: {}, axisKeys: ["size"] },
    variants: [wire("1 sq mm"), wire("1.5 sq mm")],
  });
  refreshed.length = 0;
  return { testDb, families, refreshed, ...created };
}

function codeOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (caughtError) {
    if (caughtError instanceof CoreError) return caughtError.code;
    throw caughtError;
  }
  return undefined;
}

describe("FamilyService.get (spec 002 T033)", () => {
  it("returns the family, its variants and their conversions", () => {
    const { families, family, variants } = wireFamily();
    families.setConversions({
      variantId: variants[0]!.id,
      conversions: [{ uomCode: "roll", factorMilli: 90_000 }],
    });

    const detail = families.get({ id: family.id });

    expect(detail.family.name).toBe("Copper Wire");
    expect(detail.variants).toHaveLength(2);
    expect(detail.conversions).toEqual([
      { variantId: variants[0]!.id, uomCode: "roll", factorMilli: 90_000 },
    ]);
  });

  it("says NOT_FOUND for a family that is not there", () => {
    const { families } = wireFamily();

    expect(codeOf(() => families.get({ id: "no-such-family" }))).toBe("NOT_FOUND");
  });
});

describe("FamilyService.update and addVariants (spec 002 T033)", () => {
  it("renames a family and tells search", () => {
    const { families, family, variants, refreshed } = wireFamily();

    expect(families.update({ id: family.id, name: "Copper Wire FR" }).family.name).toBe(
      "Copper Wire FR",
    );
    expect(refreshed).toEqual([variants[0]!.id]);
  });

  it("refuses a rename to another family's name", () => {
    const { families, family } = wireFamily();
    families.create({
      family: { name: "Aluminium Wire", kind: "general", spec: {}, axisKeys: [] },
      variants: [{ ...wire(""), axes: {} }],
    });

    expect(codeOf(() => families.update({ id: family.id, name: "aluminium wire" }))).toBe(
      "DUPLICATE_NAME",
    );
  });

  it("adds a new size, and refuses one the family already has", () => {
    const { families, family } = wireFamily();

    const { variants } = families.addVariants({
      familyId: family.id,
      variants: [wire("2.5 sq mm")],
    });

    expect(variants.map((variant) => variant.axes.size)).toEqual(["2.5 sq mm"]);
    expect(
      codeOf(() => families.addVariants({ familyId: family.id, variants: [wire("1 sq mm")] })),
    ).toBe("DUPLICATE_SIGNATURE");
  });
});

describe("FamilyService.updateVariant (spec 002 T033)", () => {
  it("changes the price and label but never the axes", () => {
    const { families, variants } = wireFamily();

    const { variant } = families.updateVariant({
      id: variants[0]!.id,
      sellingPricePaise: 2_800,
      locationTag: "Rack B3",
    });

    expect(variant).toMatchObject({ sellingPricePaise: 2_800, locationTag: "Rack B3" });
    expect(variant.axes).toEqual({ size: "1 sq mm" });
  });

  it("refuses a sealed pack that allows decimals with SEALED_PACK_DECIMAL", () => {
    const { families, variants } = wireFamily();

    expect(
      codeOf(() => families.updateVariant({ id: variants[0]!.id, sealedPackOnly: true })),
    ).toBe("SEALED_PACK_DECIMAL");
  });
});

describe("FamilyService.setConversions (spec 002 T033, T037)", () => {
  it("replaces the conversions: a roll of 90 m, then a box of 45 m instead", () => {
    const { families, variants } = wireFamily();
    const variantId = variants[0]!.id;
    families.setConversions({ variantId, conversions: [{ uomCode: "roll", factorMilli: 90_000 }] });

    const { conversions } = families.setConversions({
      variantId,
      conversions: [{ uomCode: "box", factorMilli: 45_000 }],
    });

    expect(conversions).toEqual([{ variantId, uomCode: "box", factorMilli: 45_000 }]);
  });

  it("refuses the base unit with BASE_UNIT_LISTED and a unit the shop does not have", () => {
    const { families, variants } = wireFamily();
    const variantId = variants[0]!.id;

    expect(
      codeOf(() =>
        families.setConversions({
          variantId,
          conversions: [{ uomCode: "metre", factorMilli: 1000 }],
        }),
      ),
    ).toBe("BASE_UNIT_LISTED");
    expect(
      codeOf(() =>
        families.setConversions({
          variantId,
          conversions: [{ uomCode: "furlong", factorMilli: 1 }],
        }),
      ),
    ).toBe("UNKNOWN_UNIT");
  });
});
