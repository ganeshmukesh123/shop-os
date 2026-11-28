import { tintCostPaise } from "../../src/tinting/tintCost";

/** Spec 002 T055 (FR-015, research D11): what a tinted can cost the shop. */
describe("tintCostPaise (spec 002 T055)", () => {
  it("is the base purchase price plus Blue at ₹2.40 per ml x 12.5 ml = ₹30.00", () => {
    expect(
      tintCostPaise({
        basePurchasePaise: 110_000,
        colorants: [{ pricePerMlPaise: 240, qtyMilli: 12_500 }],
      }),
    ).toBe(113_000);
  });

  it("rounds half up once over all colorants, not once per colorant", () => {
    // 0.25 ml x ₹0.02 = 0.5 paisa each; twice is 1 paisa, while rounding each would give 2
    expect(
      tintCostPaise({
        basePurchasePaise: 0,
        colorants: [
          { pricePerMlPaise: 2, qtyMilli: 250 },
          { pricePerMlPaise: 2, qtyMilli: 250 },
        ],
      }),
    ).toBe(1);
  });

  it("is the base price alone for a can with no colorant", () => {
    expect(tintCostPaise({ basePurchasePaise: 110_000, colorants: [] })).toBe(110_000);
  });
});
