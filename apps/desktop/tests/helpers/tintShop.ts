import { FamilyService } from "../../src/main/services/families";
import { createTestDb } from "./testDb";

/**
 * Quickstart scenario 3's shop (spec 002 US3): base "Royale" in Pastel 4 L and White 1 L, and
 * colorants Blue and Black in ml. Prices: Pastel 4 L ₹1,450.00, Blue ₹2.40 per ml to buy.
 */
const PAINT_FIELDS = {
  petroleumClass: "B",
  sealedPackOnly: true,
  tradeLabel: null,
  warrantyMonths: null,
  isSerialTracked: false,
} as const;

export function tintShop() {
  const testDb = createTestDb();
  const families = new FamilyService(testDb.db, testDb.ctx);
  const royale = families.create({
    family: { name: "Royale", kind: "base_paint", spec: {}, axisKeys: ["base_type", "pack_size"] },
    variants: [
      {
        axes: { base_type: "Pastel", pack_size: "4 L" },
        declaredQtyMilli: 4_000,
        sellingPricePaise: 145_000,
      },
      {
        axes: { base_type: "White", pack_size: "1 L" },
        declaredQtyMilli: 1_000,
        sellingPricePaise: 40_000,
      },
    ].map((variant) => ({
      ...variant,
      ...PAINT_FIELDS,
      baseUom: "pcs",
      allowDecimal: false,
      openingQtyMilli: 10_000,
      declaredUom: "litre",
    })),
  });
  const colorant = (name: string) =>
    families.create({
      family: { name, kind: "colorant", spec: {}, axisKeys: [] },
      variants: [
        {
          ...PAINT_FIELDS,
          sealedPackOnly: false,
          axes: {},
          baseUom: "ml",
          allowDecimal: true,
          sellingPricePaise: 300,
          openingQtyMilli: 1_000_000,
          declaredQtyMilli: 1_000_000,
          declaredUom: "ml",
        },
      ],
    }).variants[0]!;
  const [pastel4l, white1l] = royale.variants;
  return {
    testDb,
    families,
    royale: royale.family,
    pastel4l: pastel4l!,
    white1l: white1l!,
    blue: colorant("Blue"),
    black: colorant("Black"),
  };
}
