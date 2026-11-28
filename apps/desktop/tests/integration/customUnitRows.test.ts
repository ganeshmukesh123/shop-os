import type Database from "better-sqlite3";
import { openDatabase } from "../../src/main/db/connection";
import { loadCtx } from "../../src/main/db/seed";
import { FamilyService } from "../../src/main/services/families";
import { InventoryService } from "../../src/main/services/InventoryService";
import { MIGRATIONS, createTestDb } from "../helpers/testDb";
import { createDatabaseFileAtMigration0004WithOneBill } from "../helpers/upgradeFixture";

/**
 * Spec 002 data-model.md "uom": a custom unit from 001 (any text up to 20 characters) gets a uom
 * row with dimension count and no UQC (migration 0022), so a family can use it too.
 */
function upgradeShopWithBagItem(allowsDecimal: 0 | 1 = 0) {
  const databasePath = createDatabaseFileAtMigration0004WithOneBill({
    beforeUpgrade: (oldDatabase) =>
      oldDatabase.prepare("update item set unit = 'bag', allows_decimal = ?").run(allowsDecimal),
  });
  const connection = openDatabase(databasePath, { migrationsFolder: MIGRATIONS });
  return { ...connection, ctx: loadCtx(connection.db) };
}

const unitRow = (sqlite: Database.Database, code: string) =>
  sqlite
    .prepare("select code, label, dimension, uqc, allow_decimal from uom where code = ?")
    .get(code);

describe("custom units from 001 (spec 002, migration 0022)", () => {
  it("gives an old item's custom unit a uom row, and the item keeps its unit", () => {
    const { sqlite } = upgradeShopWithBagItem();

    expect(unitRow(sqlite, "bag")).toEqual({
      code: "bag",
      label: "bag",
      dimension: "count",
      uqc: null,
      allow_decimal: 0,
    });
    expect(sqlite.prepare("select base_uom from item_variant").get()).toEqual({ base_uom: "bag" });
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  });

  it("allows decimals on the unit when an old item in it allowed them", () => {
    const { sqlite } = upgradeShopWithBagItem(1);

    expect(unitRow(sqlite, "bag")).toMatchObject({ allow_decimal: 1 });
  });

  it("lets a new family use the old custom unit", () => {
    const { db, ctx } = upgradeShopWithBagItem();

    const { variants } = new FamilyService(db, ctx).create({
      family: { name: "Cement OPC", kind: "general", spec: {}, axisKeys: [] },
      variants: [
        {
          axes: {},
          baseUom: "bag",
          allowDecimal: false,
          sellingPricePaise: 38_000,
          openingQtyMilli: 0,
          sealedPackOnly: false,
          isSerialTracked: false,
        },
      ],
    });

    expect(variants[0]!.baseUom).toBe("bag");
  });

  it("adds no row for a unit that is already seeded", () => {
    const { sqlite } = upgradeShopWithBagItem();

    expect(sqlite.prepare("select count(*) as rows from uom where code = 'pcs'").get()).toEqual({
      rows: 1,
    });
  });
});

describe("custom units made after the upgrade (spec 002)", () => {
  it("gives a new 001-style item's custom unit a uom row, once", () => {
    const { sqlite, db, ctx } = createTestDb();
    const inventory = new InventoryService(db, ctx);

    inventory.createItem({
      name: "Cement bag A",
      unit: "bag",
      pricePaise: 38_000,
      openingQtyMilli: 0,
    });
    inventory.createItem({
      name: "Cement bag B",
      unit: "bag",
      pricePaise: 39_000,
      openingQtyMilli: 0,
    });

    expect(sqlite.prepare("select count(*) as rows from uom where code = 'bag'").get()).toEqual({
      rows: 1,
    });
  });
});
