import Database from "better-sqlite3";
import { openDatabase } from "../../src/main/db/connection";
import { BillRepository } from "../../src/main/repositories/BillRepository";
import { InventoryService } from "../../src/main/services/InventoryService";
import { StockRepository } from "../../src/main/repositories/StockRepository";
import { MIGRATIONS, createTestDb } from "../helpers/testDb";
import { createDatabaseFileAtMigration0004WithOneBill } from "../helpers/upgradeFixture";

const TIME_COLUMNS_BY_TABLE = [
  "item_family",
  "item_variant",
  "location",
  "stock_movement",
  "bill",
  "bill_line",
  "bill_tender",
  "shop_profile",
  "number_series",
];

/** Task T078, second half (migration 0011): times are INTEGER epoch milliseconds, exact. */
describe("upgrading times from ISO text to epoch milliseconds (research D18)", () => {
  /** The 0004 database with a few times changed to ones that have milliseconds, before upgrading. */
  function upgradeWithMillisecondTimes(): { sqlite: Database.Database; billId: string } {
    const databasePath = createDatabaseFileAtMigration0004WithOneBill();
    const old = new Database(databasePath);
    old.prepare("update item set created_at = '2026-11-15T09:30:00.123Z'").run();
    old
      .prepare(
        "update bill set status = 'cancelled', cancel_reason = 'wrong item', cancelled_at = '2026-11-15T10:00:00.456Z'",
      )
      .run();
    const billId = (old.prepare("select id from bill").get() as { id: string }).id;
    old.close();
    return { sqlite: openDatabase(databasePath, { migrationsFolder: MIGRATIONS }).sqlite, billId };
  }

  it("converts a time with milliseconds exactly", () => {
    const { sqlite } = upgradeWithMillisecondTimes();

    const variantRow = sqlite.prepare("select created_at from item_variant").get();

    expect(variantRow).toEqual({ created_at: Date.UTC(2026, 10, 15, 9, 30, 0, 123) });
  });

  it("converts a time without milliseconds, as a whole number of seconds", () => {
    const { sqlite } = upgradeWithMillisecondTimes();

    const movementRow = sqlite
      .prepare("select occurred_at from stock_movement where movement_type = 'opening'")
      .get();

    expect(movementRow).toEqual({ occurred_at: Date.UTC(2026, 10, 15, 9, 30, 0) });
  });

  it("converts the cancel time, keeps the cancelled status and its reason", () => {
    const { sqlite } = upgradeWithMillisecondTimes();

    const billRow = sqlite.prepare("select status, cancel_reason, cancelled_at from bill").get();

    expect(billRow).toEqual({
      status: "cancelled",
      cancel_reason: "wrong item",
      cancelled_at: Date.UTC(2026, 10, 15, 10, 0, 0, 456),
    });
  });

  it("leaves a null cancel time null", () => {
    const sqlite = openDatabase(createDatabaseFileAtMigration0004WithOneBill(), {
      migrationsFolder: MIGRATIONS,
    }).sqlite;

    expect(sqlite.prepare("select cancelled_at from bill").get()).toEqual({ cancelled_at: null });
  });

  it("stores every created_at and updated_at as an integer on every table", () => {
    const { sqlite } = upgradeWithMillisecondTimes();

    TIME_COLUMNS_BY_TABLE.forEach((tableName) => {
      const nonIntegerRows = sqlite
        .prepare(
          `select count(*) as total from ${tableName} where typeof(created_at) <> 'integer' or typeof(updated_at) <> 'integer'`,
        )
        .get();
      expect(nonIntegerRows, tableName).toEqual({ total: 0 });
    });
  });

  it("shows the converted times as ISO text where the app shows text", () => {
    const { sqlite, billId } = upgradeWithMillisecondTimes();
    const connection = openDatabase(sqlite.name, { migrationsFolder: MIGRATIONS });
    const ctx = {
      businessId: (sqlite.prepare("select business_id from bill").get() as { business_id: string })
        .business_id,
      shopId: (sqlite.prepare("select shop_id from bill").get() as { shop_id: string }).shop_id,
      deviceId: "device-1",
    };

    const found = new BillRepository(connection.db, ctx).get(billId);
    const variantId = (sqlite.prepare("select id from item_variant").get() as { id: string }).id;
    const movements = new StockRepository(connection.db, ctx).forItem(variantId);

    expect(found?.bill.cancelledAt).toBe("2026-11-15T10:00:00.456Z");
    expect(movements.map((movement) => movement.occurredAt)).toEqual([
      "2026-11-15T09:30:00.000Z",
      "2026-11-15T09:30:00.000Z",
    ]);
  });

  it("keeps the immutability triggers on every rebuilt table", () => {
    const { sqlite } = upgradeWithMillisecondTimes();
    const attempts = [
      "delete from stock_movement",
      "delete from bill_line",
      "delete from bill_tender",
      "delete from bill",
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
      "stock_movement is append-only",
      "bill_line is immutable",
      "bill_tender is immutable",
      "bills cannot be deleted",
    ]);
  });
});

describe("rows written after the upgrade", () => {
  it("get integer epoch-millisecond times", () => {
    const { sqlite, db, ctx } = createTestDb();
    const before = Date.now();

    new InventoryService(db, ctx).createItem({
      name: "Pipe",
      unit: "pcs",
      pricePaise: 100,
      openingQtyMilli: 1000,
    });

    const after = Date.now();
    const createdRow = sqlite
      .prepare(
        "select typeof(created_at) as kind, created_at, typeof(updated_at) as updated_kind from item_variant",
      )
      .get() as { kind: string; created_at: number; updated_kind: string };
    expect(createdRow.kind).toBe("integer");
    expect(createdRow.updated_kind).toBe("integer");
    expect(createdRow.created_at).toBeGreaterThanOrEqual(before);
    expect(createdRow.created_at).toBeLessThanOrEqual(after);
    const movementRow = sqlite
      .prepare("select typeof(occurred_at) as kind from stock_movement")
      .get();
    expect(movementRow).toEqual({ kind: "integer" });
  });
});
