import type Database from "better-sqlite3";
import { newId } from "../../src/main/db/ids";
import { createTestDb } from "../helpers/testDb";
import { upgradeDatabaseWithOneBill } from "../helpers/upgradeFixture";

/**
 * Spec 002 T017 (migration 0017): the new item_family and item_variant columns, their CHECKs,
 * and that a 001 item becomes a one-variant "general" family with every id, code and stock kept.
 */
const shopOf = (sqlite: Database.Database) =>
  sqlite.prepare("select business_id as businessId, shop_id as shopId from shop_profile").get() as {
    businessId: string;
    shopId: string;
  };

function insertFamily(sqlite: Database.Database, columns: Record<string, unknown> = {}): string {
  const { businessId, shopId } = shopOf(sqlite);
  const familyId = newId();
  const allColumns = {
    id: familyId,
    business_id: businessId,
    shop_id: shopId,
    created_at: 1,
    updated_at: 1,
    name: "PVC Pipe Supreme",
    ...columns,
  };
  const names = Object.keys(allColumns);
  sqlite
    .prepare(
      `insert into item_family (${names.join(", ")}) values (${names.map(() => "?").join(", ")})`,
    )
    .run(...Object.values(allColumns));
  return familyId;
}

function insertVariant(
  sqlite: Database.Database,
  familyId: string,
  columns: Record<string, unknown> = {},
): string {
  const { businessId, shopId } = shopOf(sqlite);
  const variantId = newId();
  const allColumns = {
    id: variantId,
    business_id: businessId,
    shop_id: shopId,
    created_at: 1,
    updated_at: 1,
    family_id: familyId,
    item_code: `ITM-${variantId}`,
    display_name: "PVC Pipe 1 inch 4 kg",
    base_uom: "pcs",
    selling_price_paise: 12_000,
    ...columns,
  };
  const names = Object.keys(allColumns);
  sqlite
    .prepare(
      `insert into item_variant (${names.join(", ")}) values (${names.map(() => "?").join(", ")})`,
    )
    .run(...Object.values(allColumns));
  return variantId;
}

describe("a 001 item after the upgrade (spec 002 T017)", () => {
  it("is a general family with no axes, and keeps its id, code, name and stock", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const familyRow = sqlite
      .prepare("select id, name, kind, category_id, brand_id, spec, axis_keys from item_family")
      .get();
    const variantRow = sqlite
      .prepare(
        `select id, family_id, item_code, display_name, stock_milli, axes, axis_signature,
                petroleum_class, sealed_pack_only, is_serial_tracked, merged_into_id
         from item_variant`,
      )
      .get();

    expect(familyRow).toEqual({
      id: "item-1",
      name: "Pipe",
      kind: "general",
      category_id: null,
      brand_id: null,
      spec: "{}",
      axis_keys: "[]",
    });
    expect(variantRow).toMatchObject({
      family_id: "item-1",
      item_code: "ITM-0001",
      display_name: "Pipe",
      axes: "{}",
      axis_signature: "",
      petroleum_class: null,
      sealed_pack_only: 0,
      is_serial_tracked: 0,
      merged_into_id: null,
    });
    // Opening 10 pcs, one bill of 2 pcs: the cached stock still equals the movements' sum
    expect(variantRow).toMatchObject({ stock_milli: 8000 });
    expect(
      sqlite
        .prepare(
          `select sum(case when to_location_id is not null then qty_base_milli else -qty_base_milli end)
             as movedMilli from stock_movement`,
        )
        .get(),
    ).toEqual({ movedMilli: 8000 });
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  });

  it("keeps every trigger and bill reference after the tables are rebuilt", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const triggerCount = sqlite
      .prepare("select count(*) as triggers from sqlite_master where type = 'trigger'")
      .get() as { triggers: number };
    const lineItem = sqlite.prepare("select variant_id from bill_line").get();

    expect(triggerCount.triggers).toBeGreaterThanOrEqual(10);
    expect(lineItem).toEqual({
      variant_id: (sqlite.prepare("select id from item_variant").get() as { id: string }).id,
    });
  });
});

