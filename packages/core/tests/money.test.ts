import { describe, expect, it } from "vitest";
import {
  addPaise,
  assertPaise,
  formatRupees,
  mulQtyRate,
  parseRupees,
  percentOfPaise,
  subPaise,
} from "../src/money";

describe("money", () => {
  it("adds and subtracts integer paise", () => {
    expect(addPaise(150, 275)).toBe(425);
    expect(subPaise(500, 125)).toBe(375);
  });

  it("rejects non-integer paise", () => {
    expect(() => assertPaise(1.5)).toThrow();
    expect(() => addPaise(1.2, 3)).toThrow();
    expect(() => assertPaise(Number.NaN)).toThrow();
  });

  it("percent discount rounds to nearest paisa, half up", () => {
    // 10% of 1005 paise = 100.5 -> 101
    expect(percentOfPaise(1005, 1000)).toBe(101);
    // 12.5% of 100 = 12.5 -> 13
    expect(percentOfPaise(100, 1250)).toBe(13);
    // 12.4% of 100 = 12.4 -> 12
    expect(percentOfPaise(100, 1240)).toBe(12);
    expect(percentOfPaise(0, 1000)).toBe(0);
    expect(percentOfPaise(10000, 10000)).toBe(10000);
  });

  it("multiplies quantity (thousandths) by rate with half-up rounding", () => {
    expect(mulQtyRate(2000, 5000)).toBe(10000); // 2 x 50.00
    expect(mulQtyRate(2500, 1000)).toBe(2500); // 2.5 x 10.00
    expect(mulQtyRate(1, 500)).toBe(1); // 0.001 x 5.00 = 0.5 paise -> 1
    expect(mulQtyRate(1, 499)).toBe(0); // 0.499 -> 0
    expect(mulQtyRate(3333, 100)).toBe(333); // 333.3 -> 333
  });

  it("does not lose precision for large values", () => {
    expect(mulQtyRate(999_999_000, 99_999_999)).toBe(99_999_899_000_001);
  });

  it("formats with Indian grouping", () => {
    expect(formatRupees(0)).toBe("₹0.00");
    expect(formatRupees(5)).toBe("₹0.05");
    expect(formatRupees(12345)).toBe("₹123.45");
    expect(formatRupees(10000000)).toBe("₹1,00,000.00");
    expect(formatRupees(123456789)).toBe("₹12,34,567.89");
    expect(formatRupees(-50000)).toBe("-₹500.00");
  });

  it("parses rupee strings into paise", () => {
    expect(parseRupees("12")).toBe(1200);
    expect(parseRupees("12.5")).toBe(1250);
    expect(parseRupees("12.05")).toBe(1205);
    expect(parseRupees(" 1,234.50 ")).toBe(123450);
    expect(parseRupees("")).toBeNull();
    expect(parseRupees("abc")).toBeNull();
    expect(parseRupees("1.234")).toBeNull();
    expect(parseRupees("-5")).toBeNull();
  });
});
