import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { CoreError } from "@shopos/core";
import {
  BackupService,
  restoreBackup,
  validateBackupFile,
} from "../../src/main/services/BackupService";
import { BillingService } from "../../src/main/services/BillingService";
import { InventoryService } from "../../src/main/services/InventoryService";
import { SettingsService } from "../../src/main/services/SettingsService";
import { createTestDb, type TestDb } from "../helpers/testDb";

let testDb: TestDb;
let dir: string;
let backup: BackupService;

beforeEach(() => {
  testDb = createTestDb();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "shopos-backup-"));
  backup = new BackupService(testDb.sqlite, testDb.db, testDb.ctx, () => dir);
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const seed = () => {
  const inv = new InventoryService(testDb.db, testDb.ctx);
  const seededItem = inv.createItem({
    name: "Pipe",
    unit: "pcs",
    pricePaise: 5000,
    openingQtyMilli: 10000,
  }).item;
  new BillingService(testDb.db, testDb.ctx).saveBill({
    clientBillId: crypto.randomUUID(),
    paymentMode: "cash",
    billDiscountPaise: 0,
    lines: [{ itemId: seededItem.id, quantityMilli: 2000, ratePaise: 5000, lineDiscountPaise: 0 }],
  });
  return seededItem;
};
const files = () =>
  fs
    .readdirSync(dir)
    .filter((fileName) => fileName.endsWith(".sqlite"))
    .sort();

describe("backup", () => {
  it("produces a file that opens and holds the same items and bills", async () => {
    seed();
    const backupResult = await backup.run(new Date(2026, 11, 7, 10, 0, 0));
    expect(fs.existsSync(backupResult.path)).toBe(true);
    const copy = new Database(backupResult.path, { readonly: true });
    expect(copy.prepare("select count(*) as rowCount from item_variant").get()).toEqual({
      rowCount: 1,
    });
    expect(copy.prepare("select count(*) as rowCount from bill").get()).toEqual({ rowCount: 1 });
    expect(copy.pragma("integrity_check", { simple: true })).toBe("ok");
    copy.close();
  });

  it("a backup taken while a bill is being saved is consistent", async () => {
    const seededItem = seed();
    const billing = new BillingService(testDb.db, testDb.ctx);
    const pendingBackup = backup.run(new Date(2026, 11, 7, 10, 0, 0));
    for (let itemIndex = 0; itemIndex < 20; itemIndex++)
      billing.saveBill({
        clientBillId: crypto.randomUUID(),
        paymentMode: "cash",
        billDiscountPaise: 0,
        lines: [
          { itemId: seededItem.id, quantityMilli: 1000, ratePaise: 5000, lineDiscountPaise: 0 },
        ],
      });
    const backupResult = await pendingBackup;
    const copy = new Database(backupResult.path, { readonly: true });
    expect(copy.pragma("integrity_check", { simple: true })).toBe("ok");
    const sums = copy
      .prepare(
        "select (select stock_milli from item_variant) cached, (select sum(quantity_milli) from stock_movement) derived",
      )
      .get() as { cached: number; derived: number };
    expect(sums.cached).toBe(sums.derived);
    copy.close();
  });

  it("logs success and failure and reports status", async () => {
    expect(backup.status().lastOkAt).toBeNull();
    await backup.run();
    expect(backup.status().lastOkAt).not.toBeNull();
    const bad = new BackupService(testDb.sqlite, testDb.db, testDb.ctx, () => "");
    await expect(bad.run()).rejects.toMatchObject({ code: "BACKUP_FAILED" });
    expect(bad.status().lastError).toMatch(/folder/i);
    const missing = new BackupService(testDb.sqlite, testDb.db, testDb.ctx, () =>
      path.join(dir, "no", "such", "\0bad"),
    );
    await expect(missing.run()).rejects.toBeInstanceOf(CoreError);
  });

  it("retention keeps the newest copy of each of the last 30 days, plus the last 4 of today", async () => {
    const day = (dayOffset: number, hour: number) => new Date(2026, 10, 1 + dayOffset, hour, 0, 0); // 1 Nov + n days
    for (let dayOffset = 0; dayOffset < 35; dayOffset++) {
      await backup.run(day(dayOffset, 9));
      await backup.run(day(dayOffset, 17));
    }
    for (let hour = 18; hour < 24; hour++) await backup.run(day(34, hour)); // today = day 34
    backup.prune(day(34, 23));
    const backupFileNames = files();
    const days = new Set(backupFileNames.map((fileName) => fileName.slice(8, 16)));
    expect(days.size).toBe(30);
    expect(backupFileNames.filter((fileName) => fileName.includes("20261205"))).toHaveLength(4); // 1 Nov + 34 = 5 Dec, newest 4 of today
    // an older day keeps only its newest copy (17:00)
    const old = backupFileNames.filter((fileName) => fileName.includes("20261204"));
    expect(old).toHaveLength(1);
    expect(old[0]).toContain("170000");
  });

  it("restore replaces the database with the chosen file", async () => {
    seed();
    const backupResult = await backup.run();
    const live = path.join(dir, "live.sqlite");
    fs.writeFileSync(live, "not a database anymore");
    restoreBackup(backupResult.path, live);
    const restored = new Database(live, { readonly: true });
    expect(restored.prepare("select count(*) as rowCount from bill").get()).toEqual({
      rowCount: 1,
    });
    restored.close();
  });

  it("a corrupt or foreign file returns INVALID_BACKUP and leaves the live file alone", () => {
    const junk = path.join(dir, "junk.sqlite");
    fs.writeFileSync(junk, "hello world, not sqlite");
    expect(() => validateBackupFile(junk)).toThrowError(
      expect.objectContaining({ code: "INVALID_BACKUP" }),
    );
    const other = path.join(dir, "other.sqlite");
    const otherDatabase = new Database(other);
    otherDatabase.exec("create table foo(x)");
    otherDatabase.close();
    expect(() => validateBackupFile(other)).toThrowError(
      expect.objectContaining({ code: "INVALID_BACKUP" }),
    );
    const live = path.join(dir, "live.sqlite");
    fs.writeFileSync(live, "keep me");
    expect(() => restoreBackup(junk, live)).toThrow();
    expect(fs.readFileSync(live, "utf8")).toBe("keep me");
  });

  it("the backup folder is read from settings", async () => {
    new SettingsService(testDb.db, testDb.ctx).update({
      ...new SettingsService(testDb.db, testDb.ctx).get(),
      backupFolder: dir,
    });
    const viaSettings = new BackupService(testDb.sqlite, testDb.db, testDb.ctx);
    await viaSettings.run();
    expect(files()).toHaveLength(1);
  });
});
