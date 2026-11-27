import { rankSearchMatches } from "@shopos/core";
import { InventoryService } from "../InventoryService";
import { insertCatalogueRow } from "../../../../tests/helpers/catalogueRows";
import { createTestDb, type TestDb } from "../../../../tests/helpers/testDb";
import { SearchService } from "./SearchService";

/**
 * Spec 002 T023 (research D4): the in-memory search index is built from the database, kept up to
 * date on create, rename, deactivate and merge, and ranks with rankSearchMatches.
 */
function shopWithItems() {
  const testDb = createTestDb();
  const inventory = new InventoryService(testDb.db, testDb.ctx);
  const createItem = (name: string, unit = "pcs") =>
    inventory.createItem({ name, unit, pricePaise: 12_000, openingQtyMilli: 0 }).item;
  return { testDb, inventory, createItem };
}

const ids = (search: SearchService, query: string) =>
  search.search(query).map((result) => result.id);

function addSearchName(testDb: TestDb, variantId: string, name: string): void {
  insertCatalogueRow(testDb.sqlite, "item_search_name", {
    variant_id: variantId,
    name,
    language: "hinglish",
    kind: "alias",
  });
}

describe("SearchService: building the index (spec 002 T023)", () => {
  it("finds items by name, item code, barcode and search name from the database", () => {
    const { testDb, createItem } = shopWithItems();
    const elbow = createItem("Elbow 1 inch");
    const pipe = createItem("PVC Pipe", "metre");
    insertCatalogueRow(testDb.sqlite, "item_barcode", {
      variant_id: elbow.id,
      code: "8901234567890",
      source: "manufacturer",
    });
    addSearchName(testDb, pipe.id, "nali");

    const search = new SearchService(testDb.db, testDb.ctx);

    expect(ids(search, "elbow")).toEqual([elbow.id]);
    expect(ids(search, "8901234567890")).toEqual([elbow.id]);
    expect(ids(search, "nali")).toEqual([pipe.id]);
    expect(search.search("ITM-0002")).toEqual([
      { kind: "variant", id: pipe.id, tier: "code", billCount90d: 0 },
    ]);
  });

  it("ranks exactly as rankSearchMatches does over the same entries", () => {
    const { testDb, createItem } = shopWithItems();
    createItem("Elbow 1 inch");
    createItem("Elbow 2 inch");
    createItem("Bend 1 inch");
    const search = new SearchService(testDb.db, testDb.ctx);

    expect(search.search("elbo 1")).toEqual(
      rankSearchMatches("elbo 1", search.entries(), new Map()),
    );
  });

  it("ranks the item sold on more bills in the last 90 days first, within a tier", () => {
    const { testDb, createItem } = shopWithItems();
    const quiet = createItem("Elbow 1 inch");
    const busy = createItem("Elbow 2 inch");
    insertCatalogueRow(testDb.sqlite, "item_sales_stat", {
      variant_id: busy.id,
      bill_count_90d: 12,
    });

    const search = new SearchService(testDb.db, testDb.ctx);

    expect(ids(search, "elbow")).toEqual([busy.id, quiet.id]);
  });
});

describe("SearchService: keeping the index up to date (spec 002 T023)", () => {
  it("finds an item created after the index was built", () => {
    const { testDb, createItem } = shopWithItems();
    const search = new SearchService(testDb.db, testDb.ctx);
    const tee = createItem("Tee joint");

    search.refreshVariant(tee.id);

    expect(ids(search, "tee")).toEqual([tee.id]);
  });

  it("finds a renamed item by its new name only", () => {
    const { testDb, inventory, createItem } = shopWithItems();
    const elbow = createItem("Elbow 1 inch");
    const search = new SearchService(testDb.db, testDb.ctx);

    inventory.updateItem({ id: elbow.id, name: "Bend 1 inch" });
    search.refreshVariant(elbow.id);

    expect(ids(search, "bend")).toEqual([elbow.id]);
    expect(ids(search, "elbow")).toEqual([]);
  });

  it("drops a deactivated item and brings it back when it is made active again", () => {
    const { testDb, inventory, createItem } = shopWithItems();
    const elbow = createItem("Elbow 1 inch");
    const search = new SearchService(testDb.db, testDb.ctx);

    inventory.updateItem({ id: elbow.id, active: false });
    search.refreshVariant(elbow.id);
    const whileInactive = ids(search, "elbow");
    inventory.updateItem({ id: elbow.id, active: true });
    search.refreshVariant(elbow.id);

    expect(whileInactive).toEqual([]);
    expect(ids(search, "elbow")).toEqual([elbow.id]);
  });

  it("after a merge, finds the survivor by the merged item's retained barcode and name", () => {
    const { testDb, createItem } = shopWithItems();
    const survivor = createItem("PVC Pipe 1 inch");
    const merged = createItem("Pipe PVC one inch");
    insertCatalogueRow(testDb.sqlite, "item_barcode", {
      variant_id: merged.id,
      code: "8907777777777",
      source: "manufacturer",
    });
    addSearchName(testDb, merged.id, "paip");
    const search = new SearchService(testDb.db, testDb.ctx);

    testDb.sqlite
      .prepare("update item_variant set merged_into_id = ?, is_active = 0 where id = ?")
      .run(survivor.id, merged.id);
    search.refreshAfterMerge(survivor.id, merged.id);

    expect(ids(search, "8907777777777")).toEqual([survivor.id]);
    expect(ids(search, "paip")).toEqual([survivor.id]);
    expect(ids(search, "one")).toEqual([]);
  });

  it("follows a chain of merges to the last survivor (B into A, then A into C)", () => {
    const { testDb, createItem } = shopWithItems();
    const itemA = createItem("Socket A");
    const itemB = createItem("Socket B");
    const itemC = createItem("Socket C");
    insertCatalogueRow(testDb.sqlite, "item_barcode", {
      variant_id: itemB.id,
      code: "B-CODE",
      source: "shop_label",
    });
    const merge = testDb.sqlite.prepare(
      "update item_variant set merged_into_id = ?, is_active = 0 where id = ?",
    );
    merge.run(itemA.id, itemB.id);
    merge.run(itemC.id, itemA.id);

    const search = new SearchService(testDb.db, testDb.ctx);

    expect(ids(search, "B-CODE")).toEqual([itemC.id]);
  });
});
