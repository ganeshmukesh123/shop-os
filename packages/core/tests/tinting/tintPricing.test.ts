import { tintChargeFor, tintLinePrice } from "../../src/tinting/tintPricing";

/** Spec 002 T055 (FR-015, research D11): what a tinted can is sold for. */
const CHARGES = [
  { packQtyMilli: 1_000, chargePaise: 2_000 },
  { packQtyMilli: 4_000, chargePaise: 6_000 },
];

describe("tintLinePrice (spec 002 T055)", () => {
  it("is the base price plus the pack's tint charge: ₹1,450.00 + ₹60.00 = ₹1,510.00", () => {
    expect(
      tintLinePrice({ basePricePaise: 145_000, shadePricePaise: null, tintChargePaise: 6_000 }),
    ).toEqual({ unitPricePaise: 151_000, tintChargePaise: 6_000 });
  });

  it("uses a shade price of ₹1,550.00 when there is one, and adds no charge", () => {
    expect(
      tintLinePrice({ basePricePaise: 145_000, shadePricePaise: 155_000, tintChargePaise: 6_000 }),
    ).toEqual({ unitPricePaise: 155_000, tintChargePaise: 0 });
  });

  it("adds nothing when the pack size has no charge", () => {
    expect(
      tintLinePrice({ basePricePaise: 145_000, shadePricePaise: null, tintChargePaise: null }),
    ).toEqual({ unitPricePaise: 145_000, tintChargePaise: 0 });
  });
});

describe("tintChargeFor (spec 002 T055)", () => {
  it("finds the charge for the pack's declared size, or none", () => {
    expect(tintChargeFor(4_000, CHARGES)).toBe(6_000);
    expect(tintChargeFor(10_000, CHARGES)).toBeNull();
  });
});
