import { describe, expect, it } from "vitest";
import { InventoryService } from "../../src/main/services/InventoryService";
import { createTestDb } from "../helpers/testDb";

// SC-003: item search shows results in under half a second with 5,000 items.
describe("search performance", () => {
  it("searches 5,000 items in under 0.5 s", () => {
    const testDb = createTestDb();
    const insert = testDb.sqlite.prepare(
      `insert into item (id, business_id, shop_id, created_at, updated_at, name, unit, allows_decimal, price_paise, stock_milli, active)
       values (?, ?, ?, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ?, 'pcs', 0, 100, 1000, 1)`,
    );
    testDb.sqlite.transaction(() => {
      for (let itemIndex = 0; itemIndex < 5000; itemIndex++)
        insert.run(
          `id-${itemIndex}`,
          testDb.ctx.businessId,
          testDb.ctx.shopId,
          `Item ${itemIndex} ${itemIndex % 7 === 0 ? "pipe" : "bolt"} size ${itemIndex % 40}`,
        );
    })();
    const inv = new InventoryService(testDb.db, testDb.ctx);
    const started = performance.now();
    const listResult = inv.listItems({ query: "pip", limit: 8, offset: 0 });
    const ms = performance.now() - started;
    console.log(`search over 5,000 items: ${ms.toFixed(1)} ms (${listResult.total} matches)`);
    expect(listResult.total).toBeGreaterThan(0);
    expect(ms).toBeLessThan(500);
  });
});
