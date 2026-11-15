import { upgradeDatabaseWithOneBill } from "../helpers/upgradeFixture";

/** Task T074 (migrations 0005 and 0006): an existing shop's items move into family and variant. */
describe("upgrading items from migration 0004 (research D18)", () => {
  it("turns Pipe into one family and one variant with the same id and stock", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const variantRow = sqlite
      .prepare(
        "select id, family_id, item_code, display_name, base_uom, stock_milli from item_variant",
      )
      .get();
    const familyRow = sqlite.prepare("select id, name from item_family").get();

    expect(variantRow).toEqual({
      id: "item-1",
      family_id: "item-1",
      item_code: "ITM-0001",
      display_name: "Pipe",
      base_uom: "pcs",
      stock_milli: 8000,
    });
    expect(familyRow).toEqual({ id: "item-1", name: "Pipe" });
  });

  it("drops the old item table", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const oldTable = sqlite.prepare("select name from sqlite_master where name = 'item'").get();

    expect(oldTable).toBeUndefined();
  });

  it("keeps the bill line and the stock movements pointing at the same product", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const lineRow = sqlite
      .prepare("select item_id, quantity_milli, amount_paise from bill_line")
      .get();
    const movementRows = sqlite
      .prepare("select item_id, quantity_milli, reason from stock_movement order by quantity_milli")
      .all();

    expect(lineRow).toEqual({ item_id: "item-1", quantity_milli: 2000, amount_paise: 24000 });
    expect(movementRows).toEqual([
      { item_id: "item-1", quantity_milli: -2000, reason: "sale" },
      { item_id: "item-1", quantity_milli: 10000, reason: "opening" },
    ]);
  });

  it("keeps the immutability triggers on the rebuilt tables", () => {
    const sqlite = upgradeDatabaseWithOneBill();
    const attempts = [
      "update bill_line set amount_paise = 1",
      "delete from bill_line",
      "update stock_movement set quantity_milli = 5",
      "delete from stock_movement",
    ];

    const failures = attempts.map((statement) => {
      try {
        sqlite.prepare(statement).run();
        return "allowed";
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    });

    expect(failures).toEqual([
      "bill_line is immutable",
      "bill_line is immutable",
      "stock_movement is append-only",
      "stock_movement is append-only",
    ]);
  });

  it("leaves no broken reference and a healthy file", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    expect(sqlite.pragma("integrity_check", { simple: true })).toBe("ok");
  });
});