describe("item_family rules (spec 002 T017)", () => {
  it("accepts the five kinds and refuses any other", () => {
    const { sqlite } = createTestDb();

    expect(() => insertFamily(sqlite, { kind: "base_paint" })).not.toThrow();
    expect(() => insertFamily(sqlite, { name: "Thinner", kind: "thinner_solvent" })).not.toThrow();
    expect(() => insertFamily(sqlite, { name: "Glue", kind: "adhesive" })).toThrow(/CHECK/);
  });

  it("accepts up to 4 axes and refuses 5", () => {
    const { sqlite } = createTestDb();
    const fourAxes = JSON.stringify(["size", "class", "brand", "length"]);
    const fiveAxes = JSON.stringify(["size", "class", "brand", "length", "colour"]);

    expect(() => insertFamily(sqlite, { axis_keys: fourAxes })).not.toThrow();
    expect(() => insertFamily(sqlite, { name: "Too many", axis_keys: fiveAxes })).toThrow(/CHECK/);
  });

  it("refuses a spec that is not a JSON object and axes that are not a JSON array", () => {
    const { sqlite } = createTestDb();

    expect(() => insertFamily(sqlite, { spec: "[]" })).toThrow(/CHECK/);
    expect(() => insertFamily(sqlite, { spec: "not json" })).toThrow(/CHECK|JSON/);
    expect(() => insertFamily(sqlite, { axis_keys: "{}" })).toThrow(/CHECK/);
  });

  it("refuses a category or brand that does not exist", () => {
    const { sqlite } = createTestDb();

    expect(() => insertFamily(sqlite, { category_id: "no-such-category" })).toThrow(/FOREIGN KEY/);
    expect(() => insertFamily(sqlite, { brand_id: "no-such-brand" })).toThrow(/FOREIGN KEY/);
  });
});

describe("item_variant rules (spec 002 T017)", () => {
  it("refuses two variants of one family with the same axis signature", () => {
    const { sqlite } = createTestDb();
    const familyId = insertFamily(sqlite);
    insertVariant(sqlite, familyId, { axis_signature: "class=4kg|size=1in" });

    expect(() => insertVariant(sqlite, familyId, { axis_signature: "class=4kg|size=1in" })).toThrow(
      /UNIQUE/,
    );
    expect(() =>
      insertVariant(sqlite, familyId, { axis_signature: "class=6kg|size=1in" }),
    ).not.toThrow();
  });

  it("refuses a sealed pack that allows decimals", () => {
    const { sqlite } = createTestDb();
    const familyId = insertFamily(sqlite);

    expect(() =>
      insertVariant(sqlite, familyId, { sealed_pack_only: 1, allow_decimal: 1 }),
    ).toThrow(/CHECK/);
  });

  it("needs the declared quantity and its unit together, and the quantity above zero", () => {
    const { sqlite } = createTestDb();
    const familyId = insertFamily(sqlite);

    expect(() => insertVariant(sqlite, familyId, { declared_qty_milli: 1000 })).toThrow(/CHECK/);
    expect(() =>
      insertVariant(sqlite, familyId, { declared_qty_milli: 0, declared_uom: "litre" }),
    ).toThrow(/CHECK/);
    expect(() =>
      insertVariant(sqlite, familyId, { declared_qty_milli: 1000, declared_uom: "litre" }),
    ).not.toThrow();
  });

  it("accepts petroleum class A, B, C or NA, and leaves it empty until the owner chooses", () => {
    const { sqlite } = createTestDb();
    const familyId = insertFamily(sqlite);
    const variantId = insertVariant(sqlite, familyId);

    expect(
      sqlite.prepare("select petroleum_class from item_variant where id = ?").get(variantId),
    ).toEqual({ petroleum_class: null });
    expect(() =>
      insertVariant(sqlite, familyId, { axis_signature: "b", petroleum_class: "NA" }),
    ).not.toThrow();
    expect(() =>
      insertVariant(sqlite, familyId, { axis_signature: "d", petroleum_class: "D" }),
    ).toThrow(/CHECK/);
  });

  it("refuses warranty over 120 months, negative prices and levels, and long labels", () => {
    const { sqlite } = createTestDb();
    const familyId = insertFamily(sqlite);
    const refused = (columns: Record<string, unknown>) => () =>
      insertVariant(sqlite, familyId, columns);

    expect(refused({ warranty_months: 121 })).toThrow(/CHECK/);
    expect(refused({ purchase_price_paise: -1 })).toThrow(/CHECK/);
    expect(refused({ reorder_level_milli: -1 })).toThrow(/CHECK/);
    expect(refused({ location_tag: "R".repeat(31) })).toThrow(/CHECK/);
    expect(refused({ trade_label: "T".repeat(21) })).toThrow(/CHECK/);
    expect(refused({ is_serial_tracked: 2 })).toThrow(/CHECK/);
  });

  it("refuses a variant merged into itself or into a variant that does not exist", () => {
    const { sqlite } = createTestDb();
    const familyId = insertFamily(sqlite);
    const variantId = newId();

    expect(() =>
      insertVariant(sqlite, familyId, { id: variantId, merged_into_id: variantId }),
    ).toThrow(/CHECK/);
    expect(() => insertVariant(sqlite, familyId, { merged_into_id: "no-such-variant" })).toThrow(
      /FOREIGN KEY/,
    );
  });
});
