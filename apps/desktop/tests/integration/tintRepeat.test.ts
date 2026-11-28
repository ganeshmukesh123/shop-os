import { BillingService } from "../../src/main/services/BillingService";
import { TintService } from "../../src/main/services/tinting";
import { tintShop } from "../helpers/tintShop";

/**
 * Spec 002 T058, repeat list (FR-016, contracts tint.repeat.list): a customer's shades, newest
 * first; a billed shade carries its sourceBillLineId and its saved amounts.
 */
function shopWithSharma() {
  const shop = tintShop();
  const tints = new TintService(shop.testDb.db, shop.testDb.ctx);
  const custom = (shadeName: string, qtyMilli: number) =>
    tints.saveCustomShade({
      shadeName,
      customerLabel: "Sharma",
      baseVariantId: shop.pastel4l.id,
      lines: [{ colorantVariantId: shop.blue.id, qtyMilli }],
    });
  const sky = custom("Sky Blue", 12_500);
  custom("Mint", 4_000);
  const billing = new BillingService(shop.testDb.db, shop.testDb.ctx);
  const billed = billing.saveBill(
    {
      clientBillId: "0193b5a2-7c1e-7d3a-8f00-000000000601",
      paymentMode: "cash",
      billDiscountPaise: 0,
      customerName: "Sharma",
      lines: [
        {
          itemId: shop.pastel4l.id,
          quantityMilli: 1_000,
          ratePaise: 145_000,
          lineDiscountPaise: 0,
          tint: { formulaId: sky.formula.id },
        },
      ],
    },
    new Date("2026-11-20T10:00:00+05:30"),
  );
  return { ...shop, tints, sky, billed };
}

describe("tint.repeat.list (spec 002 T058)", () => {
  it('matches "sharma" to Sharma, the billed shade first with its source line and amounts', () => {
    const { tints, billed, pastel4l } = shopWithSharma();

    const { shades } = tints.repeatList({ customerName: "sharma" });

    expect(shades.map((entry) => entry.shade.shadeName)).toEqual(["Sky Blue", "Mint"]);
    expect(shades[0]).toMatchObject({
      sourceBillLineId: billed.lines[0]!.id,
      lastBilledAt: new Date("2026-11-20T10:00:00+05:30").getTime(),
      baseVariant: { id: pastel4l.id },
      lines: [{ qtyMilli: 12_500 }],
    });
    expect(shades[1]!.sourceBillLineId).toBeUndefined();
  });

  it("finds nothing for another customer, and nothing without a name or site", () => {
    const { tints } = shopWithSharma();

    expect(tints.repeatList({ customerName: "Gupta" }).shades).toEqual([]);
    expect(tints.repeatList({}).shades).toEqual([]);
  });
});
