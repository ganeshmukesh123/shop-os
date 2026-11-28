import { BillingService } from "../../src/main/services/BillingService";
import { TintService } from "../../src/main/services/tinting";
import type { TestDb } from "../helpers/testDb";
import { tintShop } from "../helpers/tintShop";

/**
 * Spec 002 T068, quickstart scenario 3 step 6 (SC-004): after 20 tinted sales the base and
 * colorant stock equal the formula totals to the millilitre. The sales mix 1 to 3 cans, two
 * shades, a formula change part way, a repeat of an old line and one cancelled bill.
 */
const stockOf = (testDb: TestDb, variantId: string) =>
  (
    testDb.sqlite.prepare("select stock_milli from item_variant where id = ?").get(variantId) as {
      stock_milli: number;
    }
  ).stock_milli;

const movementTotal = (testDb: TestDb, variantId: string) =>
  (
    testDb.sqlite
      .prepare(
        "select coalesce(sum(case when to_location_id is not null then qty_base_milli else -qty_base_milli end), 0) as total from stock_movement where variant_id = ?",
      )
      .get(variantId) as { total: number }
  ).total;

describe("20 tinted sales (spec 002 T068, SC-004)", () => {
  it("leave base, Blue and Black stock equal to the formula totals, to the millilitre", () => {
    const { testDb, pastel4l, blue, black } = tintShop();
    const tints = new TintService(testDb.db, testDb.ctx);
    const billing = new BillingService(testDb.db, testDb.ctx);
    const shade = (shadeName: string, blueMilli: number, blackMilli: number) =>
      tints.saveCustomShade({
        shadeName,
        customerLabel: "Sharma",
        baseVariantId: pastel4l.id,
        lines: [
          { colorantVariantId: blue.id, qtyMilli: blueMilli },
          { colorantVariantId: black.id, qtyMilli: blackMilli },
        ],
      });
    const sky = shade("Sky Blue", 12_500, 750);
    const grey = shade("Dove Grey", 2_250, 4_000);
    const start = [pastel4l.id, blue.id, black.id].map((id) => stockOf(testDb, id));
    const expected = { cans: 0, blueMilli: 0, blackMilli: 0 };
    let formulaNow = sky.formula;
    let firstSkyLine = "";

    for (let sale = 1; sale <= 20; sale += 1) {
      if (sale === 11) {
        formulaNow = tints.saveVersion({
          shadeId: sky.shade.id,
          baseVariantId: pastel4l.id,
          lines: [
            { colorantVariantId: blue.id, qtyMilli: 13_000 },
            { colorantVariantId: black.id, qtyMilli: 500 },
          ],
        }).formula;
      }
      const cans = (sale % 3) + 1;
      const isGrey = sale % 4 === 0;
      const isRepeat = sale === 15;
      const tint = isRepeat
        ? { sourceBillLineId: firstSkyLine }
        : { formulaId: isGrey ? grey.formula.id : formulaNow.id };
      // A repeat mixes the first Sky Blue line's saved amounts (version 1)
      const ordinaryMix = isGrey ? grey.formula : formulaNow;
      const mix = isRepeat ? sky.formula : ordinaryMix;
      const saved = billing.saveBill({
        clientBillId: `0193b5a2-7c1e-7d3a-8f00-${String(700 + sale).padStart(12, "0")}`,
        paymentMode: "cash",
        billDiscountPaise: 0,
        lines: [
          {
            itemId: pastel4l.id,
            quantityMilli: cans * 1_000,
            ratePaise: 151_000,
            lineDiscountPaise: 0,
            tint,
          },
        ],
      });
      firstSkyLine = firstSkyLine || saved.lines[0]!.id;
      const isCancelled = sale === 7;
      if (isCancelled) billing.cancelBill({ id: saved.bill.id, reason: "Wrong shade" });
      const counted = isCancelled ? 0 : cans;
      expected.cans += counted;
      expected.blueMilli += counted * mix.lines[0]!.qtyMilli;
      expected.blackMilli += counted * mix.lines[1]!.qtyMilli;
    }

    const used = [pastel4l.id, blue.id, black.id].map(
      (variantId, variantIndex) => start[variantIndex]! - stockOf(testDb, variantId),
    );
    expect(used).toEqual([expected.cans * 1_000, expected.blueMilli, expected.blackMilli]);
    // The cached stock is the sum of the movements (constitution: stock is the sum of movements)
    expect([pastel4l.id, blue.id, black.id].map((id) => movementTotal(testDb, id))).toEqual(
      [pastel4l.id, blue.id, black.id].map((id) => stockOf(testDb, id)),
    );
  });
});
