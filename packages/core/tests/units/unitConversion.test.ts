import { CoreError } from "../../src/errors";
import { convertToBaseMilli } from "../../src/units/unitConversion";

function errorCodeOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    return error instanceof CoreError ? error.code : "NOT_A_CORE_ERROR";
  }
  return undefined;
}

describe("convertToBaseMilli (task T006, research D3)", () => {
  it("turns 2 rolls of 90 m into 180 m", () => {
    expect(convertToBaseMilli(2000, 90000)).toBe(180000);
  });

  it("turns 0.33 of a roll of 90 m into 29.7 m", () => {
    expect(convertToBaseMilli(330, 90000)).toBe(29700);
  });

  it("turns half a box of 10 pieces into 5 pieces", () => {
    expect(convertToBaseMilli(500, 10000)).toBe(5000);
  });

  it("keeps the quantity when the factor is one whole base unit", () => {
    expect(convertToBaseMilli(2500, 1000)).toBe(2500);
  });

  it("rejects 0.333 of a roll at 90.5 m because it is not a whole number of thousandths", () => {
    expect(errorCodeOf(() => convertToBaseMilli(333, 90500))).toBe("INEXACT_CONVERSION");
  });

  it("rejects a factor of zero or below", () => {
    expect(errorCodeOf(() => convertToBaseMilli(1000, 0))).toBe("INVALID_FIELD");
    expect(errorCodeOf(() => convertToBaseMilli(1000, -90000))).toBe("INVALID_FIELD");
  });

  it("rejects a factor that is not a whole number", () => {
    expect(errorCodeOf(() => convertToBaseMilli(1000, 90000.5))).toBe("INVALID_FIELD");
  });

  it("rejects a quantity of zero, below zero or with a fraction of a thousandth", () => {
    expect(errorCodeOf(() => convertToBaseMilli(0, 90000))).toBe("INVALID_QUANTITY");
    expect(errorCodeOf(() => convertToBaseMilli(-1000, 90000))).toBe("INVALID_QUANTITY");
    expect(errorCodeOf(() => convertToBaseMilli(1000.5, 90000))).toBe("INVALID_QUANTITY");
  });

  it("rejects a result above the safe integer limit", () => {
    expect(errorCodeOf(() => convertToBaseMilli(Number.MAX_SAFE_INTEGER, 2000))).toBe(
      "INVALID_QUANTITY",
    );
  });

  it("checks the exact product, not a rounded one, for a large quantity", () => {
    // 9,007,199,254,740 x 1000 / 1000 is exactly 9,007,199,254,740 (below the limit).
    expect(convertToBaseMilli(9_007_199_254_740, 1000)).toBe(9_007_199_254_740);
  });
});
