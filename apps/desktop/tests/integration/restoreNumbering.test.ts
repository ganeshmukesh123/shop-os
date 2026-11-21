import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CoreError } from "@shopos/core";
import { openDatabase, type Connection } from "../../src/main/db/connection";
import { ensureSeed, type Ctx } from "../../src/main/db/seed";
import { BackupService, restoreBackup } from "../../src/main/services/BackupService";
import { BillingService } from "../../src/main/services/BillingService";
import { InventoryService } from "../../src/main/services/InventoryService";
import {
  planRestoreNumbering,
  restoreWithNumbering,
} from "../../src/main/services/RestoreNumbering/RestoreNumbering";
import { makeTempFolder } from "../helpers/appStateFixture";
import { MIGRATIONS } from "../helpers/testDb";
import { createDatabaseFileAtMigration0004WithOneBill } from "../helpers/upgradeFixture";

/** 15:30 IST on 21 November 2026, in financial year 26-27. */
const NOW = new Date(Date.UTC(2026, 10, 21, 10, 0));
/** 11 May 2027: financial year 27-28. */
const NEXT_YEAR = new Date(Date.UTC(2027, 4, 11, 10, 0));

// Every connection and temp folder a test opens is released after it, pass or fail.
const openedConnections: Connection[] = [];
const createdFolders: string[] = [];

function tempFolder(prefix: string): string {
  const folder = makeTempFolder(prefix);
  createdFolders.push(folder);
  return folder;
}

function openTracked(databasePath: string, options: { migrationsFolder: string }): Connection {
  const connection = openDatabase(databasePath, options);
  openedConnections.push(connection);
  return connection;
}

afterEach(() => {
  openedConnections
    .splice(0)
    .filter((connection) => connection.sqlite.open)
    .forEach((connection) => connection.sqlite.close());
  createdFolders.splice(0).forEach((folder) => fs.rmSync(folder, { recursive: true, force: true }));
});

interface IShop {
  connection: Connection;
  ctx: Ctx;
  itemId: string;
  backupFolder: string;
}

/** A shop whose counter stands at `lastSeq` (the bills made so far are few; the counter is set directly). */
function createShop(billCount: number, lastSeq: number): IShop {
  const databasePath = path.join(tempFolder("shopos-shop-"), "shopos.sqlite");
  const connection = openTracked(databasePath, { migrationsFolder: MIGRATIONS });
  const ctx = ensureSeed(connection.db);
  const itemId = new InventoryService(connection.db, ctx).createItem({
    name: "Pipe",
    unit: "pcs",
    pricePaise: 10000,
    openingQtyMilli: 100000,
  }).item.id;
  const shop = { connection, ctx, itemId, backupFolder: tempFolder("shopos-backups-") };
  Array.from({ length: billCount }).forEach(() => saveBill(shop, NOW));
  connection.sqlite.prepare("update number_series set last_seq = ?").run(lastSeq);
  return shop;
}

function saveBill(shop: Pick<IShop, "connection" | "ctx" | "itemId">, billedAt: Date): string {
  const saveResult = new BillingService(shop.connection.db, shop.ctx).saveBill(
    {
      clientBillId: crypto.randomUUID(),
      paymentMode: "cash",
      billDiscountPaise: 0,
      lines: [{ itemId: shop.itemId, quantityMilli: 1000, ratePaise: 10000, lineDiscountPaise: 0 }],
    },
    billedAt,
  );
  return saveResult.bill.number;
}

async function takeBackup(shop: IShop): Promise<string> {
  const backupService = new BackupService(
    shop.connection.sqlite,
    shop.connection.db,
    shop.ctx,
    () => shop.backupFolder,
  );
  return (await backupService.run(NOW)).path;
}

/** Plans, restores into a fresh database file, and opens it: what a restore on a new computer does. */
function restoreAndOpen(backupFile: string, lastIssuedBillNo: string | null) {
  const plan = planRestoreNumbering(backupFile, lastIssuedBillNo, NOW);
  const livePath = path.join(tempFolder("shopos-restored-"), "shopos.sqlite");
  restoreWithNumbering(
    backupFile,
    { databasePath: livePath, migrationsFolder: MIGRATIONS },
    plan,
    NOW,
  );
  const connection = openTracked(livePath, { migrationsFolder: MIGRATIONS });
  return { plan, connection, ctx: ensureSeed(connection.db), livePath };
}

function errorCodeOf(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    return error instanceof CoreError ? error.code : `other:${String(error)}`;
  }
  return undefined;
}

