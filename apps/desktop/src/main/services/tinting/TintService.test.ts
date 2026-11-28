import { CoreError } from "@shopos/core";
import { tintShop } from "../../../../tests/helpers/tintShop";
import { TintService } from "./TintService";

/**
 * Spec 002 T058, first part (research D11, FR-013, FR-016): formula versions, custom shades and
 * tint charges. The used-formula trigger and the repeat list come with tinted bills (T061).
 */
function shopWithSkyBlue() {
  const shop = tintShop();
  const tints = new TintService(shop.testDb.db, shop.testDb.ctx);
  const { shade, formula } = tints.saveCustomShade({
    shadeName: "Sky Blue",
    customerLabel: "Sharma",
    baseVariantId: shop.pastel4l.id,
    lines: [{ colorantVariantId: shop.blue.id, qtyMilli: 12_000 }],
  });
  return { ...shop, tints, shade, formula };
}

const codeOf = (action: () => unknown) => {
  try {
    action();
  } catch (caughtError) {
    if (caughtError instanceof CoreError) return caughtError.code;
    throw caughtError;
  }
  return undefined;
};

describe("TintService formulas (spec 002 T058)", () => {
  it("saves a change as version 2 and leaves version 1 as it was; the current one is the highest", () => {
    const { tints, shade, formula, pastel4l, blue, black, testDb } = shopWithSkyBlue();

    const { formula: second } = tints.saveVersion({
      shadeId: shade.id,
      baseVariantId: pastel4l.id,
      lines: [
        { colorantVariantId: blue.id, qtyMilli: 12_500 },
        { colorantVariantId: black.id, qtyMilli: 750 },
      ],
    });

    expect([formula.version, second.version]).toEqual([1, 2]);
    expect(
      testDb.sqlite
        .prepare("select qty_milli from tint_formula_line where formula_id = ?")
        .all(formula.id),
    ).toEqual([{ qty_milli: 12_000 }]);
    expect(tints.currentFormula(shade.id, pastel4l.id)?.id).toBe(second.id);
  });

  it("refuses a version for a shade that is not there", () => {
    const { tints, pastel4l, blue } = shopWithSkyBlue();

    expect(
      codeOf(() =>
        tints.saveVersion({
          shadeId: "no-such-shade",
          baseVariantId: pastel4l.id,
          lines: [{ colorantVariantId: blue.id, qtyMilli: 1_000 }],
        }),
      ),
    ).toBe("NOT_FOUND");
  });
});

describe("TintService custom shades (spec 002 T058)", () => {
  it("needs a customer or site label", () => {
    const { tints, pastel4l, blue } = shopWithSkyBlue();

    expect(
      codeOf(() =>
        tints.saveCustomShade({
          shadeName: "Mint",
          customerLabel: " ",
          baseVariantId: pastel4l.id,
          lines: [{ colorantVariantId: blue.id, qtyMilli: 1_000 }],
        }),
      ),
    ).toBe("LABEL_REQUIRED");
  });

  it("refuses a colorant that is not one, and a base that is not a base paint", () => {
    const { tints, pastel4l, blue } = shopWithSkyBlue();
    const shade = { shadeName: "Mint", siteLabel: "Gupta house" };

    expect(
      codeOf(() =>
        tints.saveCustomShade({
          ...shade,
          baseVariantId: pastel4l.id,
          lines: [{ colorantVariantId: pastel4l.id, qtyMilli: 1_000 }],
        }),
      ),
    ).toBe("NOT_A_COLORANT");
    expect(
      codeOf(() =>
        tints.saveCustomShade({
          ...shade,
          baseVariantId: blue.id,
          lines: [{ colorantVariantId: blue.id, qtyMilli: 1_000 }],
        }),
      ),
    ).toBe("NOT_A_BASE");
  });

  it("finds shades by name, ignoring case", () => {
    const { tints } = shopWithSkyBlue();

    expect(tints.searchShades({ query: "sky" }).shades.map((shade) => shade.shadeName)).toEqual([
      "Sky Blue",
    ]);
  });
});

describe("TintService charges (spec 002 T058)", () => {
  it("saves the charge per pack size and lists it back", () => {
    const { tints } = shopWithSkyBlue();

    tints.saveCharges({
      rules: [
        { declaredQtyMilli: 4_000, declaredUom: "litre", chargePaise: 6_000 },
        { declaredQtyMilli: 1_000, declaredUom: "litre", chargePaise: 2_000 },
      ],
    });

    expect(
      tints.listCharges().rules.map((rule) => [rule.declaredQtyMilli, rule.chargePaise]),
    ).toEqual([
      [1_000, 2_000],
      [4_000, 6_000],
    ]);
  });
});
