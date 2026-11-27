import type Database from "better-sqlite3";
import { newId } from "../../src/main/db/ids";
import { createTestDb } from "../helpers/testDb";
import { upgradeDatabaseWithOneBill } from "../helpers/upgradeFixture";

/**
 * Spec 002 T016 (migration 0016): the catalogue tables category, attribute_def, brand and uom,
 * and their seeded rows (data-model.md "Catalogue").
 */
const GENERIC_ATTRIBUTE_KEYS = [
  "base_type",
  "brand",
  "class",
  "colour",
  "gauge",
  "length",
  "pack_size",
  "rating",
  "shade",
  "size",
];
const SEEDED_UNIT_CODES = ["box", "bundle", "kg", "litre", "metre", "ml", "pair", "pcs", "roll"];

const businessOf = (sqlite: Database.Database) =>
  sqlite.prepare("select business_id as businessId, shop_id as shopId from shop_profile").get() as {
    businessId: string;
    shopId: string;
  };

const attributeKeys = (sqlite: Database.Database) =>
  (sqlite.prepare("select key from attribute_def order by key").all() as { key: string }[]).map(
    (attributeRow) => attributeRow.key,
  );

const unitCodes = (sqlite: Database.Database) =>
  (sqlite.prepare("select code from uom order by code").all() as { code: string }[]).map(
    (unitRow) => unitRow.code,
  );

function insertCategory(
  sqlite: Database.Database,
  fields: { name: string; parentId?: string | null; defaultHsn?: string | null },
): string {
  const { businessId, shopId } = businessOf(sqlite);
  const categoryId = newId();
  sqlite
    .prepare(
      `insert into category (id, business_id, shop_id, created_at, updated_at, parent_id, name, default_hsn)
       values (?, ?, ?, 1, 1, ?, ?, ?)`,
    )
    .run(
      categoryId,
      businessId,
      shopId,
      fields.parentId ?? null,
      fields.name,
      fields.defaultHsn ?? null,
    );
  return categoryId;
}

function insertBrand(sqlite: Database.Database, name: string): void {
  const { businessId, shopId } = businessOf(sqlite);
  sqlite
    .prepare(
      `insert into brand (id, business_id, shop_id, created_at, updated_at, name)
       values (?, ?, ?, 1, 1, ?)`,
    )
    .run(newId(), businessId, shopId, name);
}

describe("catalogue seed rows (spec 002 T016)", () => {
  it("seeds the ten attributes and nine units on a new shop", () => {
    const { sqlite } = createTestDb();

    expect(attributeKeys(sqlite)).toEqual(GENERIC_ATTRIBUTE_KEYS);
    expect(unitCodes(sqlite)).toEqual(SEEDED_UNIT_CODES);
  });

  it("seeds the same rows when an existing shop's database is upgraded", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    expect(attributeKeys(sqlite)).toEqual(GENERIC_ATTRIBUTE_KEYS);
    expect(unitCodes(sqlite)).toEqual(SEEDED_UNIT_CODES);
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  });

  it("seeds the same labels, types, dimensions and UQC codes by migration as by first run", () => {
    const seededRows = (sqlite: Database.Database) => ({
      attributes: sqlite
        .prepare("select key, label, data_type, unit_kind from attribute_def order by key")
        .all(),
      units: sqlite
        .prepare("select code, label, dimension, uqc, allow_decimal from uom order by code")
        .all(),
    });

    expect(seededRows(upgradeDatabaseWithOneBill())).toEqual(seededRows(createTestDb().sqlite));
  });

  it("gives metre and kg decimals and pieces none, with the unit's dimension", () => {
    const { sqlite } = createTestDb();

    const units = sqlite
      .prepare(
        "select code, dimension, allow_decimal as allowDecimal from uom where code in ('pcs', 'metre', 'kg') order by code",
      )
      .all();

    expect(units).toEqual([
      { code: "kg", dimension: "mass", allowDecimal: 1 },
      { code: "metre", dimension: "length", allowDecimal: 1 },
      { code: "pcs", dimension: "count", allowDecimal: 0 },
    ]);
  });
});

describe("category rules (spec 002 T016)", () => {
  it("refuses a second category of the same name under the same parent, ignoring case", () => {
    const { sqlite } = createTestDb();
    const pipes = insertCategory(sqlite, { name: "Pipes" });
    insertCategory(sqlite, { name: "PVC", parentId: pipes });

    expect(() => insertCategory(sqlite, { name: "pvc", parentId: pipes })).toThrow(/UNIQUE/);
  });

  it("allows the same name under different parents", () => {
    const { sqlite } = createTestDb();
    const pipes = insertCategory(sqlite, { name: "Pipes" });
    const fittings = insertCategory(sqlite, { name: "Fittings" });
    insertCategory(sqlite, { name: "PVC", parentId: pipes });

    expect(() => insertCategory(sqlite, { name: "PVC", parentId: fittings })).not.toThrow();
  });

  it("refuses two top-level categories of the same name", () => {
    const { sqlite } = createTestDb();
    insertCategory(sqlite, { name: "Paint" });

    expect(() => insertCategory(sqlite, { name: "PAINT" })).toThrow(/UNIQUE/);
  });

  it("refuses an empty, untrimmed or 81-character name", () => {
    const { sqlite } = createTestDb();

    expect(() => insertCategory(sqlite, { name: "" })).toThrow(/CHECK/);
    expect(() => insertCategory(sqlite, { name: " Pipes" })).toThrow(/CHECK/);
    expect(() => insertCategory(sqlite, { name: "P".repeat(81) })).toThrow(/CHECK/);
  });

  it("accepts an HSN of 4, 6 or 8 digits and refuses 5 digits or letters", () => {
    const { sqlite } = createTestDb();

    expect(() => insertCategory(sqlite, { name: "Four", defaultHsn: "3917" })).not.toThrow();
    expect(() => insertCategory(sqlite, { name: "Six", defaultHsn: "391723" })).not.toThrow();
    expect(() => insertCategory(sqlite, { name: "Eight", defaultHsn: "39172310" })).not.toThrow();
    expect(() => insertCategory(sqlite, { name: "Five", defaultHsn: "39172" })).toThrow(/CHECK/);
    expect(() => insertCategory(sqlite, { name: "Text", defaultHsn: "39AB" })).toThrow(/CHECK/);
  });

  it("refuses a parent that does not exist", () => {
    const { sqlite } = createTestDb();

    expect(() => insertCategory(sqlite, { name: "Orphan", parentId: "no-such-category" })).toThrow(
      /FOREIGN KEY/,
    );
  });
});

describe("brand rules (spec 002 T016)", () => {
  it("refuses the same brand name twice, ignoring case", () => {
    const { sqlite } = createTestDb();
    insertBrand(sqlite, "Supreme");

    expect(() => insertBrand(sqlite, "SUPREME")).toThrow(/UNIQUE/);
  });

  it("refuses an empty or 61-character brand name", () => {
    const { sqlite } = createTestDb();

    expect(() => insertBrand(sqlite, "")).toThrow(/CHECK/);
    expect(() => insertBrand(sqlite, "B".repeat(61))).toThrow(/CHECK/);
  });
});
