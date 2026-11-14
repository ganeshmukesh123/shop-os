import { describe, expect, it } from "vitest";
import {
  assertQuantity,
  defaultAllowsDecimal,
  formatQuantity,
  isValidQuantity,
  parseQuantity,
  UNITS,
} from "../src/quantity";

describe("quantity", () => {
  it("lists the built-in units", () => {
    expect(UNITS).toEqual(["pcs", "metre", "kg", "litre", "box"]);
  });

  it("defaults decimal on for metre, kg, litre only", () => {
    expect(defaultAllowsDecimal("metre")).toBe(true);
    expect(defaultAllowsDecimal("kg")).toBe(true);
    expect(defaultAllowsDecimal("litre")).toBe(true);
    expect(defaultAllowsDecimal("pcs")).toBe(false);
    expect(defaultAllowsDecimal("box")).toBe(false);
    expect(defaultAllowsDecimal("bundle")).toBe(false);
  });

  it("parses decimal strings to thousandths", () => {
    expect(parseQuantity("2")).toBe(2000);
    expect(parseQuantity("2.5")).toBe(2500);
    expect(parseQuantity("0.001")).toBe(1);
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("x")).toBeNull();
    expect(parseQuantity("1.2345")).toBeNull();
    expect(parseQuantity("-1")).toBeNull();
  });

  it("pcs rejects 2.5 but metre accepts it", () => {
    expect(isValidQuantity(2500, false)).toBe(false);
    expect(isValidQuantity(2000, false)).toBe(true);
    expect(isValidQuantity(2500, true)).toBe(true);
  });

  it("rejects non-integer thousandths", () => {
    expect(isValidQuantity(1.5, true)).toBe(false);
  });

  it("formats trimming trailing zeros", () => {
    expect(formatQuantity(2500)).toBe("2.5");
    expect(formatQuantity(2000)).toBe("2");
    expect(formatQuantity(1)).toBe("0.001");
    expect(formatQuantity(-1500)).toBe("-1.5");
    expect(formatQuantity(1234567)).toBe("1234.567");
  });
});

describe("quantity edge cases", () => {
  it("accepts a whole quantity for any unit and a thousandths quantity for decimal units", () => {
    expect(() => assertQuantity(2000, false)).not.toThrow();
    expect(() => assertQuantity(2500, true)).not.toThrow();
  });

  it("explains why a fraction is refused for a whole-number unit", () => {
    expect(() => assertQuantity(1500, false)).toThrowError("this unit accepts whole numbers only");
  });

  it("explains why a non-integer thousandths value is refused for a decimal unit", () => {
    expect(() => assertQuantity(1.5, true)).toThrowError(
      "quantity must be a whole number of thousandths",
    );
  });

  it("treats NaN and values beyond the safe integer range as invalid", () => {
    expect(isValidQuantity(Number.NaN, true)).toBe(false);
    expect(isValidQuantity(Number.MAX_SAFE_INTEGER + 2, true)).toBe(false);
  });

  it("returns null for a quantity text too large to hold exactly", () => {
    expect(parseQuantity("99999999999999999")).toBeNull();
  });
});
