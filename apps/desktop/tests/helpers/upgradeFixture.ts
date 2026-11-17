import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import { openDatabase, type Connection } from "../../src/main/db/connection";
import { newId } from "../../src/main/db/ids";
import type { Ctx } from "../../src/main/db/seed";
import { makeTempFolder } from "./appStateFixture";
import { insertBillAtMigration0004 } from "./schemaRows";
import { MIGRATIONS } from "./testDb";

const MIGRATION_COUNT_AT_0004 = 5; // migrations 0000 to 0004

/** A copy of the real migrations folder holding only 0000 to 0004. */
function makeMigrationsFolderAtMigration0004(): string {
  const folder = makeTempFolder("shopos-migrations-0004-");
  fs.cpSync(MIGRATIONS, folder, { recursive: true });
  const journalFile = path.join(folder, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalFile, "utf8")) as { entries: unknown[] };
  journal.entries = journal.entries.slice(0, MIGRATION_COUNT_AT_0004);
  fs.writeFileSync(journalFile, JSON.stringify(journal));
  return folder;
}

/** The first-run seed as it was at migration 0004: a shop profile only (no location yet). */
function seedShopAtMigration0004(sqlite: Database.Database): Ctx {
  const ctx = { businessId: newId(), shopId: newId(), deviceId: newId() };
  sqlite
    .prepare(
      `insert into shop_profile (id, business_id, shop_id, created_at, updated_at, name, device_id)
       values (?, ?, ?, '2026-11-15T09:00:00.000Z', '2026-11-15T09:00:00.000Z', 'My Shop', ?)`,
    )
    .run(newId(), ctx.businessId, ctx.shopId, ctx.deviceId);
  return ctx;
}

/**
 * The shop's database file as it was at migration 0004, holding Pipe (opening 10 pcs) and one
 * saved bill of 2 pcs at 120.00. Not yet upgraded: open it with every migration to upgrade it.
 */
export function createDatabaseFileAtMigration0004WithOneBill(
  options: { cancelledAt?: string; beforeUpgrade?: (sqlite: Database.Database) => void } = {},
): string {
  const databasePath = path.join(makeTempFolder("shopos-upgrade-"), "shopos.sqlite");
  const oldConnection = openDatabase(databasePath, {
    migrationsFolder: makeMigrationsFolderAtMigration0004(),
  });
  insertBillAtMigration0004(oldConnection.sqlite, seedShopAtMigration0004(oldConnection.sqlite));
  const hasCancellation = options.cancelledAt !== undefined;
  if (hasCancellation) {
    oldConnection.sqlite
      .prepare(
        "update bill set status = 'cancelled', cancel_reason = 'wrong item', cancelled_at = ? where id = 'bill-1'",
      )
      .run(options.cancelledAt);
  }
  options.beforeUpgrade?.(oldConnection.sqlite);
  oldConnection.sqlite.close();
  return databasePath;
}

/** The same database, opened with every migration so the upgrade runs on real rows. */
export function upgradeConnectionWithOneBill(options: { cancelledAt?: string } = {}): Connection {
  const databasePath = createDatabaseFileAtMigration0004WithOneBill(options);
  return openDatabase(databasePath, { migrationsFolder: MIGRATIONS });
}

export function upgradeDatabaseWithOneBill(
  options: { cancelledAt?: string; beforeUpgrade?: (sqlite: Database.Database) => void } = {},
): Database.Database {
  return upgradeConnectionWithOneBill(options).sqlite;
}
