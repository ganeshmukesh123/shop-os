import { CoreError } from "@shopos/core";
import { insertCatalogueRow } from "../../../../tests/helpers/catalogueRows";
import { createTestDb, type TestDb } from "../../../../tests/helpers/testDb";
import { BillingService } from "../BillingService";
import { InventoryService } from "../InventoryService";
import { MergeService } from "./MergeService";

/**
 * Spec 002 T042, merge half (research D6): merging B into survivor A moves stock with one
 * merge_out and one merge_in per location and batch, moves noncolliding barcodes and names, points
 * B at A and deactivates it, and never changes a saved bill line.
 */
function shop() {
  const testDb = createTestDb();
  const inventory = new InventoryService(testDb.db, testDb.ctx);
  const create = (name: string, openingQtyMilli: number, unit = "pcs") =>
    inventory.createItem({ name, unit, pricePaise: 12_000, openingQtyMilli }).item;
  const survivor = create("PVC Pipe 1 inch", 10_000);
  const merged = create("Pipe PVC one inch", 4_000);
  const refreshed: string[][] = [];
  const merges = new MergeService(testDb.db, testDb.ctx, {
    refreshAfterMerge: (survivorId, mergedId) => refreshed.push([survivorId, mergedId]),
  });
  return { testDb, create, survivor, merged, merges, refreshed };
}

const stockOf = (testDb: TestDb, variantId: string) =>
  (
    testDb.sqlite.prepare("select stock_milli from item_variant where id = ?").get(variantId) as {
      stock_milli: number;
    }
  ).stock_milli;

const mergeMovements = (testDb: TestDb) =>
  testDb.sqlite
    .prepare(
      `select movement_type, variant_id, qty_base_milli, from_location_id, to_location_id, doc_type, doc_id
       from stock_movement where movement_type in ('merge_in', 'merge_out') order by movement_type, from_location_id, to_location_id`,
    )
    .all() as Record<string, unknown>[];

const locationOf = (testDb: TestDb, kind: string) =>
  (testDb.sqlite.prepare("select id from location where kind = ?").get(kind) as { id: string }).id;

function codeOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (caughtError) {
    if (caughtError instanceof CoreError) return caughtError.code;
    throw caughtError;
  }
  return undefined;
}

describe("MergeService.merge: stock (spec 002 T042)", () => {
  it("merges B (4) into A (10): A 14, B 0, through one merge_out and one merge_in on item_merge", () => {
    const { testDb, survivor, merged, merges } = shop();

    const { mergeLog } = merges.merge({
      survivorId: survivor.id,
      mergedId: merged.id,
      reason: "Entered twice",
    });

    const shopFloor = locationOf(testDb, "shop_floor");
    expect([stockOf(testDb, survivor.id), stockOf(testDb, merged.id)]).toEqual([14_000, 0]);
    expect(mergeMovements(testDb)).toEqual([
      {
        movement_type: "merge_in",
        variant_id: survivor.id,
        qty_base_milli: 4_000,
        from_location_id: null,
        to_location_id: shopFloor,
        doc_type: "item_merge",
        doc_id: mergeLog.id,
      },
      {
        movement_type: "merge_out",
        variant_id: merged.id,
        qty_base_milli: 4_000,
        from_location_id: shopFloor,
        to_location_id: null,
        doc_type: "item_merge",
        doc_id: mergeLog.id,
      },
    ]);
  });

  it("moves each location separately: 3 on the shop floor and 1 in the godown give two pairs", () => {
    const { testDb, survivor, merges, create } = shop();
    const godown = insertCatalogueRow(testDb.sqlite, "location", {
      name: "Godown",
      kind: "godown",
    });
    const split = create("Pipe split stock", 3_000);
    testDb.sqlite
      .prepare(
        `insert into stock_movement (id, business_id, shop_id, created_at, updated_at, variant_id, movement_type,
           qty_base_milli, to_location_id, note, occurred_at, device_id)
         values ('godown-in', ?, ?, 1, 1, ?, 'adjustment', 1000, ?, 'Stock count', 1, 'device')`,
      )
      .run(testDb.ctx.businessId, testDb.ctx.shopId, split.id, godown);
    testDb.sqlite.prepare("update item_variant set stock_milli = 4000 where id = ?").run(split.id);

    merges.merge({ survivorId: survivor.id, mergedId: split.id, reason: "Entered twice" });

    // One pair per location; the order of locations depends on their ids, so compare as sets
    const pairs = mergeMovements(testDb).map(
      (movement) => `${movement.movement_type} ${String(movement.qty_base_milli)}`,
    );
    expect(pairs.sort()).toEqual([
      "merge_in 1000",
      "merge_in 3000",
      "merge_out 1000",
      "merge_out 3000",
    ]);
    expect(stockOf(testDb, survivor.id)).toBe(14_000);
  });

  it("moves negative stock the other way: B at -2 takes 2 from A", () => {
    const { testDb, survivor, merged, merges } = shop();
    testDb.sqlite
      .prepare(
        `insert into stock_movement (id, business_id, shop_id, created_at, updated_at, variant_id, movement_type,
           qty_base_milli, from_location_id, note, occurred_at, device_id)
         values ('oversold', ?, ?, 1, 1, ?, 'adjustment', 6000, ?, 'Sold before entry', 1, 'device')`,
      )
      .run(testDb.ctx.businessId, testDb.ctx.shopId, merged.id, locationOf(testDb, "shop_floor"));
    testDb.sqlite
      .prepare("update item_variant set stock_milli = -2000 where id = ?")
      .run(merged.id);

    merges.merge({ survivorId: survivor.id, mergedId: merged.id, reason: "Entered twice" });

    expect([stockOf(testDb, survivor.id), stockOf(testDb, merged.id)]).toEqual([8_000, 0]);
    expect(
      mergeMovements(testDb).map((movement) => [movement.movement_type, movement.variant_id]),
    ).toEqual([
      ["merge_in", merged.id],
      ["merge_out", survivor.id],
    ]);
  });
});

