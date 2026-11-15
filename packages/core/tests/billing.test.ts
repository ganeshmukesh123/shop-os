import { computeBill, computeLine, discountFromPercent } from "../src/billing";

describe("billing", () => {
  it("line amount = qty x rate minus line discount", () => {
    expect(computeLine({ quantityMilli: 2000, ratePaise: 5000, lineDiscountPaise: 0 })).toBe(10000);
    expect(computeLine({ quantityMilli: 2500, ratePaise: 1000, lineDiscountPaise: 500 })).toBe(
      2000,
    );
    expect(computeLine({ quantityMilli: 1, ratePaise: 500, lineDiscountPaise: 0 })).toBe(1);
  });

  it("rejects bad lines", () => {
    expect(() => computeLine({ quantityMilli: 0, ratePaise: 100, lineDiscountPaise: 0 })).toThrow();
    expect(() =>
      computeLine({ quantityMilli: -1000, ratePaise: 100, lineDiscountPaise: 0 }),
    ).toThrow();
    expect(() =>
      computeLine({ quantityMilli: 1000, ratePaise: -1, lineDiscountPaise: 0 }),
    ).toThrow();
    expect(() =>
      computeLine({ quantityMilli: 1000, ratePaise: 100, lineDiscountPaise: 101 }),
    ).toThrow();
    expect(() =>
      computeLine({ quantityMilli: 1000, ratePaise: 100, lineDiscountPaise: -1 }),
    ).toThrow();
  });

  it("grand total = lines total minus bill discount", () => {
    const totals = computeBill({
      lines: [
        { quantityMilli: 2000, ratePaise: 5000, lineDiscountPaise: 0 },
        { quantityMilli: 1000, ratePaise: 2550, lineDiscountPaise: 50 },
      ],
      billDiscountPaise: 500,
    });
    expect(totals.lineAmounts).toEqual([10000, 2500]);
    expect(totals.linesTotalPaise).toBe(12500);
    expect(totals.grandTotalPaise).toBe(12000);
  });

  it("rejects empty bill and invalid bill discount", () => {
    expect(() => computeBill({ lines: [], billDiscountPaise: 0 })).toThrow(/at least one line/);
    const lines = [{ quantityMilli: 1000, ratePaise: 1000, lineDiscountPaise: 0 }];
    expect(() => computeBill({ lines, billDiscountPaise: 1001 })).toThrow();
    expect(() => computeBill({ lines, billDiscountPaise: -1 })).toThrow();
    expect(computeBill({ lines, billDiscountPaise: 1000 }).grandTotalPaise).toBe(0);
  });

  it("converts a percent to a discount on an amount", () => {
    expect(discountFromPercent(10000, 1000)).toBe(1000);
    expect(discountFromPercent(1005, 1000)).toBe(101);
  });

  it("matches a 20-bill manual reference set", () => {
    // [qtyMilli, rate, lineDiscount] triples, expected grand total computed by hand
    const refs: { lines: [number, number, number][]; disc: number; total: number }[] = [];
    for (let billIndex = 1; billIndex <= 20; billIndex++) {
      // line1: i units at 10.00*i paise... all values are exact so manual result is easy
      const l1: [number, number, number] = [billIndex * 1000, 1000 + billIndex, 0]; // i x (10.00 + i paise)
      const l2: [number, number, number] = [500, 2000, billIndex]; // 0.5 x 20.00 = 10.00 less i paise
      const total = billIndex * (1000 + billIndex) + (1000 - billIndex) - (billIndex % 3);
      refs.push({ lines: [l1, l2], disc: billIndex % 3, total });
    }
    for (const referenceCase of refs) {
      const out = computeBill({
        lines: referenceCase.lines.map(([quantityMilli, ratePaise, discountPaise]) => ({
          quantityMilli: quantityMilli,
          ratePaise: ratePaise,
          lineDiscountPaise: discountPaise,
        })),
        billDiscountPaise: referenceCase.disc,
      });
      expect(out.grandTotalPaise).toBe(referenceCase.total);
    }
  });
});
