import { evaluateDraft, type DraftLine } from "../src/draftBill";

/**
 * Spec 002 T039: a bill line typed in an alternate unit. 2 rolls of wire at 90 m a roll, at
 * ₹25.00 a metre, is 180 m and ₹4,500.00; the line shows "2 roll (180 m)".
 */
const WIRE: DraftLine = {
  key: "line-1",
  itemId: "wire",
  name: "Copper Wire",
  unit: "metre",
  allowsDecimal: true,
  qty: "2",
  rate: "25",
  disc: "",
  discMode: "rupees",
  conversions: [{ uomCode: "roll", factorMilli: 90_000 }],
  enteredUom: "roll",
};

const evaluate = (line: DraftLine) =>
  evaluateDraft({ lines: [line], billDisc: "", billDiscMode: "rupees" });

describe("evaluateDraft with an alternate unit (spec 002 T039)", () => {
  it("bills 2 rolls as 180 m at the rate per metre", () => {
    const evaluation = evaluate(WIRE);

    expect(evaluation.lines[0]).toEqual({
      amountPaise: 450_000,
      error: null,
      baseQtyMilli: 180_000,
    });
    expect(evaluation.input).toEqual([
      {
        itemId: "wire",
        quantityMilli: 180_000,
        ratePaise: 2_500,
        lineDiscountPaise: 0,
        enteredUom: "roll",
        qtyEnteredMilli: 2_000,
      },
    ]);
  });

  it("refuses a roll quantity that does not come out in whole thousandths of a metre", () => {
    const evaluation = evaluate({
      ...WIRE,
      qty: "0.333",
      conversions: [{ uomCode: "roll", factorMilli: 90_500 }],
    });

    expect(evaluation.valid).toBe(false);
    expect(evaluation.lines[0]!.error).toMatch(/whole number of thousandths/);
  });

  it("bills in the base unit when no other unit is chosen, as before", () => {
    const evaluation = evaluate({ ...WIRE, enteredUom: null, qty: "5" });

    expect(evaluation.lines[0]).toEqual({ amountPaise: 12_500, error: null, baseQtyMilli: 5_000 });
    expect(evaluation.input![0]).toEqual({
      itemId: "wire",
      quantityMilli: 5_000,
      ratePaise: 2_500,
      lineDiscountPaise: 0,
    });
  });

  it("refuses a chosen unit the item has no conversion for", () => {
    const evaluation = evaluate({ ...WIRE, enteredUom: "box" });

    expect(evaluation.lines[0]!.error).toBe("This item is not sold in box");
  });

  it("checks whole numbers against the base unit: half a box of 5 pcs is 2.5 pcs, refused", () => {
    const evaluation = evaluate({
      ...WIRE,
      unit: "pcs",
      allowsDecimal: false,
      qty: "0.5",
      conversions: [{ uomCode: "box", factorMilli: 5_000 }],
      enteredUom: "box",
    });

    expect(evaluation.lines[0]!.error).toBe("This unit accepts whole numbers only");
  });
});
