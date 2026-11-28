import { rebuildItemSalesStats } from "../../src/main/repositories/SalesStatRepository";
import { BillingService } from "../../src/main/services/BillingService";
import { InventoryService } from "../../src/main/services/InventoryService";
import { buildHandlersFixture } from "../helpers/handlersFixture";
import { createTestDb, type TestDb } from "../helpers/testDb";

/**
 * Spec 002 T048 (data-model item_sales_stat): the 90-day sales projection is updated inside the
 * bill-save and cancel transactions, and rebuilding it from bill lines gives the same table.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-28T10:00:00+05:30");

function shop() {
  const testDb = createTestDb();
  const inventory = new InventoryService(testDb.db, testDb.ctx);
  const create = (name: string) =>
    inventory.createItem({ name, unit: "pcs", pricePaise: 4_500, openingQtyMilli: 100_000 }).item;
  const billing = new BillingService(testDb.db, testDb.ctx);
  let billCount = 0;
  const sell = (lines: [string, number][], at = NOW) => {
    billCount += 1;
    return billing.saveBill(
      {
        clientBillId: `0193b5a2-7c1e-7d3a-8f00-${String(billCount).padStart(12, "0")}`,
        paymentMode: "cash",
        billDiscountPaise: 0,
        lines: lines.map(([itemId, quantityMilli]) => ({
          itemId,
          quantityMilli,
          ratePaise: 4_500,
          lineDiscountPaise: 0,
        })),
      },
      at,
    ).bill;
  };
  return { testDb, create, billing, sell };
}

const statsOf = (testDb: TestDb) =>
  testDb.sqlite
    .prepare(
      "select variant_id, sold_qty_90d_milli, bill_count_90d, last_sold_at from item_sales_stat order by variant_id",
    )
    .all();

describe("bills.save and the bill search ranking (spec 002 T048)", () => {
  it("puts the item just sold first for the same query", async () => {
    const { handlers } = buildHandlersFixture();
    const create = async (name: string) => {
      const created = await handlers["items.create"]({
        name,
        unit: "pcs",
        pricePaise: 4_500,
        openingQtyMilli: 10_000,
      });
      if (!created.ok) throw new Error(created.message);
      return created.data.item;
    };
    await create("Elbow 1 inch");
    const grey = await create("Elbow 1 inch grey");

    await handlers["bills.save"]({
      clientBillId: "0193b5a2-7c1e-7d3a-8f00-000000000777",
      paymentMode: "cash",
      billDiscountPaise: 0,
      lines: [{ itemId: grey.id, quantityMilli: 1_000, ratePaise: 4_500, lineDiscountPaise: 0 }],
    });
    const searched = await handlers["items.search"]({ query: "elbow", limit: 5 });

    if (!searched.ok) throw new Error(searched.message);
    expect(searched.data.results[0]?.id).toBe(grey.id);
  });
});

describe("item_sales_stat (spec 002 T048)", () => {
  it("counts each bill once per item and adds up the quantity", () => {
    const { testDb, create, sell } = shop();
    const elbow = create("Elbow 1 inch");

    sell([
      [elbow.id, 2_000],
      [elbow.id, 1_000],
    ]);
    sell([[elbow.id, 3_000]], new Date(NOW.getTime() + 60_000));

    expect(statsOf(testDb)).toEqual([
      {
        variant_id: elbow.id,
        sold_qty_90d_milli: 6_000,
        bill_count_90d: 2,
        last_sold_at: NOW.getTime() + 60_000,
      },
    ]);
  });

  it("takes a cancelled bill back out, including the last sold time", () => {
    const { testDb, create, sell, billing } = shop();
    const elbow = create("Elbow 1 inch");
    sell([[elbow.id, 2_000]]);
    const later = sell([[elbow.id, 3_000]], new Date(NOW.getTime() + 60_000));

    billing.cancelBill({ id: later.id, reason: "Wrong item" }, new Date(NOW.getTime() + 120_000));

    expect(statsOf(testDb)).toEqual([
      {
        variant_id: elbow.id,
        sold_qty_90d_milli: 2_000,
        bill_count_90d: 1,
        last_sold_at: NOW.getTime(),
      },
    ]);
  });

  it("rebuilt from bill lines equals the table kept up by saves and cancels", () => {
    const { testDb, create, sell, billing } = shop();
    const [elbow, pipe, tape] = [
      create("Elbow 1 inch"),
      create("PVC Pipe 1 in"),
      create("Teflon tape"),
    ];
    sell([
      [elbow.id, 2_000],
      [pipe.id, 1_000],
    ]);
    const cancelled = sell(
      [
        [pipe.id, 4_000],
        [tape.id, 1_000],
      ],
      new Date(NOW.getTime() + 1_000),
    );
    sell([[elbow.id, 5_000]], new Date(NOW.getTime() + 2_000));
    billing.cancelBill({ id: cancelled.id, reason: "Customer left" }, NOW);
    const incremental = statsOf(testDb);

    rebuildItemSalesStats(testDb.db, testDb.ctx, NOW);

    expect(statsOf(testDb)).toEqual(incremental);
  });

  it("rebuilds only the last 90 days, and cancelling an older bill never goes below zero", () => {
    const { testDb, create, sell, billing } = shop();
    const elbow = create("Elbow 1 inch");
    const old = sell([[elbow.id, 7_000]], new Date(NOW.getTime() - 100 * DAY_MS));
    sell([[elbow.id, 1_000]]);

    rebuildItemSalesStats(testDb.db, testDb.ctx, NOW);
    billing.cancelBill({ id: old.id, reason: "Found a mistake" }, NOW);

    expect(statsOf(testDb)).toEqual([
      {
        variant_id: elbow.id,
        sold_qty_90d_milli: 1_000,
        bill_count_90d: 1,
        last_sold_at: NOW.getTime(),
      },
    ]);
  });
});
