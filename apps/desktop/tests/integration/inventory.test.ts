import { CoreError, checkInvariant } from "@shopos/core";
import { InventoryService } from "../../src/main/services/InventoryService";
import { StockRepository } from "../../src/main/repositories/StockRepository";
import { createTestDb, type TestDb } from "../helpers/testDb";

let testDb: TestDb;
let inv: InventoryService;

beforeEach(() => {
  testDb = createTestDb();
  inv = new InventoryService(testDb.db, testDb.ctx);
});

const code = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (caughtError) {
    return caughtError instanceof CoreError ? caughtError.code : `other:${String(caughtError)}`;
  }
  return undefined;
};

describe("inventory", () => {
  it("create item writes an opening movement and sets stock", () => {
    const { item } = inv.createItem({
      name: "PVC Pipe",
      unit: "metre",
      pricePaise: 12000,
      openingQtyMilli: 25500,
    });
    expect(item.stockMilli).toBe(25500);
    expect(item.allowsDecimal).toBe(true);
    const moves = new StockRepository(testDb.db, testDb.ctx).forItem(item.id);
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ reason: "opening", quantityMilli: 25500 });
  });

  it("zero opening quantity creates the item without a movement", () => {
    const { item } = inv.createItem({
      name: "Nail",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 0,
    });
    expect(item.stockMilli).toBe(0);
    expect(new StockRepository(testDb.db, testDb.ctx).forItem(item.id)).toHaveLength(0);
  });

  it("rejects a duplicate name, case-insensitively, returning the matches", () => {
    inv.createItem({ name: "Elbow 1 inch", unit: "pcs", pricePaise: 5000, openingQtyMilli: 1000 });
    try {
      inv.createItem({
        name: "  ELBOW 1 INCH ",
        unit: "pcs",
        pricePaise: 5000,
        openingQtyMilli: 1000,
      });
      expect.unreachable();
    } catch (caughtError) {
      expect((caughtError as CoreError).code).toBe("DUPLICATE_NAME");
      expect((caughtError as CoreError).details).toHaveLength(1);
    }
  });

  it("allows the same name once the original is deactivated", () => {
    const { item } = inv.createItem({
      name: "Tape",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 1000,
    });
    inv.updateItem({ id: item.id, active: false });
    expect(
      code(() =>
        inv.createItem({ name: "Tape", unit: "pcs", pricePaise: 100, openingQtyMilli: 0 }),
      ),
    ).toBeUndefined();
  });

  it("pcs with 2.5 is INVALID_QUANTITY; metre with 2.5 succeeds", () => {
    expect(
      code(() =>
        inv.createItem({ name: "Bolt", unit: "pcs", pricePaise: 100, openingQtyMilli: 2500 }),
      ),
    ).toBe("INVALID_QUANTITY");
    expect(
      code(() =>
        inv.createItem({ name: "Wire", unit: "metre", pricePaise: 100, openingQtyMilli: 2500 }),
      ),
    ).toBeUndefined();
  });

  it("custom unit may choose to allow decimals", () => {
    const { item } = inv.createItem({
      name: "Sand",
      unit: "bag",
      allowsDecimal: true,
      pricePaise: 100,
      openingQtyMilli: 500,
    });
    expect(item.allowsDecimal).toBe(true);
  });

  it("adjust add and set write movements", () => {
    const { item } = inv.createItem({
      name: "Pipe",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 10000,
    });
    const addResult = inv.adjustStock({
      itemId: item.id,
      mode: "add",
      quantityMilli: 5000,
      note: "delivery",
    });
    expect(addResult.item.stockMilli).toBe(15000);
    expect(addResult.movement).toMatchObject({ reason: "adjustment", quantityMilli: 5000 });
    const setResult = inv.adjustStock({
      itemId: item.id,
      mode: "set",
      quantityMilli: 4000,
      note: "stock count",
    });
    expect(setResult.item.stockMilli).toBe(4000);
    expect(setResult.movement).toMatchObject({ quantityMilli: -11000 });
  });

  it("set to the current value writes no movement", () => {
    const { item } = inv.createItem({
      name: "Pipe",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 3000,
    });
    const adjustResult = inv.adjustStock({
      itemId: item.id,
      mode: "set",
      quantityMilli: 3000,
      note: "count",
    });
    expect(adjustResult.movement).toBeNull();
  });

  it("NOTE_REQUIRED when the note is empty", () => {
    const { item } = inv.createItem({
      name: "Pipe",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 3000,
    });
    expect(
      code(() =>
        inv.adjustStock({ itemId: item.id, mode: "add", quantityMilli: 1000, note: "   " }),
      ),
    ).toBe("NOTE_REQUIRED");
  });

  it("adjust enforces decimal rules and NOT_FOUND", () => {
    const { item } = inv.createItem({
      name: "Pipe",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 3000,
    });
    expect(
      code(() => inv.adjustStock({ itemId: item.id, mode: "add", quantityMilli: 500, note: "x" })),
    ).toBe("INVALID_QUANTITY");
    expect(
      code(() => inv.adjustStock({ itemId: "nope", mode: "add", quantityMilli: 1000, note: "x" })),
    ).toBe("NOT_FOUND");
  });

  it("update edits name, price and unit; duplicate rename rejected", () => {
    const firstItem = inv.createItem({
      name: "A",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 0,
    }).item;
    inv.createItem({ name: "B", unit: "pcs", pricePaise: 100, openingQtyMilli: 0 });
    const updatedItem = inv.updateItem({
      id: firstItem.id,
      name: "A2",
      pricePaise: 250,
      unit: "box",
    }).item;
    expect(updatedItem).toMatchObject({ name: "A2", pricePaise: 250, unit: "box" });
    expect(code(() => inv.updateItem({ id: firstItem.id, name: "b" }))).toBe("DUPLICATE_NAME");
    expect(code(() => inv.updateItem({ id: "nope", name: "Z" }))).toBe("NOT_FOUND");
  });

  it("deactivated item stays queryable and is hidden by default", () => {
    const { item } = inv.createItem({
      name: "Old",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 1000,
    });
    inv.updateItem({ id: item.id, active: false });
    expect(inv.listItems({ limit: 50, offset: 0 }).items).toHaveLength(0);
    const all = inv.listItems({ includeInactive: true, limit: 50, offset: 0 });
    expect(all.items).toHaveLength(1);
    expect(all.items[0]!.active).toBe(false);
  });

  it("searches by partial name, prefix matches first, case-insensitive", () => {
    for (const itemName of ["Water Pipe", "Pipe Elbow", "PIPE Clamp", "Nail"]) {
      inv.createItem({ name: itemName, unit: "pcs", pricePaise: 100, openingQtyMilli: 1000 });
    }
    const listResult = inv.listItems({ query: "pip", limit: 50, offset: 0 });
    expect(listResult.total).toBe(3);
    expect(
      listResult.items
        .map((item) => item.name)
        .slice(0, 2)
        .sort(),
    ).toEqual(["PIPE Clamp", "Pipe Elbow"]);
    expect(listResult.items[2]!.name).toBe("Water Pipe");
  });

  it("search treats % and _ literally", () => {
    inv.createItem({ name: "100% cotton", unit: "pcs", pricePaise: 100, openingQtyMilli: 0 });
    inv.createItem({ name: "Other", unit: "pcs", pricePaise: 100, openingQtyMilli: 0 });
    expect(inv.listItems({ query: "%", limit: 50, offset: 0 }).total).toBe(1);
  });

  it("needsCorrection lists negative stock only", () => {
    const firstItem = inv.createItem({
      name: "A",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 1000,
    }).item;
    inv.createItem({ name: "B", unit: "pcs", pricePaise: 100, openingQtyMilli: 1000 });
    inv.adjustStock({ itemId: firstItem.id, mode: "add", quantityMilli: -3000, note: "oops" });
    const listResult = inv.listItems({ needsCorrection: true, limit: 50, offset: 0 });
    expect(listResult.items.map((item) => item.name)).toEqual(["A"]);
    expect(listResult.items[0]!.needsCorrection).toBe(true);
  });

  it("invariant: cached stock equals the sum of movements", () => {
    const firstItem = inv.createItem({
      name: "A",
      unit: "metre",
      pricePaise: 100,
      openingQtyMilli: 7500,
    }).item;
    const secondItem = inv.createItem({
      name: "B",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 3000,
    }).item;
    inv.adjustStock({ itemId: firstItem.id, mode: "add", quantityMilli: 1250, note: "n" });
    inv.adjustStock({ itemId: secondItem.id, mode: "set", quantityMilli: 10000, note: "n" });
    const items = inv.listItems({ includeInactive: true, limit: 100, offset: 0 }).items;
    const cached = new Map(items.map((item) => [item.id, item.stockMilli]));
    const moves = new StockRepository(testDb.db, testDb.ctx).all();
    expect(checkInvariant(cached, moves)).toEqual([]);
  });

  it("movements are append-only at the database level", () => {
    const { item } = inv.createItem({
      name: "A",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 1000,
    });
    expect(() =>
      testDb.sqlite
        .prepare("update stock_movement set quantity_milli = 5 where item_id = ?")
        .run(item.id),
    ).toThrow(/append-only/);
    expect(() =>
      testDb.sqlite.prepare("delete from stock_movement where item_id = ?").run(item.id),
    ).toThrow(/append-only/);
  });
});
