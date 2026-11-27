import type Database from "better-sqlite3";
import { SCHEMA_TASK_DONE } from "../helpers/schemaProgress";
import { insertTargetBill, insertTargetNumberGap } from "../helpers/schemaRows";
import { SCHEMA_STEPS } from "../helpers/schemaSteps";
import { createTestDb } from "../helpers/testDb";
import { upgradeDatabaseWithOneBill } from "../helpers/upgradeFixture";

const BASE_COLUMNS = ["id", "business_id", "shop_id", "created_at", "updated_at"];

const EPOCH_MS_COLUMNS = [
  ["item_family", "created_at"],
  ["item_variant", "updated_at"],
  ["stock_movement", "occurred_at"],
  ["bill", "billed_at"],
  ["bill", "cancelled_at"],
  ["shop_profile", "created_at"],
];

function tableNamesOf(sqlite: Database.Database): string[] {
  const tableRows = sqlite.prepare("select name from sqlite_master where type = 'table'").all();
  return (tableRows as { name: string }[]).map((tableRow) => tableRow.name);
}

function columnsOf(sqlite: Database.Database, tableName: string): { name: string; type: string }[] {
  return sqlite.pragma(`table_info(${tableName})`) as { name: string; type: string }[];
}

function errorMessageOf(action: () => unknown): string {
  try {
    action();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
}

describe.each(SCHEMA_STEPS)("target shape after $task (data-model.md)", (step) => {
  const isDone = SCHEMA_TASK_DONE[step.task];

  it.skipIf(!isDone)("has every target column, and the base columns on each new table", () => {
    const { sqlite } = createTestDb();

    Object.entries(step.presentColumns).forEach(([tableName, expectedColumns]) => {
      const actualNames = columnsOf(sqlite, tableName).map((column) => column.name);
      expect(actualNames, tableName).toEqual(expect.arrayContaining(expectedColumns));
      expect(actualNames, tableName).toEqual(expect.arrayContaining(BASE_COLUMNS));
    });
  });

  it.skipIf(!isDone)("no longer has the old columns and tables", () => {
    const { sqlite } = createTestDb();

    Object.entries(step.absentColumns).forEach(([tableName, oldColumns]) => {
      const actualNames = columnsOf(sqlite, tableName).map((column) => column.name);
      oldColumns.forEach((oldColumn) => expect(actualNames, tableName).not.toContain(oldColumn));
    });
    step.removedTables.forEach((tableName) =>
      expect(tableNamesOf(sqlite)).not.toContain(tableName),
    );
  });
});

describe("target shape: seed and time columns", () => {
  it.skipIf(!SCHEMA_TASK_DONE.T075)("seeds the one 'Shop floor' location", () => {
    const { sqlite } = createTestDb();

    // Spec 002 T019 adds a "Tinted returns" location; there is still one shop floor
    const locationRows = sqlite
      .prepare("select name from location where kind = 'shop_floor'")
      .all();

    expect(locationRows).toEqual([{ name: "Shop floor" }]);
  });

  it.skipIf(!SCHEMA_TASK_DONE.T078)("holds times as INTEGER epoch milliseconds", () => {
    const { sqlite } = createTestDb();

    EPOCH_MS_COLUMNS.forEach(([tableName, columnName]) => {
      const matchingColumn = columnsOf(sqlite, tableName!).find(
        (column) => column.name === columnName,
      );
      expect(matchingColumn?.type, `${tableName}.${columnName}`).toBe("INTEGER");
    });
  });
});

describe("target shape: records can only be added, never changed (constitution I and II)", () => {
  // insertTargetBill writes bill.doc_title and bill.round_off_paise, which arrive with T080.
  const isReady = SCHEMA_TASK_DONE.T078 && SCHEMA_TASK_DONE.T080;

  it.skipIf(!isReady)("refuses to update or delete a stock movement", () => {
    const testDb = createTestDb();
    const ids = insertTargetBill(testDb.sqlite, testDb.ctx);

    const updateError = errorMessageOf(() =>
      testDb.sqlite
        .prepare("update stock_movement set qty_base_milli = 1 where id = ?")
        .run(ids.movementId),
    );
    const deleteError = errorMessageOf(() =>
      testDb.sqlite.prepare("delete from stock_movement where id = ?").run(ids.movementId),
    );

    expect(updateError).toContain("append-only");
    expect(deleteError).toContain("append-only");
  });

  it.skipIf(!isReady)("refuses to update or delete a bill line or a bill tender", () => {
    const testDb = createTestDb();
    const ids = insertTargetBill(testDb.sqlite, testDb.ctx);

    const lineUpdateError = errorMessageOf(() =>
      testDb.sqlite.prepare("update bill_line set amount_paise = 1 where id = ?").run(ids.lineId),
    );
    const lineDeleteError = errorMessageOf(() =>
      testDb.sqlite.prepare("delete from bill_line where id = ?").run(ids.lineId),
    );
    const tenderUpdateError = errorMessageOf(() =>
      testDb.sqlite
        .prepare("update bill_tender set amount_paise = 1 where id = ?")
        .run(ids.tenderId),
    );
    const tenderDeleteError = errorMessageOf(() =>
      testDb.sqlite.prepare("delete from bill_tender where id = ?").run(ids.tenderId),
    );

    [lineUpdateError, lineDeleteError, tenderUpdateError, tenderDeleteError].forEach(
      (errorMessage) => expect(errorMessage).not.toBe(""),
    );
  });

  it.skipIf(!isReady)("never deletes a bill and never edits one beyond cancelling it", () => {
    const testDb = createTestDb();
    const ids = insertTargetBill(testDb.sqlite, testDb.ctx);

    const deleteError = errorMessageOf(() =>
      testDb.sqlite.prepare("delete from bill where id = ?").run(ids.billId),
    );
    const editError = errorMessageOf(() =>
      testDb.sqlite.prepare("update bill set total_paise = 1 where id = ?").run(ids.billId),
    );

    expect(deleteError).toContain("bills cannot be deleted");
    expect(deleteError).not.toMatch(/foreign key/i);
    expect(editError).not.toBe("");
  });

  it.skipIf(!isReady)("lets a bill move from posted to cancelled once, and never back", () => {
    const testDb = createTestDb();
    const ids = insertTargetBill(testDb.sqlite, testDb.ctx);
    const cancelBill = () =>
      testDb.sqlite
        .prepare(
          "update bill set status = 'cancelled', cancel_reason = 'wrong item', cancelled_at = 1 where id = ?",
        )
        .run(ids.billId);

    cancelBill();
    const reopenError = errorMessageOf(() =>
      testDb.sqlite.prepare("update bill set status = 'posted' where id = ?").run(ids.billId),
    );

    const savedStatus = testDb.sqlite.prepare("select status from bill").get();
    expect(savedStatus).toEqual({ status: "cancelled" });
    expect(reopenError).not.toBe("");
  });

  it.skipIf(!(SCHEMA_TASK_DONE.T083 && SCHEMA_TASK_DONE.T080))(
    "refuses to update or delete a recorded number gap",
    () => {
      const testDb = createTestDb();
      const ids = insertTargetBill(testDb.sqlite, testDb.ctx);
      const gapId = insertTargetNumberGap(testDb.sqlite, testDb.ctx, ids.numberSeriesId);

      const updateError = errorMessageOf(() =>
        testDb.sqlite.prepare("update bill_number_gap set seq_to = 1 where id = ?").run(gapId),
      );
      const deleteError = errorMessageOf(() =>
        testDb.sqlite.prepare("delete from bill_number_gap where id = ?").run(gapId),
      );

      expect(updateError).toContain("append-only");
      expect(deleteError).toContain("append-only");
    },
  );
});

describe("upgrading a database that is at migration 0004", () => {
  const isReady = SCHEMA_TASK_DONE.T078;

  it.skipIf(!isReady)("migrates timestamp values to INTEGER epoch milliseconds", () => {
    const sqlite = upgradeDatabaseWithOneBill({ cancelledAt: "2026-11-15T10:00:00.000Z" });

    EPOCH_MS_COLUMNS.forEach(([tableName, columnName]) => {
      const timeRows = sqlite
        .prepare(
          `select typeof(${columnName}) as storage_type, ${columnName} as epoch_millis from ${tableName}`,
        )
        .all() as { storage_type: string; epoch_millis: number }[];

      expect(timeRows.length, `${tableName}.${columnName}`).toBeGreaterThan(0);
      timeRows.forEach((timeRow) => {
        expect(timeRow.storage_type).toBe("integer");
        expect(timeRow.epoch_millis).toBeGreaterThanOrEqual(Date.UTC(2000, 0, 1));
        expect(timeRow.epoch_millis).toBeLessThan(Date.UTC(2100, 0, 1));
      });
    });
    expect(sqlite.prepare("select cancelled_at from bill").get()).toEqual({
      cancelled_at: Date.parse("2026-11-15T10:00:00.000Z"),
    });
  });

  it.skipIf(!isReady)("keeps the bill, its total and its number", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const billRow = sqlite.prepare("select bill_no, status, total_paise from bill").get();

    expect(billRow).toEqual({ bill_no: "C1/26-27/000001", status: "posted", total_paise: 24000 });
  });

  it.skipIf(!isReady)(
    "keeps the item as a variant with the same stock, equal to its movements",
    () => {
      const sqlite = upgradeDatabaseWithOneBill();

      const variantRow = sqlite.prepare("select display_name, stock_milli from item_variant").get();
      const movementSum = sqlite
        .prepare(
          "select sum(case when to_location_id is not null then qty_base_milli else -qty_base_milli end) as total from stock_movement",
        )
        .get();

      expect(variantRow).toEqual({ display_name: "Pipe", stock_milli: 8000 });
      expect(movementSum).toEqual({ total: 8000 });
    },
  );

  it.skipIf(!isReady)("keeps the line, and writes the old payment mode as one tender", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const lineRow = sqlite
      .prepare("select qty_base_milli, unit_price_paise, amount_paise from bill_line")
      .get();
    const tenderRows = sqlite.prepare("select mode, amount_paise from bill_tender").all();

    expect(lineRow).toEqual({ qty_base_milli: 2000, unit_price_paise: 12000, amount_paise: 24000 });
    expect(tenderRows).toEqual([{ mode: "cash", amount_paise: 24000 }]);
  });

  it.skipIf(!isReady)("keeps the next bill number, so the old number is never reused", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    const seriesRow = sqlite.prepare("select counter_code, last_seq from number_series").get();

    expect(seriesRow).toEqual({ counter_code: "C1", last_seq: 1 });
  });

  it.skipIf(!isReady)("leaves no broken reference behind", () => {
    const sqlite = upgradeDatabaseWithOneBill();

    expect(sqlite.pragma("foreign_key_check")).toEqual([]);
    expect(sqlite.pragma("integrity_check", { simple: true })).toBe("ok");
  });
});
