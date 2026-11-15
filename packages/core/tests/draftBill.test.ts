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

describe("evaluateDraft messages", () => {
  it("flags a line percent discount above 100%", () => {
    const evaluation = evaluateDraft(bill([line({ disc: "150", discMode: "percent" })]));
    expect(evaluation.lines[0]?.error).toBe("Discount % must be 0 to 100");
    expect(evaluation.valid).toBe(false);
  });

  it("flags a line discount that is not a rupee amount", () => {
    const evaluation = evaluateDraft(bill([line({ disc: "abc" })]));
    expect(evaluation.lines[0]?.error).toBe("Enter the discount in rupees");
  });

  it("flags a bill percent discount above 100%", () => {
    const evaluation = evaluateDraft(bill([line()], { billDisc: "150", billDiscMode: "percent" }));
    expect(evaluation.errors).toContain("Bill discount % must be 0 to 100");
  });

  it("flags a bill discount that is not a rupee amount", () => {
    const evaluation = evaluateDraft(bill([line()], { billDisc: "abc" }));
    expect(evaluation.errors).toContain("Enter the bill discount in rupees");
  });

  it("subtracts a valid rupee bill discount from the lines total", () => {
    const evaluation = evaluateDraft(bill([line({ rate: "100" })], { billDisc: "10" }));
    expect(evaluation.billDiscountPaise).toBe(1000);
    expect(evaluation.grandTotalPaise).toBe(9000);
    expect(evaluation.valid).toBe(true);
  });

  it("flags a bill discount larger than the lines total", () => {
    const evaluation = evaluateDraft(bill([line({ rate: "100" })], { billDisc: "101" }));
    expect(evaluation.errors).toContain("Bill discount cannot be more than the total");
  });

  it("asks for at least one item on an empty draft", () => {
    const evaluation = evaluateDraft(bill([]));
    expect(evaluation.errors).toContain("Add at least one item");
    expect(evaluation.valid).toBe(false);
  });

  it("points at the lines to fix when any line is invalid", () => {
    const evaluation = evaluateDraft(bill([line({ qty: "0" })]));
    expect(evaluation.errors).toContain("Fix the highlighted lines");
  });
});

describe("evaluateDraft never throws", () => {
  it("reports an amount too large to hold as a line error instead of throwing", () => {
    const hugeLine = line({ qty: "9000000000000", rate: "9000000000000" });
    const evaluate = () => evaluateDraft(bill([hugeLine]));
    expect(evaluate).not.toThrow();
    expect(evaluate().valid).toBe(false);
  });
});
