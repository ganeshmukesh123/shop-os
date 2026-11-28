import type Database from "better-sqlite3";
import { openDatabase } from "../../src/main/db/connection";
import { insertCatalogueRow } from "../helpers/catalogueRows";
import { migrationsFolderUpTo } from "../helpers/migrationsUpTo";
import { MIGRATIONS } from "../helpers/testDb";
import { createDatabaseFileAtMigration0004WithOneBill } from "../helpers/upgradeFixture";

/**
 * Spec 002 T021: migrations 0016 to 0022 on a database seeded like 001 (an item, a bill, its
 * movements; one case with the bill cancelled). Nothing 001 wrote may change, and the new
 * append-only and freeze rules hold on the upgraded file.
 */
const MIGRATIONS_THROUGH_001_AND_0015 = 16; // 0000 to 0015: everything before spec 002

const BILL_LINE_002_COLUMNS = {
  entered_uom: null,
  qty_entered_milli: null,
  tint_formula_id: null,
  tint_charge_paise: null,
  cost_paise: null,
  is_returnable: 1,
};

const allRows = (sqlite: Database.Database, table: string) =>
  sqlite.prepare(`select * from ${table} order by id`).all() as Record<string, unknown>[];

const itemRows = (sqlite: Database.Database) =>
  sqlite
    .prepare(
      "select item_variant.id, family_id, item_code, display_name, stock_milli from item_variant join item_family on item_family.id = family_id order by item_variant.id",
    )
    .all();

/** The same 001 database read just before 0016 and again after every 002 migration. */
function upgradeAcross002(options: { cancelledAt?: string } = {}) {
  const databasePath = createDatabaseFileAtMigration0004WithOneBill(options);
  const before002 = openDatabase(databasePath, {
    migrationsFolder: migrationsFolderUpTo(MIGRATIONS_THROUGH_001_AND_0015),
  }).sqlite;
  const snapshot = {
    bills: allRows(before002, "bill"),
    lines: allRows(before002, "bill_line"),
    tenders: allRows(before002, "bill_tender"),
    movements: allRows(before002, "stock_movement"),
    items: itemRows(before002),
  };
  before002.close();
  const after002 = openDatabase(databasePath, { migrationsFolder: MIGRATIONS }).sqlite;
  return { snapshot, after002 };
}

describe("spec 002 migrations on a 001 database (T021)", () => {
  it.each([
    ["a posted bill", {}],
    ["a cancelled bill", { cancelledAt: "2026-11-16T10:00:00.000Z" }],
  ])("keeps every bill, line, tender and movement unchanged, with %s", (_case, options) => {
    const { snapshot, after002 } = upgradeAcross002(options);

    expect(snapshot.bills).toHaveLength(1);
    expect(allRows(after002, "bill")).toEqual(snapshot.bills);
    expect(allRows(after002, "bill_line")).toEqual(
      snapshot.lines.map((lineRow) => ({ ...lineRow, ...BILL_LINE_002_COLUMNS })),
    );
    expect(allRows(after002, "bill_tender")).toEqual(snapshot.tenders);
    expect(allRows(after002, "stock_movement")).toEqual(
      snapshot.movements.map((movementRow) => ({ ...movementRow, batch_id: null })),
    );
    expect(after002.pragma("foreign_key_check")).toEqual([]);
    expect(after002.pragma("integrity_check")).toEqual([{ integrity_check: "ok" }]);
  });

  it("makes every item a one-variant general family with the same id, code and stock", () => {
    const { snapshot, after002 } = upgradeAcross002();

    expect(itemRows(after002)).toEqual(snapshot.items);
    expect(
      after002
        .prepare(
          "select kind, axis_keys, (select count(*) from item_variant where family_id = item_family.id) as variants from item_family",
        )
        .all(),
    ).toEqual([{ kind: "general", axis_keys: "[]", variants: 1 }]);
  });

  it("rejects UPDATE and DELETE on stock_movement, bill_line_tint and item_merge_log", () => {
    const { after002 } = upgradeAcross002();
    const variantId = (after002.prepare("select id from item_variant").get() as { id: string }).id;
    const secondVariant = insertCatalogueRow(after002, "item_variant", {
      family_id: (after002.prepare("select id from item_family").get() as { id: string }).id,
      item_code: "ITM-0002",
      display_name: "Pipe copy",
      base_uom: "pcs",
      selling_price_paise: 12_000,
      axis_signature: "copy",
    });
    insertCatalogueRow(after002, "item_merge_log", {
      action: "merge",
      survivor_id: variantId,
      merged_id: secondVariant,
      reason: "Entered twice",
      user_label: "Owner",
      reversible_until: 1,
    });
    insertCatalogueRow(after002, "bill_line_tint", {
      bill_line_id: (after002.prepare("select id from bill_line").get() as { id: string }).id,
      colorant_variant_id: variantId,
      colorant_name_snapshot: "Pipe",
      qty_milli: 1,
      cost_paise: 0,
    });

    const run = (statement: string) => () => after002.prepare(statement).run();

    expect(run("update stock_movement set updated_at = 2")).toThrow(/append-only/);
    expect(run("delete from stock_movement")).toThrow(/append-only/);
    expect(run("update bill_line_tint set updated_at = 2")).toThrow(/append-only/);
    expect(run("delete from bill_line_tint")).toThrow(/append-only/);
    expect(run("update item_merge_log set updated_at = 2")).toThrow(/append-only/);
    expect(run("delete from item_merge_log")).toThrow(/append-only/);
  });

  it("refuses a new colorant line in a formula a bill used, but takes it in an unused version", () => {
    const { after002 } = upgradeAcross002();
    const lineVariant = (after002.prepare("select id from item_variant").get() as { id: string })
      .id;
    const shade = insertCatalogueRow(after002, "tint_shade", {
      shade_code: "8123",
      shade_name: "Sky Blue",
      source: "library",
    });
    const formulaVersion = (version: number) =>
      insertCatalogueRow(after002, "tint_formula", {
        shade_id: shade,
        base_variant_id: lineVariant,
        version,
      });
    const usedFormula = formulaVersion(1);
    const unusedFormula = formulaVersion(2);
    // A later tinted line on the upgraded file uses version 1
    insertCatalogueRow(after002, "bill_line", {
      bill_id: (after002.prepare("select id from bill").get() as { id: string }).id,
      line_no: 2,
      variant_id: lineVariant,
      item_name_snapshot: "Pipe",
      unit_snapshot: "pcs",
      qty_base_milli: 1000,
      unit_price_paise: 12_000,
      line_discount_paise: 0,
      amount_paise: 12_000,
      tint_formula_id: usedFormula,
    });
    const colorantLine = (formulaId: string) => () =>
      insertCatalogueRow(after002, "tint_formula_line", {
        formula_id: formulaId,
        colorant_variant_id: lineVariant,
        qty_milli: 250,
      });

    expect(colorantLine(usedFormula)).toThrow(/used on a bill/);
    expect(colorantLine(unusedFormula)).not.toThrow();
  });
});
