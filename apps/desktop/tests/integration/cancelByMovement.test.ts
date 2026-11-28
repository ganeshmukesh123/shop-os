import { BillingService } from "../../src/main/services/BillingService";
import { InventoryService } from "../../src/main/services/InventoryService";
import { TintService } from "../../src/main/services/tinting";
import type { TestDb } from "../helpers/testDb";
import { tintShop } from "../helpers/tintShop";

/**
 * Spec 002 T057 (contracts: "bills.cancel reverses every sale movement of the bill"): a tinted
 * bill's colorants go back too, so stock returns exactly; a 001 bill cancels as before.
 */
const stockOf = (testDb: TestDb, variantId: string) =>
  (
    testDb.sqlite.prepare("select stock_milli from item_variant where id = ?").get(variantId) as {
      stock_milli: number;
    }
  ).stock_milli;

const movementsOf = (testDb: TestDb, billId: string) =>
  testDb.sqlite
    .prepare(
      "select movement_type, variant_id, qty_base_milli from stock_movement where doc_id = ? order by movement_type, qty_base_milli",
    )
    .all(billId);

describe("bills.cancel by movement (spec 002 T057)", () => {
  it("writes one sale_cancel per sale, base and colorants, and puts the stock back exactly", () => {
    const { testDb, pastel4l, blue, black } = tintShop();
    const { formula } = new TintService(testDb.db, testDb.ctx).saveCustomShade({
      shadeName: "Sky Blue",
      customerLabel: "Sharma",
      baseVariantId: pastel4l.id,
      lines: [
        { colorantVariantId: blue.id, qtyMilli: 12_500 },
        { colorantVariantId: black.id, qtyMilli: 750 },
      ],
    });
    const billing = new BillingService(testDb.db, testDb.ctx);
    const before = [pastel4l.id, blue.id, black.id].map((id) => stockOf(testDb, id));
    const { bill } = billing.saveBill({
      clientBillId: "0193b5a2-7c1e-7d3a-8f00-000000000501",
      paymentMode: "cash",
      billDiscountPaise: 0,
      lines: [
        {
          itemId: pastel4l.id,
          quantityMilli: 2_000,
          ratePaise: 151_000,
          lineDiscountPaise: 0,
          tint: { formulaId: formula.id },
        },
      ],
    });

    billing.cancelBill({ id: bill.id, reason: "Wrong shade" });

    expect(movementsOf(testDb, bill.id)).toEqual([
      { movement_type: "sale", variant_id: black.id, qty_base_milli: 1_500 },
      { movement_type: "sale", variant_id: pastel4l.id, qty_base_milli: 2_000 },
      { movement_type: "sale", variant_id: blue.id, qty_base_milli: 25_000 },
      { movement_type: "sale_cancel", variant_id: black.id, qty_base_milli: 1_500 },
      { movement_type: "sale_cancel", variant_id: pastel4l.id, qty_base_milli: 2_000 },
      { movement_type: "sale_cancel", variant_id: blue.id, qty_base_milli: 25_000 },
    ]);
    expect([pastel4l.id, blue.id, black.id].map((id) => stockOf(testDb, id))).toEqual(before);
  });

  it("still cancels a plain bill with one sale_cancel per line", () => {
    const { testDb } = tintShop();
    const tape = new InventoryService(testDb.db, testDb.ctx).createItem({
      name: "Teflon tape",
      unit: "pcs",
      pricePaise: 2_000,
      openingQtyMilli: 10_000,
    }).item;
    const billing = new BillingService(testDb.db, testDb.ctx);
    const { bill } = billing.saveBill({
      clientBillId: "0193b5a2-7c1e-7d3a-8f00-000000000502",
      paymentMode: "cash",
      billDiscountPaise: 0,
      lines: [{ itemId: tape.id, quantityMilli: 3_000, ratePaise: 2_000, lineDiscountPaise: 0 }],
    });

    billing.cancelBill({ id: bill.id, reason: "Customer left" });

    expect(movementsOf(testDb, bill.id)).toEqual([
      { movement_type: "sale", variant_id: tape.id, qty_base_milli: 3_000 },
      { movement_type: "sale_cancel", variant_id: tape.id, qty_base_milli: 3_000 },
    ]);
    expect(stockOf(testDb, tape.id)).toBe(10_000);
  });
});
