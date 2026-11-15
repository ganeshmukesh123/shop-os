import { CoreError } from "../src/errors";
import {
  addPaise,
  assertPaise,
  formatRupees,
  mulQtyRate,
  paiseToInput,
  parseRupees,
  percentOfPaise,
  roundBillTotal,
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

/** The error code a rule throws, or "none" when it does not throw. */
const errorCodeOf = (rule: () => unknown): string => {
  try {
    rule();
    return "none";
  } catch (caughtError) {
    return caughtError instanceof CoreError ? caughtError.code : "other";
  }
};

describe("money edge cases", () => {
  it("rejects a negative or fractional percent in basis points", () => {
    expect(errorCodeOf(() => percentOfPaise(100, -1))).toBe("INVALID_DISCOUNT");
    expect(errorCodeOf(() => percentOfPaise(100, 12.5))).toBe("INVALID_DISCOUNT");
  });

  it("rejects a negative or fractional quantity when multiplying by a rate", () => {
    expect(errorCodeOf(() => mulQtyRate(-1000, 100))).toBe("INVALID_QUANTITY");
    expect(errorCodeOf(() => mulQtyRate(1.5, 100))).toBe("INVALID_QUANTITY");
  });

  it("rejects a negative rate and a fractional rate", () => {
    expect(errorCodeOf(() => mulQtyRate(1000, -1))).toBe("INVALID_AMOUNT");
    expect(errorCodeOf(() => mulQtyRate(1000, 0.5))).toBe("INVALID_AMOUNT");
  });

  it("rejects an amount too large to hold exactly", () => {
    const largest = Number.MAX_SAFE_INTEGER;
    expect(errorCodeOf(() => mulQtyRate(largest, largest))).toBe("INVALID_AMOUNT");
  });

  it("turns paise into a form-field string with two decimals", () => {
    expect(paiseToInput(123450)).toBe("1234.50");
    expect(paiseToInput(5)).toBe("0.05");
    expect(paiseToInput(0)).toBe("0.00");
  });

  it("refuses fractional paise when making a form-field string", () => {
    expect(errorCodeOf(() => paiseToInput(10.5))).toBe("INVALID_AMOUNT");
  });

  it("returns null for a rupee amount too large to hold exactly", () => {
    expect(parseRupees("99999999999999999999")).toBeNull();
  });
});

describe("roundBillTotal (FR-010a, research D20)", () => {
  it("rounds 49 paise and below down, with a negative round-off", () => {
    expect(roundBillTotal(84949, true)).toEqual({ roundOffPaise: -49, roundedTotalPaise: 84900 });
  });

  it("rounds 50 paise exactly up (half up)", () => {
    expect(roundBillTotal(84950, true)).toEqual({ roundOffPaise: 50, roundedTotalPaise: 85000 });
  });

  it("rounds 60 paise up, with a positive round-off", () => {
    expect(roundBillTotal(84960, true)).toEqual({ roundOffPaise: 40, roundedTotalPaise: 85000 });
  });

  it("changes nothing when the total is already whole rupees", () => {
    const result = roundBillTotal(85000, true);
    expect(result.roundedTotalPaise).toBe(85000);
    expect(Object.is(result.roundOffPaise, 0)).toBe(true);
  });

  it("gives a round-off of 0 when rounding is off", () => {
    expect(roundBillTotal(84960, false)).toEqual({ roundOffPaise: 0, roundedTotalPaise: 84960 });
  });

  it("handles a total of zero and a single paisa", () => {
    expect(roundBillTotal(0, true).roundedTotalPaise).toBe(0);
    expect(roundBillTotal(1, true)).toEqual({ roundOffPaise: -1, roundedTotalPaise: 0 });
  });

  it("always satisfies total + round-off = rounded total", () => {
    for (let totalPaise = 0; totalPaise <= 300; totalPaise += 1) {
      const { roundOffPaise, roundedTotalPaise } = roundBillTotal(totalPaise, true);
      expect(totalPaise + roundOffPaise).toBe(roundedTotalPaise);
      expect(roundedTotalPaise % 100).toBe(0);
      expect(Math.abs(roundOffPaise)).toBeLessThanOrEqual(50);
    }
  });

  it("rejects rounding that exceeds the safe integer limit", () => {
    expect(errorCodeOf(() => roundBillTotal(Number.MAX_SAFE_INTEGER, true))).toBe("INVALID_AMOUNT");
  });

  it("preserves the maximum safe total when rounding is off", () => {
    expect(roundBillTotal(Number.MAX_SAFE_INTEGER, false)).toEqual({
      roundOffPaise: 0,
      roundedTotalPaise: Number.MAX_SAFE_INTEGER,
    });
  });

  it("rejects a negative or fractional total", () => {
    expect(errorCodeOf(() => roundBillTotal(-1, true))).toBe("INVALID_AMOUNT");
    expect(errorCodeOf(() => roundBillTotal(10.5, true))).toBe("INVALID_AMOUNT");
  });
});
