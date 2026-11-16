import Database from "better-sqlite3";
import { migrateConnection, openDatabase } from "../../src/main/db/connection";
import { MIGRATIONS } from "../helpers/testDb";
import {
  createDatabaseFileAtMigration0004WithOneBill,
  upgradeDatabaseWithOneBill,
} from "../helpers/upgradeFixture";

/** Task T076 (migration 0008): the bill header takes the target names and keeps every bill. */
describe("upgrading the bill header from migration 0004 (research D18)", () => {
  it("keeps the bill under its new column names, and posted instead of saved", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const billRow = sqlite
      .prepare(
        "select bill_no, counter_code, financial_year, seq, status, subtotal_paise, bill_discount_paise, total_paise from bill",
      )
      .get();

    expect(billRow).toEqual({
      bill_no: "C1/26-27/000001",
      counter_code: "C1",
      financial_year: "26-27",
      seq: 1,
      status: "posted",
      subtotal_paise: 24000,
      bill_discount_paise: 0,
      total_paise: 24000,
    });
  });

  it("records the shop's device as the device that saved the old bill", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const deviceRow = sqlite
      .prepare(
        "select bill.device_id = shop_profile.device_id as is_same_device from bill, shop_profile",
      )
      .get();

    expect(deviceRow).toEqual({ is_same_device: 1 });
  });

  it("keeps the bill line attached to its bill", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const lineRow = sqlite
      .prepare(
        "select bill_line.amount_paise from bill_line join bill on bill.id = bill_line.bill_id",
      )
      .get();

    expect(lineRow).toEqual({ amount_paise: 24000 });
    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
  });

  it("still refuses to delete a bill, or to edit one beyond cancelling it", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    expect(() => sqlite.prepare("delete from bill").run()).toThrow(/cannot be deleted/);
    expect(() =>
      sqlite.prepare("update bill set total_paise = 1, subtotal_paise = 1").run(),
    ).toThrow(/can only be cancelled/);
  });

  it("lets the bill be cancelled once with a reason, and never reopened", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    sqlite.prepare("update bill set status = 'cancelled', cancel_reason = 'wrong item'").run();

    expect(sqlite.prepare("select status, cancel_reason from bill").get()).toEqual({
      status: "cancelled",
      cancel_reason: "wrong item",
    });
    expect(() => sqlite.prepare("update bill set status = 'posted'").run()).toThrow(
      /can only be cancelled/,
    );
  });

  it("refuses a bill number longer than 16 characters", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    expect(() => sqlite.prepare("update bill set bill_no = 'C1/26-27/0000001X'").run()).toThrow();
  });
});

describe("opening a database with foreign keys on or off (connection.ts)", () => {
  it("leaves foreign keys on once the migrations have run", () => {
    const databasePath = createDatabaseFileAtMigration0004WithOneBill();

    const { sqlite } = openDatabase(databasePath, { migrationsFolder: MIGRATIONS });

    expect(sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  it("refuses to open a database that already has a broken reference", () => {
    const databasePath = createDatabaseFileAtMigration0004WithOneBill();
    const damaged = new Database(databasePath);
    damaged.pragma("foreign_keys = OFF");
    damaged
      .prepare(
        `insert into stock_movement (id, business_id, shop_id, created_at, updated_at, item_id, quantity_milli, reason, occurred_at, device_id)
         select 'orphan-movement', business_id, shop_id, 'now', 'now', 'no-such-item', 500, 'opening', 'now', device_id from shop_profile`,
      )
      .run();
    const beforeSchema = damaged.prepare("SELECT * FROM sqlite_master ORDER BY name").all();
    const beforeJournal = damaged.prepare("SELECT * FROM __drizzle_migrations").all();
    const beforeBills = damaged.prepare("SELECT * FROM bill").all();
    try {
      expect(() => migrateConnection(damaged, MIGRATIONS)).toThrow(/broken reference/);
      expect(damaged.prepare("SELECT * FROM sqlite_master ORDER BY name").all()).toEqual(
        beforeSchema,
      );
      expect(damaged.prepare("SELECT * FROM __drizzle_migrations").all()).toEqual(beforeJournal);
      expect(damaged.prepare("SELECT * FROM bill").all()).toEqual(beforeBills);
      expect(damaged.inTransaction).toBe(false);
      expect(damaged.pragma("foreign_keys", { simple: true })).toBe(1);
    } finally {
      damaged.close();
    }
  });
});