describe("MergeService.merge: the variant, its codes and its bills (spec 002 T042)", () => {
  it("points B at A, makes it inactive, leaves its bill lines alone and tells search", () => {
    const { testDb, survivor, merged, merges, refreshed } = shop();
    new BillingService(testDb.db, testDb.ctx).saveBill({
      clientBillId: "0193b5a2-7c1e-7d3a-8f00-000000000099",
      paymentMode: "cash",
      billDiscountPaise: 0,
      lines: [{ itemId: merged.id, quantityMilli: 1_000, ratePaise: 12_000, lineDiscountPaise: 0 }],
    });

    const { survivor: after } = merges.merge({
      survivorId: survivor.id,
      mergedId: merged.id,
      reason: "Entered twice",
    });

    expect(after.id).toBe(survivor.id);
    expect(
      testDb.sqlite
        .prepare("select merged_into_id, is_active from item_variant where id = ?")
        .get(merged.id),
    ).toEqual({
      merged_into_id: survivor.id,
      is_active: 0,
    });
    expect(testDb.sqlite.prepare("select variant_id from bill_line").get()).toEqual({
      variant_id: merged.id,
    });
    expect(refreshed).toEqual([[survivor.id, merged.id]]);
  });

  it("moves B's noncolliding barcode and name to A and keeps colliding ones on B", () => {
    const { testDb, survivor, merged, merges } = shop();
    const row = (table: string, variantId: string, columns: Record<string, unknown>) =>
      insertCatalogueRow(testDb.sqlite, table, { variant_id: variantId, ...columns });
    row("item_barcode", survivor.id, { code: "SHARED", source: "manufacturer" });
    const sharedOnB = row("item_barcode", merged.id, { code: "SHARED", source: "shop_label" });
    const ownOfB = row("item_barcode", merged.id, { code: "B-ONLY", source: "shop_label" });
    row("item_search_name", survivor.id, { name: "nali", language: "hinglish", kind: "alias" });
    const nameClash = row("item_search_name", merged.id, {
      name: "NALI",
      language: "hi",
      kind: "spelling",
    });
    const ownName = row("item_search_name", merged.id, {
      name: "paip",
      language: "hinglish",
      kind: "alias",
    });

    const { mergeLog } = merges.merge({
      survivorId: survivor.id,
      mergedId: merged.id,
      reason: "Entered twice",
    });

    const ownerOf = (table: string, rowId: string) =>
      (
        testDb.sqlite.prepare(`select variant_id from ${table} where id = ?`).get(rowId) as {
          variant_id: string;
        }
      ).variant_id;
    expect([ownerOf("item_barcode", ownOfB), ownerOf("item_barcode", sharedOnB)]).toEqual([
      survivor.id,
      merged.id,
    ]);
    expect([ownerOf("item_search_name", ownName), ownerOf("item_search_name", nameClash)]).toEqual([
      survivor.id,
      merged.id,
    ]);
    expect([mergeLog.movedBarcodeIds, mergeLog.movedSearchNameIds]).toEqual([[ownOfB], [ownName]]);
  });

  it("gives A the batches of B, with their MRP, so A's oldest batch can be B's", () => {
    const { testDb, survivor, merged, merges } = shop();
    const oldBatch = insertCatalogueRow(testDb.sqlite, "item_batch", {
      variant_id: merged.id,
      mrp_paise: 15_000,
      received_at: 1,
    });
    insertCatalogueRow(testDb.sqlite, "item_batch", {
      variant_id: survivor.id,
      mrp_paise: 16_000,
      received_at: 5,
    });

    const { mergeLog } = merges.merge({
      survivorId: survivor.id,
      mergedId: merged.id,
      reason: "Entered twice",
    });

    expect(
      testDb.sqlite
        .prepare(
          "select id, mrp_paise from item_batch where variant_id = ? order by received_at limit 1",
        )
        .get(survivor.id),
    ).toEqual({ id: oldBatch, mrp_paise: 15_000 });
    expect(mergeLog.movedBatchIds).toEqual([oldBatch]);
  });
});

describe("MergeService.merge: refusals (spec 002 T042)", () => {
  it("refuses different base units, the same item, an empty reason and an item already merged", () => {
    const { survivor, merged, merges, create } = shop();
    const wire = create("Copper wire", 1_000, "metre");

    expect(
      codeOf(() => merges.merge({ survivorId: survivor.id, mergedId: wire.id, reason: "x" })),
    ).toBe("UNIT_MISMATCH");
    expect(
      codeOf(() => merges.merge({ survivorId: survivor.id, mergedId: survivor.id, reason: "x" })),
    ).toBe("SAME_ITEM");
    expect(
      codeOf(() => merges.merge({ survivorId: survivor.id, mergedId: merged.id, reason: "  " })),
    ).toBe("REASON_REQUIRED");
    merges.merge({ survivorId: survivor.id, mergedId: merged.id, reason: "Entered twice" });
    expect(
      codeOf(() => merges.merge({ survivorId: survivor.id, mergedId: merged.id, reason: "again" })),
    ).toBe("ALREADY_MERGED");
  });
});
