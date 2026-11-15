import { ItemRepository } from "../../src/main/repositories/ItemRepository";
import { StockRepository } from "../../src/main/repositories/StockRepository";
import { createTestDb, type TestDb } from "../helpers/testDb";

let testDb: TestDb;
let items: ItemRepository;
let stock: StockRepository;

beforeEach(() => {
  testDb = createTestDb();
  items = new ItemRepository(testDb.db, testDb.ctx);
  stock = new StockRepository(testDb.db, testDb.ctx);
});

const createItem = (name: string, unit = "pcs") =>
  items.create({ name, unit, allowsDecimal: false, pricePaise: 10000 });
const LIST_EVERYTHING = { limit: 50, offset: 0 };

describe("ItemRepository.update", () => {
  it("deactivates an item, which then leaves the default list", () => {
    const pipe = createItem("Pipe");
    expect(items.update(pipe.id, { active: false })?.active).toBe(false);
    expect(items.list(LIST_EVERYTHING).items).toHaveLength(0);
    expect(items.list({ ...LIST_EVERYTHING, includeInactive: true }).items).toHaveLength(1);
  });

  it("reactivates a deactivated item", () => {
    const pipe = createItem("Pipe");
    items.update(pipe.id, { active: false });
    expect(items.update(pipe.id, { active: true })?.active).toBe(true);
  });

  it("changes whether an item accepts decimal quantities", () => {
    const wire = createItem("Wire", "metre");
    expect(items.update(wire.id, { allowsDecimal: true })?.allowsDecimal).toBe(true);
    expect(items.update(wire.id, { allowsDecimal: false })?.allowsDecimal).toBe(false);
  });

  it("returns null for an item that does not exist", () => {
    expect(items.update("missing", { name: "Anything" })).toBeNull();
  });
});

describe("ItemRepository.list and counts", () => {
  it("lists nothing, with a total of 0, on an empty shop", () => {
    expect(items.list(LIST_EVERYTHING)).toEqual({ items: [], total: 0 });
  });

  it("counts only active items with negative stock as needing correction", () => {
    const activeNegative = createItem("Active negative");
    const inactiveNegative = createItem("Inactive negative");
    const healthy = createItem("Healthy");
    items.addStockDelta(activeNegative.id, -1000);
    items.addStockDelta(inactiveNegative.id, -1000);
    items.addStockDelta(healthy.id, 5000);
    items.update(inactiveNegative.id, { active: false });
    expect(items.countNeedingCorrection()).toBe(1);
  });
});

describe("StockRepository.sumForItem", () => {
  it("adds the movements of one item and ignores other items", () => {
    const pipe = createItem("Pipe");
    const wire = createItem("Wire");
    stock.append({ itemId: pipe.id, quantityMilli: 10000, reason: "opening" });
    stock.append({ itemId: pipe.id, quantityMilli: -2500, reason: "sale" });
    stock.append({ itemId: wire.id, quantityMilli: 999, reason: "opening" });
    expect(stock.sumForItem(pipe.id)).toBe(7500);
  });

  it("is 0 for an item with no movements", () => {
    expect(stock.sumForItem(createItem("Pipe").id)).toBe(0);
  });
});

describe("ItemRepository: one family and one variant per item (research D18)", () => {
  interface IVariantRow {
    id: string;
    family_id: string;
    item_code: string;
  }
  const readVariants = () =>
    testDb.sqlite
      .prepare("select id, family_id, item_code from item_variant order by item_code")
      .all() as IVariantRow[];

  it("gives each new item its own family and the next item code", () => {
    const pipe = createItem("Pipe");
    const wire = createItem("Wire");

    const variantRows = readVariants();

    expect(variantRows.map((variantRow) => variantRow.item_code)).toEqual(["ITM-0001", "ITM-0002"]);
    expect(variantRows.map((variantRow) => variantRow.id)).toEqual([pipe.id, wire.id]);
    const familyNames = testDb.sqlite.prepare("select name from item_family order by name").all();
    expect(familyNames).toEqual([{ name: "Pipe" }, { name: "Wire" }]);
    expect(new Set(variantRows.map((variantRow) => variantRow.family_id)).size).toBe(2);
  });

  it("keeps counting after the highest code, past four digits", () => {
    createItem("Pipe");
    testDb.sqlite.prepare("update item_variant set item_code = 'ITM-9999'").run();

    createItem("Wire");

    expect(readVariants().map((variantRow) => variantRow.item_code)).toEqual([
      "ITM-10000",
      "ITM-9999",
    ]);
  });

  it("renames the family together with the item", () => {
    const pipe = createItem("Pipe");

    items.update(pipe.id, { name: "PVC Pipe" });

    expect(testDb.sqlite.prepare("select name from item_family").all()).toEqual([
      { name: "PVC Pipe" },
    ]);
  });

  it("refuses two variants with the same item code in one business", () => {
    createItem("Pipe");
    createItem("Wire");

    const duplicateCode = () =>
      testDb.sqlite.prepare("update item_variant set item_code = 'ITM-0001'").run();

    expect(duplicateCode).toThrowError(/UNIQUE/);
  });
});
