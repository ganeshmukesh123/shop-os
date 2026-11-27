import type Database from "better-sqlite3";
import { openDatabase } from "../../src/main/db/connection";
import { newId } from "../../src/main/db/ids";
import { shopIdsOf } from "../helpers/catalogueRows";
import { migrationsFolderUpTo } from "../helpers/migrationsUpTo";
import { createTestDb, MIGRATIONS } from "../helpers/testDb";
import {
  createDatabaseFileAtMigration0004WithOneBill,
  upgradeDatabaseWithOneBill,
} from "../helpers/upgradeFixture";

/**
 * Spec 002 T019 (migration 0019, research D17): lookup tables for the enum columns, the one
 * rebuild of stock_movement and bill_tender, the rule trigger and the "Tinted returns" location.
 */
const MIGRATIONS_BEFORE_0019 = 19; // 0000 to 0018

const lookupRows = (sqlite: Database.Database) => ({
  movementTypes: sqlite
    .prepare(
      "select code, direction, requires_doc, required_doc_type, requires_reason from movement_type order by code",
    )
    .all(),
  docTypes: sqlite.prepare("select code from movement_doc_type order by code").all(),
  tenderModes: sqlite.prepare("select code from tender_mode order by code").all(),
  tenderStatuses: sqlite.prepare("select code from tender_status order by code").all(),
  exceptionKinds: sqlite.prepare("select code from exception_kind order by code").all(),
  locations: sqlite.prepare("select name, kind from location order by name").all(),
});

const tableRows = (sqlite: Database.Database, table: string) =>
  sqlite.prepare(`select * from ${table} order by id`).all() as Record<string, unknown>[];

describe("lookup seed rows (spec 002 T019)", () => {
  it("seeds the six movement types with their direction, document and reason rules", () => {
    const { sqlite } = createTestDb();

    expect(lookupRows(sqlite).movementTypes).toEqual([
      {
        code: "adjustment",
        direction: "either",
        requires_doc: 0,
        required_doc_type: null,
        requires_reason: 1,
      },
      {
        code: "merge_in",
        direction: "in",
        requires_doc: 1,
        required_doc_type: "item_merge",
        requires_reason: 0,
      },
      {
        code: "merge_out",
        direction: "out",
        requires_doc: 1,
        required_doc_type: "item_merge",
        requires_reason: 0,
      },
      {
        code: "opening",
        direction: "in",
        requires_doc: 0,
        required_doc_type: null,
        requires_reason: 0,
      },
      {
        code: "sale",
        direction: "out",
        requires_doc: 1,
        required_doc_type: "bill",
        requires_reason: 0,
      },
      {
        code: "sale_cancel",
        direction: "in",
        requires_doc: 1,
        required_doc_type: "bill",
        requires_reason: 0,
      },
    ]);
  });

  it("seeds the same rows and the Tinted returns location by migration as by first run", () => {
    expect(lookupRows(upgradeDatabaseWithOneBill())).toEqual(lookupRows(createTestDb().sqlite));
    expect(lookupRows(createTestDb().sqlite).locations).toEqual([
      { name: "Shop floor", kind: "shop_floor" },
      { name: "Tinted returns", kind: "tinted_returns" },
    ]);
  });
});

describe("the rebuild keeps every row (spec 002 T019)", () => {
  it("copies every stock movement and tender unchanged, with no batch", () => {
    const databasePath = createDatabaseFileAtMigration0004WithOneBill();
    const before0019 = openDatabase(databasePath, {
      migrationsFolder: migrationsFolderUpTo(MIGRATIONS_BEFORE_0019),
    });
    const movementsBefore = tableRows(before0019.sqlite, "stock_movement");
    const tendersBefore = tableRows(before0019.sqlite, "bill_tender");
    before0019.sqlite.close();

    const after0019 = openDatabase(databasePath, { migrationsFolder: MIGRATIONS }).sqlite;

    expect(movementsBefore).toHaveLength(2);
    expect(tableRows(after0019, "stock_movement")).toEqual(
      movementsBefore.map((movementRow) => ({ ...movementRow, batch_id: null })),
    );
    expect(tableRows(after0019, "bill_tender")).toEqual(tendersBefore);
    expect(after0019.pragma("foreign_key_check")).toEqual([]);
  });

  it("re-creates the append-only triggers on both rebuilt tables", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    expect(() => sqlite.prepare("update stock_movement set note = 'x'").run()).toThrow(
      /append-only/,
    );
    expect(() => sqlite.prepare("delete from stock_movement").run()).toThrow(/append-only/);
    expect(() => sqlite.prepare("update bill_tender set amount_paise = 0").run()).toThrow(
      /immutable/,
    );
    expect(() => sqlite.prepare("delete from bill_tender").run()).toThrow(/immutable/);
  });
});

