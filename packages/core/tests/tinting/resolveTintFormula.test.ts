import { CoreError } from "../../src/errors";
import {
  resolveTintFormula,
  type ITintBase,
  type ITintFormula,
} from "../../src/tinting/resolveTintFormula";

/** Spec 002 T054 (research D11): the base can and the current formula for a shade. */
const PASTEL_4L: ITintBase = {
  variantId: "royale-pastel-4l",
  kind: "base_paint",
  axes: { base_type: "Pastel", pack_size: "4 L" },
};
const WHITE_1L: ITintBase = {
  variantId: "royale-white-1l",
  kind: "base_paint",
  axes: { base_type: "White", pack_size: "1 L" },
};
const SKY_BLUE_V1: ITintFormula = {
  id: "sky-v1",
  shadeId: "sky-blue",
  baseVariantId: "royale-pastel-4l",
  version: 1,
  lines: [{ colorantVariantId: "blue", qtyMilli: 12_000 }],
};
const SKY_BLUE_V2: ITintFormula = {
  ...SKY_BLUE_V1,
  id: "sky-v2",
  version: 2,
  lines: [
    { colorantVariantId: "blue", qtyMilli: 12_500 },
    { colorantVariantId: "black", qtyMilli: 750 },
  ],
};

const codeOf = (action: () => unknown) => {
  try {
    action();
  } catch (caughtError) {
    return (caughtError as CoreError).code;
  }
  return undefined;
};

describe("resolveTintFormula (spec 002 T054)", () => {
  it("picks the Pastel 4 L base and the highest formula version for Sky Blue", () => {
    const resolved = resolveTintFormula(
      { shadeId: "sky-blue", baseType: "Pastel", packSize: "4 L" },
      [WHITE_1L, PASTEL_4L],
      [SKY_BLUE_V2, SKY_BLUE_V1],
    );

    expect(resolved.base.variantId).toBe("royale-pastel-4l");
    expect(resolved.formula.id).toBe("sky-v2");
  });

  it("says NO_FORMULA when the shade has none for that base and pack", () => {
    expect(
      codeOf(() =>
        resolveTintFormula(
          { shadeId: "sky-blue", baseType: "White", packSize: "1 L" },
          [WHITE_1L, PASTEL_4L],
          [SKY_BLUE_V1],
        ),
      ),
    ).toBe("NO_FORMULA");
  });

  it("says NOT_A_BASE when the variant is not a base paint", () => {
    const readyMixed: ITintBase = { ...PASTEL_4L, kind: "paint" };

    expect(
      codeOf(() =>
        resolveTintFormula(
          { shadeId: "sky-blue", baseType: "Pastel", packSize: "4 L" },
          [readyMixed],
          [SKY_BLUE_V1],
        ),
      ),
    ).toBe("NOT_A_BASE");
  });

  it("says NOT_FOUND when the product has no such base type and pack", () => {
    expect(
      codeOf(() =>
        resolveTintFormula(
          { shadeId: "sky-blue", baseType: "Deep", packSize: "20 L" },
          [PASTEL_4L],
          [SKY_BLUE_V1],
        ),
      ),
    ).toBe("NOT_FOUND");
  });
});
