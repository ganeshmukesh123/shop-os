import { evaluateDraft, type DraftLine } from "../src/draftBill";

/** Spec 002 T064: a tinted can on the bill being made is sent with its tint to bills.save. */
const SKY_BLUE_CAN: DraftLine = {
  key: "line-1",
  itemId: "royale-pastel-4l",
  name: "Royale Pastel 4 L",
  unit: "pcs",
  allowsDecimal: false,
  qty: "2",
  rate: "1510",
  disc: "",
  discMode: "rupees",
  tint: { formulaId: "sky-v1" },
  tintLabel: "Sky Blue: Blue 12.5 ml, Black 0.75 ml",
};

describe("evaluateDraft with a tinted can (spec 002 T064)", () => {
  it("sends the tint with the line and prices it at the rate shown", () => {
    const evaluation = evaluateDraft({
      lines: [SKY_BLUE_CAN],
      billDisc: "",
      billDiscMode: "rupees",
    });

    expect(evaluation.input).toEqual([
      {
        itemId: "royale-pastel-4l",
        quantityMilli: 2_000,
        ratePaise: 151_000,
        lineDiscountPaise: 0,
        tint: { formulaId: "sky-v1" },
      },
    ]);
    expect(evaluation.grandTotalPaise).toBe(302_000);
  });

  it("sends a repeat by its source line", () => {
    const repeat = { ...SKY_BLUE_CAN, qty: "1", tint: { sourceBillLineId: "line-earlier" } };

    expect(
      evaluateDraft({ lines: [repeat], billDisc: "", billDiscMode: "rupees" }).input?.[0]?.tint,
    ).toEqual({
      sourceBillLineId: "line-earlier",
    });
  });
});
