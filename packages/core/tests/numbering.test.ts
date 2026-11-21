import {
  DEFAULT_NUMBER_TEMPLATE,
  financialYear,
  formatBillNumber,
  validateNumberTemplate,
} from "../src/numbering";

describe("numbering", () => {
  it("financial year runs 1 April to 31 March", () => {
    expect(financialYear(new Date(2026, 3, 1))).toBe("26-27");
    expect(financialYear(new Date(2027, 2, 31))).toBe("26-27");
    expect(financialYear(new Date(2027, 3, 1))).toBe("27-28");
    expect(financialYear(new Date(2026, 11, 7))).toBe("26-27");
    expect(financialYear(new Date(2026, 0, 15))).toBe("25-26");
    expect(financialYear(new Date(2099, 5, 1))).toBe("99-00");
  });

  it("builds the number from template, series, year and sequence", () => {
    expect(formatBillNumber(DEFAULT_NUMBER_TEMPLATE, "C1", "26-27", 123)).toBe("C1/26-27/000123");
    expect(formatBillNumber("{seq}", "C1", "26-27", 123)).toBe("000123");
    expect(formatBillNumber("{series}-{seq}", "A", "26-27", 5)).toBe("A-000005");
  });

  it("is at most 16 characters", () => {
    expect(
      formatBillNumber(DEFAULT_NUMBER_TEMPLATE, "C1", "26-27", 999999).length,
    ).toBeLessThanOrEqual(16);
  });

  it("rejects a template that can exceed 16 characters", () => {
    expect(validateNumberTemplate(DEFAULT_NUMBER_TEMPLATE, "C1").ok).toBe(true);
    expect(validateNumberTemplate("{series}/{fy}/{seq}", "COUNTER1").ok).toBe(false);
    expect(validateNumberTemplate("SHOP-INVOICE/{seq}", "C1").ok).toBe(false);
  });

  it("rejects templates without a sequence or with illegal characters", () => {
    expect(validateNumberTemplate("{series}/{fy}", "C1").ok).toBe(false);
    expect(validateNumberTemplate("{seq} #", "C1").ok).toBe(false);
    expect(validateNumberTemplate("{seq}", "C 1").ok).toBe(false);
  });

  it("throws when the sequence overflows the padded width", () => {
    expect(() => formatBillNumber("{seq}", "C1", "26-27", 1_000_000)).toThrow();
  });
});

describe("the template preview takes its financial year from the shop's zone (FR-019a)", () => {
  // 00:10 IST on 1 April 2027 is 18:40 UTC on 31 March.
  const justAfterMidnightInIndia = new Date(Date.UTC(2027, 2, 31, 18, 40));

  it("shows 27-28 for a shop in India at that moment", () => {
    const validation = validateNumberTemplate(
      DEFAULT_NUMBER_TEMPLATE,
      "C1",
      justAfterMidnightInIndia,
      "Asia/Kolkata",
    );

    expect(validation).toEqual({ ok: true, example: "C1/27-28/000001" });
  });

  it("shows 26-27 for a shop in Los Angeles at the same moment", () => {
    const validation = validateNumberTemplate(
      DEFAULT_NUMBER_TEMPLATE,
      "C1",
      justAfterMidnightInIndia,
      "America/Los_Angeles",
    );

    expect(validation).toEqual({ ok: true, example: "C1/26-27/000001" });
  });

  it("uses the shop's default zone when none is given", () => {
    const validation = validateNumberTemplate(
      DEFAULT_NUMBER_TEMPLATE,
      "C1",
      justAfterMidnightInIndia,
    );

    expect(validation).toEqual({ ok: true, example: "C1/27-28/000001" });
  });
});

describe("numbering edge cases", () => {
  it("refuses a sequence below 1 or a fractional sequence", () => {
    const template = DEFAULT_NUMBER_TEMPLATE;
    expect(() => formatBillNumber(template, "C1", "26-27", 0)).toThrowError(
      "sequence must be 1 or more",
    );
    expect(() => formatBillNumber(template, "C1", "26-27", -3)).toThrowError(
      "sequence must be 1 or more",
    );
    expect(() => formatBillNumber(template, "C1", "26-27", 2.5)).toThrowError(
      "sequence must be 1 or more",
    );
  });
});
