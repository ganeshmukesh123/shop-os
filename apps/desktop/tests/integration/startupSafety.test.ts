import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { CoreError } from "@shopos/core";
import { openDatabase } from "../../src/main/db/connection";
import {
  PRE_MIGRATION_BACKUPS_KEPT,
  backupBeforeMigrating,
  needsPreMigrationBackup,
  openCheckedSqlite,
} from "../../src/main/db/startupSafety";
import { makeTempFolder } from "../helpers/appStateFixture";
import { MIGRATIONS } from "../helpers/testDb";

const BACKUP_TIME = new Date(2026, 10, 15, 9, 30, 0);

function createMigratedFile(): string {
  const databasePath = path.join(makeTempFolder("shopos-safety-"), "shopos.sqlite");
  const connection = openDatabase(databasePath, { migrationsFolder: MIGRATIONS });
  connection.sqlite.close();
  return databasePath;
}

/** Pretend the newest migration has not run yet, as on a shop computer after an app update. */
function forgetNewestMigration(sqlite: Database.Database): void {
  sqlite
    .prepare(
      "delete from __drizzle_migrations where created_at = (select max(created_at) from __drizzle_migrations)",
    )
    .run();
}

describe("openCheckedSqlite", () => {
  it("opens an intact database file", () => {
    const sqlite = openCheckedSqlite(createMigratedFile());

    const journalMode = sqlite.pragma("journal_mode", { simple: true });

    expect(journalMode).toBe("wal");
    sqlite.close();
  });

  it("refuses a file that is not a database, with DATABASE_CORRUPT", () => {
    const databasePath = path.join(makeTempFolder("shopos-safety-"), "shopos.sqlite");
    fs.writeFileSync(databasePath, "this is not a sqlite file, just text ".repeat(200));

    const openGarbage = () => openCheckedSqlite(databasePath);

    expect(openGarbage).toThrowError(CoreError);
    expect(openGarbage).toThrowError(/DATABASE_CORRUPT|damaged/);
  });
});

describe("needsPreMigrationBackup", () => {
  it("is false for a brand-new empty database (nothing to protect)", () => {
    const databasePath = path.join(makeTempFolder("shopos-safety-"), "new.sqlite");
    const sqlite = openCheckedSqlite(databasePath);

    const needsBackup = needsPreMigrationBackup(sqlite, MIGRATIONS);

    expect(needsBackup).toBe(false);
    sqlite.close();
  });

  it("is false when every migration has already run", () => {
    const sqlite = openCheckedSqlite(createMigratedFile());

    const needsBackup = needsPreMigrationBackup(sqlite, MIGRATIONS);

    expect(needsBackup).toBe(false);
    sqlite.close();
  });

  it("is true when shop data exists and a migration is pending", () => {
    const sqlite = openCheckedSqlite(createMigratedFile());
    forgetNewestMigration(sqlite);

    const needsBackup = needsPreMigrationBackup(sqlite, MIGRATIONS);

    expect(needsBackup).toBe(true);
    sqlite.close();
  });
});

describe("backupBeforeMigrating", () => {
  it("writes a timestamped copy that opens and passes the integrity check", async () => {
    const sqlite = openCheckedSqlite(createMigratedFile());
    const backupFolder = makeTempFolder("shopos-premigrate-");

    const backupPath = await backupBeforeMigrating(sqlite, backupFolder, BACKUP_TIME);

    expect(path.basename(backupPath)).toBe("shopos-pre-migrate-20261115-093000.sqlite");
    const copy = new Database(backupPath, { readonly: true });
    expect(copy.pragma("integrity_check", { simple: true })).toBe("ok");
    copy.close();
    sqlite.close();
  });

  it("creates the backup folder when it does not exist yet", async () => {
    const sqlite = openCheckedSqlite(createMigratedFile());
    const backupFolder = path.join(makeTempFolder("shopos-premigrate-"), "pre-migration-backups");

    const backupPath = await backupBeforeMigrating(sqlite, backupFolder, BACKUP_TIME);

    expect(fs.existsSync(backupPath)).toBe(true);
    sqlite.close();
  });

  it(`keeps only the newest ${PRE_MIGRATION_BACKUPS_KEPT} copies`, async () => {
    const sqlite = openCheckedSqlite(createMigratedFile());
    const backupFolder = makeTempFolder("shopos-premigrate-");
    const backupTimes = [1, 2, 3, 4, 5, 6, 7].map((minute) => new Date(2026, 10, 15, 9, minute, 0));

    for (const backupTime of backupTimes) {
      await backupBeforeMigrating(sqlite, backupFolder, backupTime);
    }

    const keptNames = fs.readdirSync(backupFolder).sort();
    expect(keptNames).toHaveLength(PRE_MIGRATION_BACKUPS_KEPT);
    expect(keptNames[0]).toBe("shopos-pre-migrate-20261115-090300.sqlite");
    sqlite.close();
  });
});