describe("restoring a backup never reuses a bill number (task T082 and T083, FR-013b, EC-19, research D21)", () => {
  it("continues at 127 and records 121 to 126 as lost, when the backup ended at 120 and the owner confirms 126", async () => {
    const backupFile = await takeBackup(createShop(3, 120));

    const { plan, connection, ctx } = restoreAndOpen(backupFile, "C1/26-27/000126");

    expect(plan.gap).toEqual({ seqFrom: 121, seqTo: 126, newLastSeq: 126, isEstimated: false });
    expect(plan.nextBillNo).toBe("C1/26-27/000127");
    expect(
      connection.sqlite.prepare("select seq_from, seq_to, reason from bill_number_gap").all(),
    ).toEqual([{ seq_from: 121, seq_to: 126, reason: "lost_in_restore" }]);
    expect(saveBill({ connection, ctx, itemId: firstItemId(connection) }, NOW)).toBe(
      "C1/26-27/000127",
    );
  });

  it("jumps 100 ahead and records the block when the owner cannot say what the last bill was", async () => {
    const backupFile = await takeBackup(createShop(3, 120));

    const { plan, connection, ctx } = restoreAndOpen(backupFile, null);

    expect(plan.gap).toEqual({ seqFrom: 121, seqTo: 220, newLastSeq: 220, isEstimated: true });
    expect(connection.sqlite.prepare("select seq_from, seq_to from bill_number_gap").all()).toEqual(
      [{ seq_from: 121, seq_to: 220 }],
    );
    expect(saveBill({ connection, ctx, itemId: firstItemId(connection) }, NOW)).toBe(
      "C1/26-27/000221",
    );
  });

  it("records nothing when the backup already has the last bill the owner confirms", async () => {
    const backupFile = await takeBackup(createShop(3, 120));

    const { plan, connection, ctx } = restoreAndOpen(backupFile, "C1/26-27/000120");

    expect(plan.gap).toBeNull();
    expect(
      connection.sqlite.prepare("select count(*) as total from bill_number_gap").get(),
    ).toEqual({ total: 0 });
    expect(saveBill({ connection, ctx, itemId: firstItemId(connection) }, NOW)).toBe(
      "C1/26-27/000121",
    );
  });

  it("never gives a cancelled bill's number to a new bill", async () => {
    const shop = createShop(3, 3);
    shop.connection.sqlite
      .prepare(
        "update bill set status = 'cancelled', cancel_reason = 'wrong item', cancelled_at = 1 where seq = 3",
      )
      .run();
    const backupFile = await takeBackup(shop);

    const { connection, ctx } = restoreAndOpen(backupFile, "C1/26-27/000005");
    const nextNumber = saveBill({ connection, ctx, itemId: firstItemId(connection) }, NOW);

    const usedNumbers = connection.sqlite.prepare("select bill_no from bill order by seq").all();
    expect(nextNumber).toBe("C1/26-27/000006");
    expect(usedNumbers).toEqual([
      { bill_no: "C1/26-27/000001" },
      { bill_no: "C1/26-27/000002" },
      { bill_no: "C1/26-27/000003" },
      { bill_no: "C1/26-27/000006" },
    ]);
  });

  it("protects the financial year the owner typed, and starts it when the backup has none yet", async () => {
    const backupFile = await takeBackup(createShop(3, 3));

    const { plan, connection, ctx } = restoreAndOpen(backupFile, "C1/27-28/000004");

    expect(plan.gap).toEqual({ seqFrom: 1, seqTo: 4, newLastSeq: 4, isEstimated: false });
    expect(
      connection.sqlite
        .prepare("select financial_year, last_seq from number_series order by financial_year")
        .all(),
    ).toEqual([
      { financial_year: "26-27", last_seq: 3 },
      { financial_year: "27-28", last_seq: 4 },
    ]);
    expect(saveBill({ connection, ctx, itemId: firstItemId(connection) }, NEXT_YEAR)).toBe(
      "C1/27-28/000005",
    );
  });

  it("refuses a number that is not in the shop's format, or in another series, or older than the backup", async () => {
    const backupFile = await takeBackup(createShop(3, 120));

    expect(errorCodeOf(() => planRestoreNumbering(backupFile, "126", NOW))).toBe("INVALID_FIELD");
    expect(errorCodeOf(() => planRestoreNumbering(backupFile, "B2/26-27/000126", NOW))).toBe(
      "INVALID_FIELD",
    );
    expect(errorCodeOf(() => planRestoreNumbering(backupFile, "C1/26-27/000100", NOW))).toBe(
      "INVALID_FIELD",
    );
  });

  it("refuses a number from an earlier financial year than the backup's last bill", async () => {
    // The backup's last bill is in 26-27, so a 25-26 number cannot be the last one printed.
    const backupFile = await takeBackup(createShop(1, 1));

    const failure = errorCodeOf(() => planRestoreNumbering(backupFile, "C1/25-26/000126", NOW));

    expect(failure).toBe("INVALID_FIELD");
  });

  it("reads the backup without changing it", async () => {
    const backupFile = await takeBackup(createShop(3, 120));
    const bytesBefore = fs.readFileSync(backupFile);
    const filesBefore = fs.readdirSync(path.dirname(backupFile)).sort();

    restoreAndOpen(backupFile, "C1/26-27/000126");

    expect(fs.readFileSync(backupFile).equals(bytesBefore)).toBe(true);
    expect(fs.readdirSync(path.dirname(backupFile)).sort()).toEqual(filesBefore);
  });

  it("upgrades an older backup (migration 0004) while recording the gap", () => {
    const oldBackup = createDatabaseFileAtMigration0004WithOneBill();

    const { plan, connection } = restoreAndOpen(oldBackup, "C1/26-27/000005");

    expect(plan.gap).toEqual({ seqFrom: 2, seqTo: 5, newLastSeq: 5, isEstimated: false });
    expect(connection.sqlite.prepare("select bill_no from bill").all()).toEqual([
      { bill_no: "C1/26-27/000001" },
    ]);
    expect(connection.sqlite.prepare("select seq_from, seq_to from bill_number_gap").all()).toEqual(
      [{ seq_from: 2, seq_to: 5 }],
    );
    expect(connection.sqlite.prepare("select last_seq from number_series").get()).toEqual({
      last_seq: 5,
    });
  });

  it("leaves the live database as it was when the numbering cannot be applied", async () => {
    const backupFile = await takeBackup(createShop(3, 120));
    const live = createShop(2, 2);
    live.connection.sqlite.close();
    const livePath = live.connection.sqlite.name;
    const plan = planRestoreNumbering(backupFile, "C1/26-27/000126", NOW);

    const failure = errorCodeOf(() =>
      restoreWithNumbering(
        backupFile,
        { databasePath: livePath, migrationsFolder: "/no/such/migrations" },
        plan,
        NOW,
      ),
    );

    const after = openTracked(livePath, { migrationsFolder: MIGRATIONS });
    expect(failure).toBeDefined();
    expect(after.sqlite.prepare("select count(*) as total from bill").get()).toEqual({ total: 2 });
    expect(after.sqlite.prepare("select count(*) as total from bill_number_gap").get()).toEqual({
      total: 0,
    });
    expect(
      fs.readdirSync(path.dirname(livePath)).filter((name) => name.includes("restore")),
    ).toEqual([]);
  });

  it("refuses a plan made from another backup, so the counter never moves back", async () => {
    const backupEndingAt120 = await takeBackup(createShop(3, 120));
    const backupEndingAt200 = await takeBackup(createShop(3, 200));
    const planFor120 = planRestoreNumbering(backupEndingAt120, "C1/26-27/000126", NOW);
    const livePath = path.join(tempFolder("shopos-restored-"), "shopos.sqlite");

    const failure = errorCodeOf(() =>
      restoreWithNumbering(
        backupEndingAt200,
        { databasePath: livePath, migrationsFolder: MIGRATIONS },
        planFor120,
        NOW,
      ),
    );

    expect(failure).toBe("INVALID_BACKUP");
    expect(fs.existsSync(livePath)).toBe(false);
  });

  it("leaves no copy of the backup in the temp folder when the backup cannot be copied", () => {
    const planFolders = () =>
      fs.readdirSync(os.tmpdir()).filter((name) => name.startsWith("shopos-plan-"));
    const foldersBefore = planFolders();

    const failure = errorCodeOf(() => planRestoreNumbering("/no/such/backup.sqlite", null, NOW));

    expect(failure).toBeDefined();
    expect(planFolders()).toEqual(foldersBefore);
  });

  it("removes its install copy when putting the restored file in place fails", () => {
    const backupFile = path.join(tempFolder("shopos-backup-file-"), "backup.sqlite");
    openTracked(backupFile, { migrationsFolder: MIGRATIONS }).sqlite.close();
    // A folder in the database's place makes the final rename fail.
    const liveFolder = tempFolder("shopos-live-");
    const livePath = path.join(liveFolder, "shopos.sqlite");
    fs.mkdirSync(path.join(livePath, "blocker"), { recursive: true });

    expect(() => restoreBackup(backupFile, livePath)).toThrow();

    expect(fs.readdirSync(liveFolder).filter((name) => name.includes(".restore-"))).toEqual([]);
  });
});

function firstItemId(connection: Connection): string {
  return (connection.sqlite.prepare("select id from item_variant").get() as { id: string }).id;
}
