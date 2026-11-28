import { CoreError } from "@shopos/core";
import { insertCatalogueRow } from "../../../../tests/helpers/catalogueRows";
import { createTestDb, type TestDb } from "../../../../tests/helpers/testDb";
import { InventoryService } from "../InventoryService";
import { MergeService, REVERSAL_WINDOW_MS } from "./MergeService";

/** Spec 002 T042, reversal half (research D6): a merge undone within 30 days, once, newest first. */
const DAY_MS = 24 * 60 * 60 * 1000;

function mergedShop() {
  const testDb = createTestDb();
  const inventory = new InventoryService(testDb.db, testDb.ctx);
  const create = (name: string, openingQtyMilli: number) =>
    inventory.createItem({ name, unit: "pcs", pricePaise: 12_000, openingQtyMilli }).item;
  const survivor = create("PVC Pipe 1 inch", 10_000);
  const merged = create("Pipe PVC one inch", 4_000);
  const ownBarcode = insertCatalogueRow(testDb.sqlite, "item_barcode", {
    variant_id: merged.id,
    code: "B-ONLY",
    source: "shop_label",
  });
  const batch = insertCatalogueRow(testDb.sqlite, "item_batch", {
    variant_id: merged.id,
    mrp_paise: 15_000,
    received_at: 1,
  });
  const merges = new MergeService(testDb.db, testDb.ctx);
  const { mergeLog } = merges.merge({
    survivorId: survivor.id,
    mergedId: merged.id,
    reason: "Entered twice",
  });
  return { testDb, create, survivor, merged, merges, mergeLog, ownBarcode, batch };
}

const stockOf = (testDb: TestDb, variantId: string) =>
  (
    testDb.sqlite.prepare("select stock_milli from item_variant where id = ?").get(variantId) as {
      stock_milli: number;
    }
  ).stock_milli;

const ownerOf = (testDb: TestDb, table: string, rowId: string) =>
  (
    testDb.sqlite.prepare(`select variant_id from ${table} where id = ?`).get(rowId) as {
      variant_id: string;
    }
  ).variant_id;

function codeOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (caughtError) {
    if (caughtError instanceof CoreError) return caughtError.code;
    throw caughtError;
  }
  return undefined;
}

describe("MergeService.reverse (spec 002 T042)", () => {
  it("within 30 days puts back A 10 and B 4, B active again, and writes a reverse row", () => {
    const { testDb, survivor, merged, merges, mergeLog } = mergedShop();

    const { reverseLog } = merges.reverse({ mergeLogId: mergeLog.id, reason: "Merged by mistake" });

    expect([stockOf(testDb, survivor.id), stockOf(testDb, merged.id)]).toEqual([10_000, 4_000]);
    expect(
      testDb.sqlite
        .prepare("select merged_into_id, is_active from item_variant where id = ?")
        .get(merged.id),
    ).toEqual({ merged_into_id: null, is_active: 1 });
    expect(reverseLog).toMatchObject({ action: "reverse", mergeLogId: mergeLog.id });
  });

  it("gives back the moved barcode and the batch, with its MRP", () => {
    const { testDb, merged, merges, mergeLog, ownBarcode, batch } = mergedShop();

    merges.reverse({ mergeLogId: mergeLog.id, reason: "Merged by mistake" });

    expect(ownerOf(testDb, "item_barcode", ownBarcode)).toBe(merged.id);
    expect(ownerOf(testDb, "item_batch", batch)).toBe(merged.id);
  });

  it("refuses on day 31 with REVERSAL_WINDOW_CLOSED, and a second reversal with ALREADY_REVERSED", () => {
    const { merges, mergeLog } = mergedShop();
    const dayThirtyOne = new Date(mergeLog.createdAt + REVERSAL_WINDOW_MS + DAY_MS);

    expect(
      codeOf(() => merges.reverse({ mergeLogId: mergeLog.id, reason: "late" }, dayThirtyOne)),
    ).toBe("REVERSAL_WINDOW_CLOSED");
    merges.reverse({ mergeLogId: mergeLog.id, reason: "Merged by mistake" });
    expect(codeOf(() => merges.reverse({ mergeLogId: mergeLog.id, reason: "again" }))).toBe(
      "ALREADY_REVERSED",
    );
  });

  it("needs a chain undone newest first: B into A, then A into C, then A's merge can't go first", () => {
    const { survivor, merges, mergeLog, create } = mergedShop();
    const third = create("Pipe 1 in supreme", 1_000);
    merges.merge({ survivorId: third.id, mergedId: survivor.id, reason: "Entered twice" });

    expect(codeOf(() => merges.reverse({ mergeLogId: mergeLog.id, reason: "x" }))).toBe(
      "SURVIVOR_MERGED",
    );
  });

  it("undoes a chain newest first: A out of C, then B out of A, back to 10, 4 and 1", () => {
    const { testDb, survivor, merged, merges, mergeLog, create } = mergedShop();
    const third = create("Pipe 1 in supreme", 1_000);
    const later = merges.merge({ survivorId: third.id, mergedId: survivor.id, reason: "Again" });

    merges.reverse({ mergeLogId: later.mergeLog.id, reason: "Merged by mistake" });
    merges.reverse({ mergeLogId: mergeLog.id, reason: "Merged by mistake" });

    expect([survivor.id, merged.id, third.id].map((id) => stockOf(testDb, id))).toEqual([
      10_000, 4_000, 1_000,
    ]);
  });

  it("keeps a colliding barcode on B and A's own row on A through merge and reversal", () => {
    const testDb = createTestDb();
    const inventory = new InventoryService(testDb.db, testDb.ctx);
    const create = (name: string) =>
      inventory.createItem({ name, unit: "pcs", pricePaise: 100, openingQtyMilli: 0 }).item;
    const [survivor, merged] = [create("Elbow 1 inch"), create("Elbow one inch")];
    const barcode = (variantId: string, source: string) =>
      insertCatalogueRow(testDb.sqlite, "item_barcode", {
        variant_id: variantId,
        code: "890123",
        source,
      });
    const onSurvivor = barcode(survivor.id, "manufacturer");
    const onMerged = barcode(merged.id, "shop_label");
    const merges = new MergeService(testDb.db, testDb.ctx);
    const { mergeLog } = merges.merge({
      survivorId: survivor.id,
      mergedId: merged.id,
      reason: "Twice",
    });

    merges.reverse({ mergeLogId: mergeLog.id, reason: "Merged by mistake" });

    expect(
      testDb.sqlite
        .prepare("select id, variant_id, source from item_barcode order by source")
        .all(),
    ).toEqual([
      { id: onSurvivor, variant_id: survivor.id, source: "manufacturer" },
      { id: onMerged, variant_id: merged.id, source: "shop_label" },
    ]);
  });

  it("needs a reason and a merge that exists", () => {
    const { merges, mergeLog } = mergedShop();

    expect(codeOf(() => merges.reverse({ mergeLogId: mergeLog.id, reason: " " }))).toBe(
      "REASON_REQUIRED",
    );
    expect(codeOf(() => merges.reverse({ mergeLogId: "no-such-merge", reason: "x" }))).toBe(
      "NOT_FOUND",
    );
  });
});
