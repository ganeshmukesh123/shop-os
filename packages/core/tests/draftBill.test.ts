import { describe, expect, it } from "vitest";
import { evaluateDraft, parsePercentBp, type DraftBill, type DraftLine } from "../src/draftBill";

const line = (over: Partial<DraftLine> = {}): DraftLine => ({
  key: "k",
  itemId: "i1",
  name: "Pipe",
  unit: "pcs",
  allowsDecimal: false,
  qty: "1",
  rate: "100",
  disc: "",
  discMode: "rupees",
  ...over,
});
const bill = (lines: DraftLine[], over: Partial<DraftBill> = {}): DraftBill => ({
  lines,
  billDisc: "",
  billDiscMode: "rupees",
  ...over,
});

describe("parsePercentBp", () => {
  it("parses up to two decimals into basis points", () => {
    expect(parsePercentBp("10")).toBe(1000);
    expect(parsePercentBp("12.5")).toBe(1250);
    expect(parsePercentBp("0.25")).toBe(25);
    expect(parsePercentBp("100")).toBe(10000);
    expect(parsePercentBp("100.01")).toBeNull();
    expect(parsePercentBp("abc")).toBeNull();
    expect(parsePercentBp("-5")).toBeNull();
    expect(parsePercentBp("1.234")).toBeNull();
  });
});

describe("evaluateDraft", () => {
  it("totals update as quantity and rate change", () => {
    const evaluation = evaluateDraft(
      bill([
        line({ qty: "3", rate: "49.50" }),
        line({ key: "b", qty: "2.5", rate: "10", allowsDecimal: true, unit: "metre" }),
      ]),
    );
    expect(evaluation.valid).toBe(true);
    expect(evaluation.lines.map((lineResult) => lineResult.amountPaise)).toEqual([14850, 2500]);
    expect(evaluation.linesTotalPaise).toBe(17350);
    expect(evaluation.grandTotalPaise).toBe(17350);
    expect(evaluation.input).toEqual([
      { itemId: "i1", quantityMilli: 3000, ratePaise: 4950, lineDiscountPaise: 0 },
      { itemId: "i1", quantityMilli: 2500, ratePaise: 1000, lineDiscountPaise: 0 },
    ]);
  });

  it("applies rupee and percent discounts on lines and the bill", () => {
    const evaluation = evaluateDraft(
      bill(
        [
          line({ qty: "2", rate: "100", disc: "10", discMode: "percent" }),
          line({ key: "b", qty: "1", rate: "50", disc: "5" }),
        ],
        { billDisc: "10", billDiscMode: "percent" },
      ),
    );
    // line1 20000 - 2000 = 18000; line2 5000 - 500 = 4500; total 22500; 10% = 2250
    expect(evaluation.linesTotalPaise).toBe(22500);
    expect(evaluation.billDiscountPaise).toBe(2250);
    expect(evaluation.grandTotalPaise).toBe(20250);
  });

  it("flags invalid input instead of throwing", () => {
    expect(evaluateDraft(bill([])).valid).toBe(false);
    expect(evaluateDraft(bill([line({ qty: "0" })])).lines[0]!.error).toMatch(/quantity/i);
    expect(evaluateDraft(bill([line({ qty: "2.5" })])).lines[0]!.error).toMatch(/whole/i);
    expect(evaluateDraft(bill([line({ qty: "" })])).valid).toBe(false);
    expect(evaluateDraft(bill([line({ rate: "x" })])).lines[0]!.error).toMatch(/rate|price/i);
    expect(evaluateDraft(bill([line({ disc: "101" })])).lines[0]!.error).toMatch(/discount/i);
    expect(evaluateDraft(bill([line()], { billDisc: "101" })).errors.join()).toMatch(/discount/i);
  });

  it("a zero rate is allowed (free item); discount may equal the amount", () => {
    expect(evaluateDraft(bill([line({ rate: "0" })])).valid).toBe(true);
    expect(evaluateDraft(bill([line({ disc: "100" })])).grandTotalPaise).toBe(0);
  });
});
