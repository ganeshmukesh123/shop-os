import { InventoryService } from "../../src/main/services/InventoryService";
import { createTestDb } from "../helpers/testDb";

// SC-003: item search shows results in under half a second with 5,000 items.
describe("search performance", () => {
  it("searches 5,000 items in under 0.5 s", () => {
    const testDb = createTestDb();
    const insertFamily = testDb.sqlite.prepare(
      `insert into item_family (id, business_id, shop_id, created_at, updated_at, name)
       values (?, ?, ?, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ?)`,
    );
    const insertVariant = testDb.sqlite.prepare(
      `insert into item_variant (id, business_id, shop_id, created_at, updated_at, family_id, item_code, display_name, base_uom, allow_decimal, selling_price_paise, stock_milli, is_active)
       values (?, ?, ?, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', ?, ?, ?, 'pcs', 0, 100, 1000, 1)`,
    );
    testDb.sqlite.transaction(() => {
      for (let itemIndex = 0; itemIndex < 5000; itemIndex++) {
        const itemName = `Item ${itemIndex} ${itemIndex % 7 === 0 ? "pipe" : "bolt"} size ${itemIndex % 40}`;
        const { businessId, shopId } = testDb.ctx;
        insertFamily.run(`family-${itemIndex}`, businessId, shopId, itemName);
        insertVariant.run(
          `id-${itemIndex}`,
          businessId,
          shopId,
          `family-${itemIndex}`,
          `ITM-${itemIndex + 1}`,
          itemName,
        );
      }
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