describe("stock movement rules read the movement type (spec 002 T019)", () => {
  const INSERT_MOVEMENT = `insert into stock_movement
    (id, business_id, shop_id, created_at, updated_at, variant_id, movement_type, qty_base_milli,
     from_location_id, to_location_id, doc_type, doc_id, note, occurred_at, device_id)
    values (@id, @businessId, @shopId, 1, 1, @variantId, @movementType, 1000,
     @fromLocationId, @toLocationId, @docType, @docId, @note, 1, 'device-1')`;

  function shopWithOnePipe() {
    const { sqlite } = createTestDb();
    const { businessId, shopId } = shopIdsOf(sqlite);
    sqlite
      .prepare(
        "insert into item_family (id, business_id, shop_id, created_at, updated_at, name) values ('family-1', ?, ?, 1, 1, 'Pipe')",
      )
      .run(businessId, shopId);
    sqlite
      .prepare(
        `insert into item_variant (id, business_id, shop_id, created_at, updated_at, family_id, item_code, display_name, base_uom, selling_price_paise)
         values ('variant-1', ?, ?, 1, 1, 'family-1', 'ITM-0001', 'Pipe', 'pcs', 100)`,
      )
      .run(businessId, shopId);
    const locationOf = (kind: string) =>
      (sqlite.prepare("select id from location where kind = ?").get(kind) as { id: string }).id;
    const insertMovement = (columns: Record<string, string | null>) =>
      sqlite.prepare(INSERT_MOVEMENT).run({
        id: newId(),
        businessId,
        shopId,
        variantId: "variant-1",
        fromLocationId: null,
        toLocationId: null,
        docType: null,
        docId: null,
        note: null,
        ...columns,
      });
    return {
      sqlite,
      businessId,
      shopId,
      shopFloor: locationOf("shop_floor"),
      tintedReturns: locationOf("tinted_returns"),
      insertMovement,
    };
  }

  it("refuses a movement type that is not in movement_type", () => {
    const { shopFloor, insertMovement } = shopWithOnePipe();

    expect(() => insertMovement({ movementType: "theft", toLocationId: shopFloor })).toThrow(
      /FOREIGN KEY/,
    );
  });

  it("lets an adjustment go either way, with a note", () => {
    const { shopFloor, insertMovement } = shopWithOnePipe();
    const adjustment = { movementType: "adjustment", note: "Stock count" };

    expect(() => insertMovement({ ...adjustment, toLocationId: shopFloor })).not.toThrow();
    expect(() => insertMovement({ ...adjustment, fromLocationId: shopFloor })).not.toThrow();
  });

  it("needs an item_merge document for merge_in and merge_out, and refuses a bill", () => {
    const { shopFloor, insertMovement } = shopWithOnePipe();
    const mergeIn = { movementType: "merge_in", toLocationId: shopFloor, docId: "merge-1" };

    expect(() => insertMovement({ ...mergeIn, docType: "bill" })).toThrow(/needs its document/);
    expect(() => insertMovement({ ...mergeIn, docType: "item_merge" })).not.toThrow();
    expect(() =>
      insertMovement({
        movementType: "merge_out",
        fromLocationId: shopFloor,
        docType: "item_merge",
        docId: "merge-1",
      }),
    ).not.toThrow();
  });

  it("takes a new movement type as one INSERT, with no rebuild: a transfer moves between two places", () => {
    const { sqlite, businessId, shopId, shopFloor, tintedReturns, insertMovement } =
      shopWithOnePipe();
    const tablesBefore = sqlite.prepare("select sql from sqlite_master order by name").all();
    sqlite
      .prepare(
        `insert into movement_type (id, business_id, shop_id, created_at, updated_at, code, direction)
         values (?, ?, ?, 1, 1, 'transfer', 'both')`,
      )
      .run(newId(), businessId, shopId);
    const transfer = { movementType: "transfer", fromLocationId: shopFloor };

    expect(() => insertMovement({ ...transfer, toLocationId: tintedReturns })).not.toThrow();
    expect(() => insertMovement({ ...transfer, toLocationId: shopFloor })).toThrow(
      /locations do not match/,
    );
    expect(() => insertMovement({ ...transfer, toLocationId: null })).toThrow(
      /locations do not match/,
    );
    expect(sqlite.prepare("select sql from sqlite_master order by name").all()).toEqual(
      tablesBefore,
    );
  });

  it("refuses a movement type whose document rule is half set", () => {
    const { sqlite, businessId, shopId } = shopWithOnePipe();

    expect(() =>
      sqlite
        .prepare(
          `insert into movement_type (id, business_id, shop_id, created_at, updated_at, code, direction, requires_doc)
           values (?, ?, ?, 1, 1, 'purchase', 'in', 1)`,
        )
        .run(newId(), businessId, shopId),
    ).toThrow(/CHECK/);
  });
});
