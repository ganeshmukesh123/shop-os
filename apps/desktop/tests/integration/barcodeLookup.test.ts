import { BarcodeService } from "../../src/main/services/barcode";
import { InventoryService } from "../../src/main/services/InventoryService";
import { MergeService } from "../../src/main/services/merge";
import { insertCatalogueRow } from "../helpers/catalogueRows";
import { createTestDb, type TestDb } from "../helpers/testDb";

/**
 * Spec 002 T043 (research D7, data-model survivor rule): a code on two variants returns both and
 * logs one duplicate_barcode issue per code, not one per scan; a code retained on a merged variant
 * returns its final survivor.
 */
function shop() {
  const testDb = createTestDb();
  const inventory = new InventoryService(testDb.db, testDb.ctx);
  const create = (name: string) =>
    inventory.createItem({ name, unit: "pcs", pricePaise: 4_500, openingQtyMilli: 0 }).item;
  const addCode = (variantId: string, code: string, source = "manufacturer") =>
    insertCatalogueRow(testDb.sqlite, "item_barcode", { variant_id: variantId, code, source });
  return { testDb, create, addCode, barcodes: new BarcodeService(testDb.db, testDb.ctx) };
}

const openIssues = (testDb: TestDb) =>
  testDb.sqlite
    .prepare("select kind, detail, subject_ids from exception_event where status = 'open'")
    .all() as { kind: string; detail: string; subject_ids: string }[];

describe("items.lookupBarcode (spec 002 T043)", () => {
  it("returns the one item a code is on, with no data issue", () => {
    const { testDb, create, addCode, barcodes } = shop();
    const elbow = create("Elbow 1 inch");
    addCode(elbow.id, "8901234567890");

    expect(barcodes.lookup("8901234567890").variants.map((item) => item.id)).toEqual([elbow.id]);
    expect(openIssues(testDb)).toEqual([]);
  });

  it("returns both items for a shared code and logs one issue however often it is scanned", () => {
    const { testDb, create, addCode, barcodes } = shop();
    const [first, second] = [create("Elbow 1 inch"), create("Elbow 1 inch grey")];
    addCode(first.id, "8901234567890");
    addCode(second.id, "8901234567890", "shop_label");

    const found = barcodes.lookup("8901234567890");
    barcodes.lookup("8901234567890");

    expect(found.variants.map((item) => item.id).sort()).toEqual([first.id, second.id].sort());
    expect(openIssues(testDb)).toEqual([
      {
        kind: "duplicate_barcode",
        detail: "8901234567890",
        subject_ids: JSON.stringify([first.id, second.id].sort()),
      },
    ]);
  });

  it("follows every merge: B into A and A into C, B's retained code returns C", () => {
    const { testDb, create, addCode, barcodes } = shop();
    const [itemA, itemB, itemC] = [create("Pipe A"), create("Pipe B"), create("Pipe C")];
    addCode(itemA.id, "SHARED-1");
    addCode(itemB.id, "SHARED-1", "shop_label");
    const merges = new MergeService(testDb.db, testDb.ctx);
    merges.merge({ survivorId: itemA.id, mergedId: itemB.id, reason: "Entered twice" });
    merges.merge({ survivorId: itemC.id, mergedId: itemA.id, reason: "Entered twice" });

    expect(barcodes.lookup("SHARED-1").variants.map((item) => item.id)).toEqual([itemC.id]);
  });

  it("returns nothing for an unknown or blank code", () => {
    const { barcodes } = shop();

    expect(barcodes.lookup("0000").variants).toEqual([]);
    expect(barcodes.lookup("   ").variants).toEqual([]);
  });
});
