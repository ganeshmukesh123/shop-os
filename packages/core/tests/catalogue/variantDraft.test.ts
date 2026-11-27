import { CoreError } from "../../src/errors";
import {
  FAMILY_KINDS,
  PETROLEUM_CLASSES,
  validateVariantDraft,
  type IVariantDraft,
} from "../../src/catalogue/variantDraft";

function errorOf(action: () => unknown): CoreError | undefined {
  try {
    action();
  } catch (error) {
    if (error instanceof CoreError) return error;
    throw error;
  }
  return undefined;
}

const generalDraft = (changes: Partial<IVariantDraft> = {}): IVariantDraft => ({
  familyKind: "general",
  sealedPackOnly: false,
  allowDecimal: false,
  ...changes,
});

const paintDraft = (changes: Partial<IVariantDraft> = {}): IVariantDraft =>
  generalDraft({
    familyKind: "paint",
    petroleumClass: "B",
    declaredQtyMilli: 4000,
    declaredUom: "L",
    sealedPackOnly: true,
    ...changes,
  });

describe("validateVariantDraft: paint fields (task T009, FR-009)", () => {
  it("lists the family kinds and the petroleum classes", () => {
    expect([...FAMILY_KINDS]).toEqual([
      "general",
      "base_paint",
      "colorant",
      "paint",
      "thinner_solvent",
    ]);
    expect([...PETROLEUM_CLASSES]).toEqual(["A", "B", "C", "NA"]);
  });

  it("accepts a general variant with no paint fields", () => {
    expect(errorOf(() => validateVariantDraft(generalDraft()))).toBeUndefined();
  });

  it.each(["base_paint", "colorant", "paint", "thinner_solvent"] as const)(
    "needs the petroleum class, declared quantity and unit for a %s family",
    (familyKind) => {
      const error = errorOf(() => validateVariantDraft(generalDraft({ familyKind })));

      expect(error?.code).toBe("MISSING_PAINT_FIELDS");
      expect(error?.details).toEqual({
        missing: ["petroleumClass", "declaredQtyMilli", "declaredUom"],
      });
    },
  );

  it("names only the paint fields that are missing", () => {
    const error = errorOf(() => validateVariantDraft(paintDraft({ declaredUom: "  " })));

    expect(error?.details).toEqual({ missing: ["declaredUom"] });
  });

  it("accepts a complete paint variant, and NA as a petroleum class", () => {
    const accepted = validateVariantDraft(paintDraft({ petroleumClass: "NA" }));

    expect(accepted.petroleumClass).toBe("NA");
  });

  it("rejects a petroleum class that is not A, B, C or NA", () => {
    const draft = paintDraft({ petroleumClass: "D" as IVariantDraft["petroleumClass"] });

    expect(errorOf(() => validateVariantDraft(draft))?.code).toBe("INVALID_FIELD");
  });

  it.each([-1, 0, 3.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects a declared quantity of %s with INVALID_QUANTITY",
    (declaredQtyMilli) => {
      const error = errorOf(() => validateVariantDraft(paintDraft({ declaredQtyMilli })));

      expect(error?.code).toBe("INVALID_QUANTITY");
    },
  );

  it.each([1, Number.MAX_SAFE_INTEGER])("accepts a declared quantity of %s", (declaredQtyMilli) => {
    const accepted = validateVariantDraft(paintDraft({ declaredQtyMilli }));

    expect(accepted.declaredQtyMilli).toBe(declaredQtyMilli);
  });
});

describe("validateVariantDraft: sealed packs, warranty and labels", () => {
  it("rejects a sealed pack that allows decimals with SEALED_PACK_DECIMAL", () => {
    const draft = paintDraft({ sealedPackOnly: true, allowDecimal: true });

    expect(errorOf(() => validateVariantDraft(draft))?.code).toBe("SEALED_PACK_DECIMAL");
  });

  it("allows decimals when the pack is not sealed, as for a colorant in ml", () => {
    const draft = paintDraft({ sealedPackOnly: false, allowDecimal: true });

    expect(errorOf(() => validateVariantDraft(draft))).toBeUndefined();
  });

  it("accepts a warranty of 0 to 120 months, or none", () => {
    const accepted = [0, 12, 120].map((months) =>
      errorOf(() => validateVariantDraft(generalDraft({ warrantyMonths: months }))),
    );

    expect(accepted).toEqual([undefined, undefined, undefined]);
    expect(
      errorOf(() => validateVariantDraft(generalDraft({ warrantyMonths: null }))),
    ).toBeUndefined();
  });

  it("rejects a warranty below 0, above 120 or not a whole number", () => {
    const codes = [-1, 121, 6.5].map(
      (months) =>
        errorOf(() => validateVariantDraft(generalDraft({ warrantyMonths: months })))?.code,
    );

    expect(codes).toEqual(["INVALID_FIELD", "INVALID_FIELD", "INVALID_FIELD"]);
  });

  it("allows a trade label of 20 characters and rejects 21", () => {
    const ok = errorOf(() => validateVariantDraft(generalDraft({ tradeLabel: "a".repeat(20) })));
    const tooLong = errorOf(() =>
      validateVariantDraft(generalDraft({ tradeLabel: "a".repeat(21) })),
    );

    expect(ok).toBeUndefined();
    expect(tooLong?.code).toBe("INVALID_FIELD");
  });

  it("allows a location tag of 30 characters and rejects 31", () => {
    const ok = errorOf(() => validateVariantDraft(generalDraft({ locationTag: "a".repeat(30) })));
    const tooLong = errorOf(() =>
      validateVariantDraft(generalDraft({ locationTag: "a".repeat(31) })),
    );

    expect(ok).toBeUndefined();
    expect(tooLong?.code).toBe("INVALID_FIELD");
  });

  it("returns the draft with the text trimmed and an empty text as null", () => {
    const cleaned = validateVariantDraft(
      generalDraft({ tradeLabel: "  Premium ", locationTag: "   ", declaredUom: " L " }),
    );

    expect(cleaned.tradeLabel).toBe("Premium");
    expect(cleaned.locationTag).toBeNull();
    expect(cleaned.declaredUom).toBe("L");
  });
});
